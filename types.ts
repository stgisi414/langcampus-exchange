export interface UserProfileData {
  name: string;
  hobbies: string;
  bio: string;
}

export interface Partner {
  name: string;
  avatar: string;
  nativeLanguage: string;
  learningLanguage: string;
  interests: string[];
}

export interface Message {
  sender: 'user' | 'ai';
  text: string;
  correction?: string;
  translation?: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
}

export interface SavedChat {
  partner: Partner;
  messages: Message[];
}

export interface Language {
  code: string;
  name: string;
}

export type SubscriptionStatus = 'free' | 'subscriber';

export type UsageKey = 'searches' | 'messages' | 'audioPlays' | 'lessons' | 'quizzes';

export interface UsageData {
  searches: number;
  messages: number;
  audioPlays: number;
  lessons: number;
  quizzes: number;
  lastUsageDate: string; // Stored as 'YYYY-MM-DD'
}

export interface UserData {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  subscription: SubscriptionStatus;
  usage: UsageData;
  // Merged from UserProfileData
  name: string;
  hobbies: string;
  bio: string;
  // Added for persistence
  savedChat: SavedChat | null;
}