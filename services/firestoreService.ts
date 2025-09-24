import { doc, getDoc, updateDoc, increment } from "firebase/firestore";
import { User } from "firebase/auth";
import { db } from '../firebaseConfig.ts';
import { UserData, UsageKey, SavedChat } from '../types.ts';

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
 * Initializes our app-specific fields on a user's document in the 'customers' collection.
 * This is safe to call multiple times, as it only adds fields if they are missing.
 * We let the Stripe Extension create the document, and we enrich it with this function.
 */
export const initializeUserProfile = async (uid: string, user: User) => {
  const userRef = doc(db, "customers", uid); // Target 'customers' collection
  const docSnap = await getDoc(userRef);

  if (docSnap.exists()) {
    const data = docSnap.data();
    // Check if our app-specific fields are missing, and if so, add them.
    if (data.usage === undefined || data.name === undefined) {
      await updateDoc(userRef, {
        name: data.name || user.displayName || '',
        hobbies: data.hobbies || '',
        bio: data.bio || '',
        savedChat: data.savedChat || null,
        // Initialize usage stats for a new user
        usage: data.usage || {
          searches: 0,
          messages: 0,
          audioPlays: 0,
          lessons: 0,
          quizzes: 0,
          lastUsageDate: getTodayDateString(),
        },
      });
    }
  }
  // If the document doesn't exist yet, we do nothing. The `useAuth` hook's
  // listener will call this function again once the extension creates the doc.
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
    
    const usage = userData.usage || {
        searches: 0, messages: 0, audioPlays: 0, lessons: 0, quizzes: 0, lastUsageDate: '1970-01-01'
    };

    if (usage.lastUsageDate !== today) {
        // Reset usage for the new day
        const resetUsage = {
            "usage.searches": 0,
            "usage.messages": 0,
            "usage.audioPlays": 0,
            "usage.lessons": 0,
            "usage.quizzes": 0,
            "usage.lastUsageDate": today,
        };
        await updateDoc(userRef, resetUsage);
        Object.assign(usage, { searches: 0, messages: 0, audioPlays: 0, lessons: 0, quizzes: 0 });
    }

    const currentUsage = usage[feature];
    const limit = DAILY_LIMITS[feature];

    if (currentUsage >= limit) {
        console.log(`Usage limit reached for ${feature}.`);
        return false;
    }

    await updateDoc(userRef, {
        [`usage.${feature}`]: increment(1)
    });

    return true;
};