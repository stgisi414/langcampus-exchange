// hooks/useAuth.ts

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

    const unsubscribeAuth = onAuthStateChanged(auth, (authUser) => {
      if (unsubscribeCustomer) unsubscribeCustomer();
      if (unsubscribeSubscriptions) unsubscribeSubscriptions();

      if (authUser) {
        const customerRef = doc(db, 'customers', authUser.uid);
        
        unsubscribeCustomer = onSnapshot(customerRef, async (docSnap) => {
          // The line that was here (`setLoading(true);`) has been removed.
          
          if (docSnap.exists()) {
            await initializeUserProfile(authUser.uid, authUser);
            const customerData = docSnap.data();

            const subscriptionsRef = collection(db, 'customers', authUser.uid, 'subscriptions');
            const q = query(subscriptionsRef, where("status", "in", ["trialing", "active"]));
            
            unsubscribeSubscriptions = onSnapshot(q, (subscriptionsSnap) => {
              const subscriptionStatus: SubscriptionStatus = subscriptionsSnap.empty ? 'free' : 'subscriber';
              
              setUser({
                uid: authUser.uid,
                email: authUser.email,
                displayName: authUser.displayName,
                photoURL: authUser.photoURL,
                ...customerData,
                subscription: subscriptionStatus,
              } as UserData);

              // We only set loading to false. We don't set it back to true on subsequent updates.
              setLoading(false); 
            });

          } else {
            // New user, doc doesn't exist yet
            await initializeUserProfile(authUser.uid, authUser);
             setUser({
                uid: authUser.uid,
                email: authUser.email,
                displayName: authUser.displayName,
                photoURL: authUser.photoURL,
                subscription: 'free',
                usage: { searches: 0, messages: 0, audioPlays: 0, lessons: 0, quizzes: 0, lastUsageDate: '' },
                name: authUser.displayName || '',
                hobbies: '',
                bio: '',
                savedChat: null,
             } as UserData);
            setLoading(false);
          }
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