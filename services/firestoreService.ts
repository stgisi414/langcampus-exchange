import { doc, getDoc, updateDoc, increment, setDoc } from "firebase/firestore";
import { User } from "firebase/auth";
import { db } from '../firebaseConfig.ts';
import { UserData, UsageKey, SavedChat, SubscriptionStatus } from '../types.ts';

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

/**
 * Initializes or creates our app-specific fields on a user's document in the 'customers' collection.
 * This function will now only add the 'usage' field if it doesn't already exist.
 */
export const initializeUserProfile = async (uid: string, user: User) => {
  const userRef = doc(db, "customers", uid);
  const docSnap = await getDoc(userRef);

  if (!docSnap.exists() || !docSnap.data().usage) {
    // If the document doesn't exist OR it exists but is missing the usage field,
    // then we create/update it with the initial usage data.
    await setDoc(userRef, {
      name: docSnap.data()?.name || user.displayName || '',
      hobbies: docSnap.data()?.hobbies || '',
      bio: docSnap.data()?.bio || '',
      savedChat: docSnap.data()?.savedChat || null,
      usage: {
        searches: 0,
        messages: 0,
        audioPlays: 0,
        lessons: 0,
        quizzes: 0,
        lastUsageDate: getTodayDateString(),
      },
    }, { merge: true });
  }
  // If the document and the usage field already exist, we do nothing.
};


export const updateUserProfile = async (userId: string, profileData: { name: string; hobbies: string; bio: string; }) => {
  const userRef = doc(db, "customers", userId); // Target 'customers' collection
  await updateDoc(userRef, {
    name: profileData.name,
    hobbies: profileData.hobbies,
    bio: profileData.bio,
  });
};

export const saveChatInFirestore = async (userId: string, chat: SavedChat) => {
  const userRef = doc(db, "customers", userId); // Target 'customers' collection
  await updateDoc(userRef, { savedChat: chat });
};

export const deleteChatFromFirestore = async (userId: string) => {
  const userRef = doc(db, "customers", userId); // Target 'customers' collection
  await updateDoc(userRef, { savedChat: null });
};

// Checks and increments usage, now aware that usage might need initialization
export const checkAndIncrementUsage = async (userId: string, feature: UsageKey, subscriptionStatus: SubscriptionStatus): Promise<boolean> => {
    // First, check if the user is a subscriber. If so, always allow the action.
    if (subscriptionStatus === 'subscriber') {
        return true;
    }

    // If they are a free user, proceed with the original limit check.
    const userRef = doc(db, "customers", userId);
    const docSnap = await getDoc(userRef);

    if (!docSnap.exists()) {
        console.error("Customer document not found. Usage check cannot proceed.");
        return false;
    }

    const userData = docSnap.data() as UserData;
    const today = getTodayDateString();
    
    // Initialize usage in memory if it's missing from the document
    const usage = userData.usage || {
        searches: 0, messages: 0, audioPlays: 0, lessons: 0, quizzes: 0, lastUsageDate: '1970-01-01'
    };

    // If the last usage was before today, reset the counts in Firestore
    if (usage.lastUsageDate !== today) {
        const resetUsage = {
            "usage.searches": 0,
            "usage.messages": 0,
            "usage.audioPlays": 0,
            "usage.lessons": 0,
            "usage.quizzes": 0,
            "usage.lastUsageDate": today,
        };
        await updateDoc(userRef, resetUsage);
        // Also update our in-memory copy so the check below works correctly
        Object.assign(usage, { searches: 0, messages: 0, audioPlays: 0, lessons: 0, quizzes: 0, lastUsageDate: today });
    }

    const currentUsage = usage[feature];
    const limit = DAILY_LIMITS[feature];

    if (currentUsage >= limit) {
        console.log(`Usage limit reached for ${feature}.`);
        return false;
    }

    // Increment the specific feature's count in Firestore
    await updateDoc(userRef, {
        [`usage.${feature}`]: increment(1)
    });

    return true;
};