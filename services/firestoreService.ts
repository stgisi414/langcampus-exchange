import { doc, getDoc, updateDoc, increment, setDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { User } from "firebase/auth";
import { db } from '../firebaseConfig.ts';
import { UserData, UsageKey, SavedChat, SubscriptionStatus, TeachMeCache, Note, UserProfileData } from '../types.ts';
import { deleteAudioMessage } from './storageService.ts';

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
 * This function will now only add fields if they don't already exist.
 */
export const initializeUserProfile = async (uid: string, user: AuthUser) => {
  const userRef = doc(db, "customers", uid);
  const docSnap = await getDoc(userRef);

  if (!docSnap.exists()) {
    // This is a brand new user. Create the full document.
    const newUserProfile = {
      name: user.displayName || '',
      hobbies: '',
      bio: '',
      savedChat: null,
      teachMeCache: null,
      notes: [],
      xp: 0,
      usage: {
        searches: 0,
        messages: 0,
        audioPlays: 0,
        lessons: 0,
        quizzes: 0,
        lastUsageDate: getTodayDateString(),
      },
      isAgeVerified: false,
      birthDate: null,
      contentPreference: 'standard',
    };
    await setDoc(userRef, newUserProfile, { merge: true }); // Use merge to be safe with stripe extension
  } else {
    // This is a returning user. Check if they need to be migrated.
    const data = docSnap.data();
    if (data.isAgeVerified === undefined || data.birthDate === undefined || data.contentPreference === undefined) {
      // User exists but is missing the new fields. Update them.
      await updateDoc(userRef, {
        isAgeVerified: data.isAgeVerified || false,
        birthDate: data.birthDate || null,
        contentPreference: data.contentPreference || 'standard',
      });
    }
  }
};

/**
 * Saves the user's birthdate and sets their age verification status to true.
 * @param userId The UID of the user.
 * @param birthDate The user's birthdate in 'YYYY-MM-DD' format.
 */
export const saveAgeVerification = async (userId: string, birthDate: string) => {
  const userRef = doc(db, "customers", userId);
  await updateDoc(userRef, {
    birthDate: birthDate,
    isAgeVerified: true,
  });
};

/**
 * Adds a specified amount of XP to a user's profile.
 * @param userId The UID of the user.
 * @param amount The amount of XP to add.
 */
export const addXp = async (userId: string, amount: number) => {
  if (amount <= 0) return;
  const userRef = doc(db, "customers", userId);
  await updateDoc(userRef, {
    xp: increment(amount)
  });
};

export const updateUserProfile = async (userId: string, profileData: UserProfileData) => {
  const userRef = doc(db, "customers", userId); // Target 'customers' collection
  await updateDoc(userRef, {
    name: profileData.name,
    hobbies: profileData.hobbies,
    bio: profileData.bio,
    contentPreference: profileData.contentPreference,
  });
};

export const saveChatInFirestore = async (userId: string, chat: SavedChat) => {
  const userRef = doc(db, "customers", userId); // Target 'customers' collection
  await updateDoc(userRef, { savedChat: chat });
};

export const deleteChatFromFirestore = async (userId: string) => {
  const userRef = doc(db, "customers", userId);
  const docSnap = await getDoc(userRef);
  
  if (docSnap.exists() && docSnap.data()?.savedChat?.messages) {
    // 1. Get audio URLs from saved chat messages
    const messages = docSnap.data()!.savedChat.messages;
    const audioUrlsToDelete = messages.map((m: any) => m.audioUrl).filter((url: string | undefined) => !!url);
    
    // 2. Delete the files from storage concurrently
    const deletePromises = audioUrlsToDelete.map((url: string) => deleteAudioMessage(url));
    await Promise.all(deletePromises);
  }

  // 3. Clear the chat document field
  await updateDoc(userRef, { savedChat: null });
};

export const updateLanguagePreference = async (
  userId: string, 
  field: 'nativeLanguage' | 'targetLanguage', 
  value: string
) => {
  const userRef = doc(db, "customers", userId);
  await updateDoc(userRef, {
    [field]: value,
  });
};

export const saveTeachMeCacheInFirestore = async (userId: string, cache: TeachMeCache) => {
  const userRef = doc(db, "customers", userId);
  await updateDoc(userRef, { teachMeCache: cache });
};

// New function to clear the Teach Me cache
export const deleteTeachMeCacheFromFirestore = async (userId: string) => {
  const userRef = doc(db, "customers", userId);
  await updateDoc(userRef, { teachMeCache: null });
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

export const addNoteToFirestore = async (userId: string, note: Note) => {
  const userRef = doc(db, "customers", userId);
  await updateDoc(userRef, {
    notes: arrayUnion(note)
  });
};

export const deleteNoteFromFirestore = async (userId: string, noteId: string) => {
  const userRef = doc(db, "customers", userId);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
    const userData = userSnap.data() as UserData;
    const noteToDelete = userData.notes?.find(n => n.id === noteId);
    if (noteToDelete) {
      await updateDoc(userRef, {
        notes: arrayRemove(noteToDelete)
      });
    }
  }
};

export const reorderNotesInFirestore = async (userId: string, newNotes: Note[]) => {
  const userRef = doc(db, "customers", userId);
  // Overwrite the existing notes array with the newly ordered array
  await updateDoc(userRef, {
    notes: newNotes
  });
};