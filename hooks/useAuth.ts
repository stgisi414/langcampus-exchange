import { useState, useEffect } from 'react';
import { onAuthStateChanged, User as AuthUser } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig.ts';
import { createUserProfile } from '../services/firestoreService.ts';
import { UserData } from '../types.ts';

export const useAuth = () => {
  const [user, setUser] = useState<UserData | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentAuthUser) => {
      if (currentAuthUser) {
        await createUserProfile(currentAuthUser); // Ensure profile exists
        setAuthUser(currentAuthUser);
      } else {
        setAuthUser(null);
        setUser(null);
        setLoading(false);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (authUser) {
      const userRef = doc(db, 'users', authUser.uid);
      const unsubscribeSnapshot = onSnapshot(userRef, (docSnap) => {
        if (docSnap.exists()) {
          setUser(docSnap.data() as UserData);
        } else {
          setUser(null);
        }
        setLoading(false);
      });
      return () => unsubscribeSnapshot();
    }
  }, [authUser]);

  return { user, loading };
};