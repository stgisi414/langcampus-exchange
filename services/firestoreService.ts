import { doc, getDoc, setDoc, updateDoc, increment } from "firebase/firestore";
import { User } from "firebase/auth";
import { db } from '../firebaseConfig.ts';
import { UserData, UsageKey } from '../types.ts';

const DAILY_LIMITS = {
  searches: 5,
  messages: 20,
  audioPlays: 5,
  lessons: 10,
  quizzes: 10,
};

// Gets today's date in 'YYYY-MM-DD' format
const getTodayDateString = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Creates a new user document in Firestore the first time they log in
export const createUserProfile = async (user: User): Promise<UserData> => {
  const userRef = doc(db, "users", user.uid);
  const docSnap = await getDoc(userRef);

  if (!docSnap.exists()) {
    const newUserProfile: UserData = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      subscription: 'free',
      usage: {
        searches: 0,
        messages: 0,
        audioPlays: 0,
        lessons: 0,
        quizzes: 0,
        lastUsageDate: getTodayDateString(),
      },
      name: user.displayName || '',
      hobbies: '',
      bio: '',
      savedChat: null,
    };
    await setDoc(userRef, newUserProfile);
    return newUserProfile;
  }
  return docSnap.data() as UserData;
};

export const updateUserProfile = async (userId: string, profileData: { name: string; hobbies: string; bio: string; }) => {
  const userRef = doc(db, "users", userId);
  await updateDoc(userRef, {
    name: profileData.name,
    hobbies: profileData.hobbies,
    bio: profileData.bio,
  });
};

export const saveChatInFirestore = async (userId: string, chat: SavedChat) => {
  const userRef = doc(db, "users", userId);
  await updateDoc(userRef, { savedChat: chat });
};

export const deleteChatFromFirestore = async (userId: string) => {
  const userRef = doc(db, "users", userId);
  await updateDoc(userRef, { savedChat: null });
};

// Checks if a user can use a feature and increments the count if they can
export const checkAndIncrementUsage = async (userId: string, feature: UsageKey): Promise<boolean> => {
  const userRef = doc(db, "users", userId);
  const docSnap = await getDoc(userRef);

  if (!docSnap.exists()) {
    throw new Error("User not found in database.");
  }

  const userData = docSnap.data() as UserData;

  // Subscribers have unlimited access
  if (userData.subscription === 'subscriber') {
    return true;
  }

  const today = getTodayDateString();
  
  // If the last usage was yesterday, reset the daily counts
  if (userData.usage.lastUsageDate !== today) {
    await updateDoc(userRef, {
      "usage.searches": 0,
      "usage.messages": 0,
      "usage.audioPlays": 0,
      "usage.lessons": 0,
      "usage.quizzes": 0,
      "usage.lastUsageDate": today,
    });
    // After resetting, the count for the current feature will be 0, so we can proceed.
    userData.usage = { ...userData.usage, searches: 0, messages: 0, audioPlays: 0, lessons: 0, quizzes: 0, lastUsageDate: today };
  }

  const currentUsage = userData.usage[feature];
  const limit = DAILY_LIMITS[feature];

  if (currentUsage >= limit) {
    console.log(`Usage limit reached for ${feature}.`);
    return false; // Limit reached
  }

  // Increment the specific feature's usage count
  await updateDoc(userRef, {
    [`usage.${feature}`]: increment(1)
  });

  return true; // Limit not reached
};