import { useState, useEffect } from 'react';
import { onAuthStateChanged, User as AuthUser } from 'firebase/auth';
import { doc, onSnapshot, Unsubscribe, collection, query, where } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { initializeUserProfile } from '../services/firestoreService';
import { UserData, SubscriptionStatus } from '../types';

export const useAuth = () => {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeCustomer: Unsubscribe | undefined;
    let unsubscribeSubscriptions: Unsubscribe | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (authUser) => {
      if (unsubscribeCustomer) unsubscribeCustomer();
      if (unsubscribeSubscriptions) unsubscribeSubscriptions();

      if (authUser) {
        // Ensure the user profile is created or updated as soon as the user is authenticated.
        await initializeUserProfile(authUser.uid, authUser);
        
        const customerRef = doc(db, 'customers', authUser.uid);
        
        unsubscribeCustomer = onSnapshot(customerRef, (docSnap) => {
          if (docSnap.exists()) {
            const customerData = docSnap.data();

            // Set the user and stop loading immediately with a default subscription status.
            // This prevents the infinite loading screen.
            const initialUserData = {
              uid: authUser.uid,
              email: authUser.email,
              displayName: authUser.displayName,
              photoURL: authUser.photoURL,
              ...customerData,
              subscription: 'free', // Assume 'free' until the subscription check completes.
            } as UserData;

            setUser(initialUserData);
            setLoading(false); // This is the key fix.

            // Now, separately listen for subscription changes and update the user state if they exist.
            const subscriptionsRef = collection(db, 'customers', authUser.uid, 'subscriptions');
            const q = query(subscriptionsRef, where("status", "in", ["trialing", "active"]));
            
            unsubscribeSubscriptions = onSnapshot(q, (subscriptionsSnap) => {
              const subscriptionStatus: SubscriptionStatus = subscriptionsSnap.empty ? 'free' : 'subscriber';
              
              // Update the user state again with the correct subscription status.
              setUser(prevUser => ({
                ...prevUser!,
                ...customerData,
                subscription: subscriptionStatus,
              }));
            });

          }
          // If docSnap doesn't exist, we do nothing and wait. The listener will
          // re-run once initializeUserProfile creates the document.
        }, (error) => {
          console.error("Auth Hook Firestore Error:", error);
          setUser(null);
          setLoading(false);
        });

      } else {
        // User is signed out
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeCustomer) unsubscribeCustomer();
      if (unsubscribeSubscriptions) unsubscribeSubscriptions();
    };
  }, []);

  return { user, loading };
};