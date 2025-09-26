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

export interface TeachMeCache {
  language: string;
  type: string;
  topic: string;
  content: string;
}

export interface UserData {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  
  // This field is added by the Stripe extension
  stripeId?: string; 
  
  // This will be populated by our useAuth hook from the 'subscriptions' subcollection
  activeSubscription: boolean; 

  usage: UsageData;
  name: string;
  hobbies: string;
  bio: string;
  savedChat: SavedChat | null;
  teachMeCache: TeachMeCache | null; // Add this line
}
