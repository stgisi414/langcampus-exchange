import { useState, useEffect } from 'react';
import { onAuthStateChanged, User as AuthUser } from 'firebase/auth';
import { doc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig.ts';
import { initializeUserProfile } from '../services/firestoreService.ts';
import { UserData } from '../types.ts';

export const useAuth = () => {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeSnapshot: Unsubscribe | undefined;

    // This is the primary listener for authentication status.
    const unsubscribeAuth = onAuthStateChanged(auth, (authUser) => {
      // If we were previously listening to a Firestore document, stop now.
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
      }

      if (authUser) {
        // A user is authenticated. Now, we'll listen for their data.
        const userRef = doc(db, 'customers', authUser.uid);

        unsubscribeSnapshot = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            // The user's document exists in Firestore.
            // Ensure our app-specific fields are initialized.
            initializeUserProfile(authUser.uid, authUser);
            // Set the user state with the full data.
            setUser({ uid: authUser.uid, ...docSnap.data() } as UserData);
          } else {
            // This is a new user. The Stripe extension hasn't created their
            // document yet. We'll create a temporary local user object so the
            // app doesn't think they're logged out. The listener will
            // automatically update this with real data once it's available.
             setUser({
                uid: authUser.uid,
                email: authUser.email,
                displayName: authUser.displayName,
                photoURL: authUser.photoURL,
                subscription: 'free',
                // Provide default empty values for other fields
                usage: { searches: 0, messages: 0, audioPlays: 0, lessons: 0, quizzes: 0, lastUsageDate: '' },
                name: authUser.displayName || '',
                hobbies: '',
                bio: '',
                savedChat: null,
             });
          }
        }, (error) => {
          // Handle any errors from Firestore.
          console.error("Auth Hook Firestore Error:", error);
          setUser(null);
        });
      } else {
        // No user is authenticated.
        setUser(null);
      }

      // **THE CRITICAL FIX**: The initial auth check is complete.
      // We can now stop the main loading spinner.
      setLoading(false);
    });

    // Cleanup function runs when the app unmounts
    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
      }
    };
  }, []); // The empty dependency array is crucial.

  return { user, loading };
};