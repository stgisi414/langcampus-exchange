// This interface represents the structure of a subscription document
// that the Stripe Extension creates in Firestore.
export interface Subscription {
  id: string;
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid';
  // Add other fields from the extension as needed
  role: string;
  // Timestamps can be included if you need them
  // created: { seconds: number; nanoseconds: number; };
}

export interface UserProfileData {
  name: string;
  hobbies: string;
  bio: string;
  contentPreference: 'standard' | 'pg13' | 'r21plus';
  age: number;
  rank: string;
}

export interface Partner {
  name: string;
  avatar: string;
  nativeLanguage: string;
  learningLanguage: string;
  interests: string[];
  gender: 'male' | 'female';
}

export interface Message {
  id: string; // Add a unique ID for each message
  sender: 'user' | 'ai';
  senderId?: string;
  senderName?: string;
  text: string;
  correction?: string;
  translation?: string;
  audioUrl?: string;
  audioDuration?: number;
  timestamp?: number;
  replyTo?: { // Add this optional object
    messageId: string;
    text: string;
    senderName?: string;
  };
}

export interface Flashcard {
    id: string;
    term: string; // The word/phrase in the target language
    translation?: string; // Translation in native language
    definition?: string; // Definition in target language (maybe simplified)
    imageUrl?: string; // URL for the generated image
    sentence?: string; // ADDED: Example sentence in target language
    sentenceWithBlank?: string;
}

export type QuizQuestion = {
  type: 'multiple-choice';
  question: string;
  options: string[];
  correctAnswer: string;
} | {
  type: 'matching';
  question: string;
  pairs: { term: string; definition: string }[];
} | {
  type: 'fill-in-the-blank';
  question: string; // The sentence with a blank, e.g., "I ___ to the store."
  correctAnswer: string;
} | {
  type: 'speaking';
  question: string; // The instruction text
  sentenceToRead: string; // The actual sentence to read
} | {
  type: 'listening';
  question: string; // The text to be synthesized into speech
  correctAnswer: string; // The text the user should transcribe
  sentenceToRead: string; // The actual sentence to read
};

export interface YouTubeVideo {
  videoId: string;
  title: string;
  thumbnailUrl: string;
}

export interface YouTubeCache {
  videos: YouTubeVideo[];
  timestamp: number;
}

export interface ValidatedQuizResult {
  userAnswer: string | string[];
  isCorrect: boolean;
}

export interface SavedChat {
  partner: Partner;
  messages: Message[];
}

export interface GroupTeachMeSettings {
  language: string;
  type: TeachMeType;
  level: number;
  topic: string;
}

export interface GroupChat {
  id: string; // Unique ID for the group/websocket room
  creatorId: string; // The UID of the person who started the group (the topic controller)
  partner: Partner; // The bot partner's identity (for UI consistency)
  topic: string | null; // The chosen topic for the group learning, null if not set
  shareLink: string; // The URL to share (mock link for now)
  members: { [key: string]: boolean }; // Stored as a map for efficient lookups
  messages: Message[]; // Stored messages for the chat history
  teachMeContent?: string | null; // <--- Field to store the actual lesson content
  groupTeachMeSettings?: GroupTeachMeSettings | null; // <--- ADDED: Field to store the topic, type, and level
}

export interface Language {
  code: string;
  name: string;
}

export type SubscriptionStatus = 'free' | 'subscriber';

export type UsageKey = 'searches' | 'messages' | 'audioPlays' | 'lessons' | 'quizzes' | 'imagenGenerations';

export interface UsageData {
  searches: number;
  messages: number;
  audioPlays: number;
  lessons: number;
  quizzes: number;
  imagenGenerations: number;
  lastUsageDate: string; // Stored as 'YYYY-MM-DD'
}

export type TeachMeType = 'Grammar' | 'Vocabulary' | 'Conversation';

export interface TeachMeCache {
  language: string;
  type: TeachMeType;
  topic: string;
  content: string;
}

export interface Note {
  id: string;
  text: string;
  topic: string;
  createdAt: number;
}

export interface FlashcardSettings {
  languageCode?: string;
  level?: number;
  topic?: string | null;
  teachMeType?: TeachMeType;
  activityType?: FlashcardActivityType; // Make sure FlashcardActivityType is exported or defined here
  mode?: FlashcardMode; // Make sure FlashcardMode is exported or defined here
  amount?: number;
  translationTargetLanguageCode?: string; // Add this for the new selector
}

export type FlashcardActivityType = 'translation' | 'definition' | 'image' | 'sentence';
export type FlashcardMode = 'study' | 'review';

export interface UserData {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  xp?: number;

  nativeLanguage: string;
  targetLanguage: string;
  
  stripeId?: string; 
  activeSubscription: boolean; 

  usage: UsageData;
  name: string;
  hobbies: string;
  bio: string;
  savedChat: SavedChat | null;
  teachMeCache: TeachMeCache | null;
  activeGroupId: string | null;
  notes?: Note[];

  // --- ADD THESE NEW FIELDS ---
  birthDate?: string; // Stored as 'YYYY-MM-DD'
  isAgeVerified?: boolean;
  contentPreference?: 'standard' | 'pg13' | 'r21plus';

  flashcardSettings?: FlashcardSettings;
}
