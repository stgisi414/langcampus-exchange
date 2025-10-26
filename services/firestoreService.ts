import { doc, getDoc, updateDoc, increment, setDoc, arrayUnion, arrayRemove, deleteField } from "firebase/firestore";
import { User as AuthUser } from "firebase/auth";
import { db } from '../firebaseConfig.ts';
import { UserData, UsageKey, SavedChat, SubscriptionStatus, TeachMeCache, Note, UserProfileData, FlashcardSettings } from '../types.ts';
import { deleteAudioMessage } from './storageService.ts';

const DAILY_LIMITS = {
  searches: 5, // For free users
  messages: 20, // For free users
  audioPlays: 5, // For free users
  lessons: 10, // For free users
  quizzes: 10, // For free users
  imagenGenerations: 30, // For SUBSCRIBERS
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
        imagenGenerations: 0,
        lastUsageDate: getTodayDateString(),
      },
      isAgeVerified: false,
      birthDate: null,
      contentPreference: 'standard',
      flashcardSettings: {},
      nativeLanguage: LANGUAGES[0].code, // Initialize with defaults
      targetLanguage: LANGUAGES[1].code, // Initialize with defaults
      activeSubscription: false, // Initialize activeSubscription
    };
    await setDoc(userRef, newUserProfile, { merge: true }); // Use merge to be safe with stripe extension
  } else {
    const data = docSnap.data();
    const updates: { [key: string]: any } = {}; // Use a flexible type for updates

    // Ensure usage object and imagenGenerations exist
    if (!data.usage) {
        updates['usage'] = { // Initialize the whole usage object if missing
             searches: 0, messages: 0, audioPlays: 0, lessons: 0, quizzes: 0, imagenGenerations: 0, lastUsageDate: getTodayDateString()
        };
    } else if (data.usage.imagenGenerations === undefined) {
         updates['usage.imagenGenerations'] = 0; // Initialize just imagenGenerations
    }
     if (!data.usage?.lastUsageDate && !updates['usage']) { // Check if date is missing and usage wasn't just added
        updates['usage.lastUsageDate'] = getTodayDateString();
    }

    // ... (rest of the migration logic for age verification, etc.) ...
    if (data.isAgeVerified === undefined) updates.isAgeVerified = false;
    if (data.birthDate === undefined) updates.birthDate = null;
    if (data.contentPreference === undefined) updates.contentPreference = 'standard';
    if (data.flashcardSettings === undefined) updates.flashcardSettings = {};


    if (Object.keys(updates).length > 0) {
        await updateDoc(userRef, updates);
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

export const updateUserProfile = async (userId: string, profileData: Partial<UserProfileData>) => {
  const userRef = doc(db, "customers", userId); // Target 'customers' collection
  const updateData: Partial<UserData> = {
      ...(profileData.name !== undefined && { name: profileData.name }),
      ...(profileData.hobbies !== undefined && { hobbies: profileData.hobbies }),
      ...(profileData.bio !== undefined && { bio: profileData.bio }),
      ...(profileData.contentPreference !== undefined && { contentPreference: profileData.contentPreference }),
  };
  await updateDoc(userRef, updateData);
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
    const audioUrlsToDelete = messages.map((m: any) => m.audioUrl).filter((url: string | undefined): url is string => !!url); // Type assertion

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
    const userRef = doc(db, "customers", userId);
    const docSnap = await getDoc(userRef);

    if (!docSnap.exists()) {
        console.error("Customer document not found. Usage check cannot proceed.");
        return false; // Cannot proceed if user document doesn't exist
    }

    const userData = docSnap.data() as UserData;
    const today = getTodayDateString();

    // Initialize usage in memory if missing
    const usage = userData.usage || {
        searches: 0, messages: 0, audioPlays: 0, lessons: 0, quizzes: 0, imagenGenerations: 0, lastUsageDate: '1970-01-01'
    };
    if (usage.imagenGenerations === undefined) usage.imagenGenerations = 0; // Ensure field exists

    // Reset counts if it's a new day
    if (usage.lastUsageDate !== today) {
        const resetUsage = {
            "usage.searches": 0,
            "usage.messages": 0,
            "usage.audioPlays": 0,
            "usage.lessons": 0,
            "usage.quizzes": 0,
            "usage.imagenGenerations": 0,
            "usage.lastUsageDate": today,
        };
        await updateDoc(userRef, resetUsage);
        // Update in-memory copy
        Object.assign(usage, { searches: 0, messages: 0, audioPlays: 0, lessons: 0, quizzes: 0, imagenGenerations: 0, lastUsageDate: today });
    }

    const currentUsage = usage[feature] ?? 0;
    let limit = Infinity; // Default to unlimited

    // Apply limits based on subscription status
    if (subscriptionStatus === 'subscriber') {
        // Subscribers ONLY have a limit for 'imagenGenerations'
        if (feature === 'imagenGenerations') {
            limit = DAILY_LIMITS.imagenGenerations;
        }
    } else { // Free users
        // Free users have limits for features OTHER THAN 'imagenGenerations'
        if (feature !== 'imagenGenerations') {
            limit = DAILY_LIMITS[feature as Exclude<UsageKey, 'imagenGenerations'>];
        } else {
             // Free users technically shouldn't reach imagen generation, but if they do, block it.
             limit = 0;
        }
    }

    // Check against the determined limit
    if (currentUsage >= limit) {
        console.log(`Usage limit reached for ${feature} (Status: ${subscriptionStatus}). Current: ${currentUsage}, Limit: ${limit}`);
        return false; // Limit reached
    }

    // If within limit, increment the count
    try {
        await updateDoc(userRef, {
            [`usage.${feature}`]: increment(1)
        });
        return true; // Can proceed
    } catch (error) {
        console.error(`Error incrementing usage for ${feature}:`, error);
        return false; // Increment failed, block the action
    }
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

export const saveFlashcardSettings = async (userId: string, settings: FlashcardSettings) => {
  const userRef = doc(db, "customers", userId);
  await updateDoc(userRef, { flashcardSettings: settings });
};