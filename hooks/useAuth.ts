// stgisi414/langcampus-exchange/langcampus-exchange-c252374cd98c19888539724d173cd65dd78ec341/hooks/useAuth.ts
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
        await initializeUserProfile(authUser.uid, authUser);
        
        const customerRef = doc(db, 'customers', authUser.uid);
        
        unsubscribeCustomer = onSnapshot(customerRef, (docSnap) => {
          if (docSnap.exists()) {
            const customerData = docSnap.data();

            // FIX: This merges new data with the previous state, preventing race conditions
            // where the 'notes' array or other fields get temporarily overwritten.
            setUser(prevUser => ({
              ...(prevUser || {}),
              uid: authUser.uid,
              email: authUser.email,
              displayName: authUser.displayName,
              photoURL: authUser.photoURL,
              ...customerData,
              subscription: prevUser?.subscription || 'free',
            } as UserData));
            
            setLoading(false);

            const subscriptionsRef = collection(db, 'customers', authUser.uid, 'subscriptions');
            const q = query(subscriptionsRef, where("status", "in", ["trialing", "active"]));
            
            unsubscribeSubscriptions = onSnapshot(q, (subscriptionsSnap) => {
              const subscriptionStatus: SubscriptionStatus = subscriptionsSnap.empty ? 'free' : 'subscriber';
              
              setUser(prevUser => {
                  if (!prevUser || prevUser.subscription === subscriptionStatus) return prevUser;
                  return { ...prevUser, subscription: subscriptionStatus };
              });
            });

          }
        }, (error) => {
          console.error("Auth Hook Firestore Error:", error);
          setUser(null);
          setLoading(false);
        });

      } else {
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