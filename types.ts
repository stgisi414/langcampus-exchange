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
  audioUrl?: string; 
  audioDuration?: number;
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

export interface GroupChat {
  id: string; // Unique ID for the group/websocket room
  creatorId: string; // The UID of the person who started the group (the topic controller)
  partner: Partner; // The bot partner's identity (for UI consistency)
  topic: string | null; // The chosen topic for the group learning, null if not set
  shareLink: string; // The URL to share (mock link for now)
  members: string[]; // List of member UIDs
  messages: Message[]; // Stored messages for the chat history
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
  teachMeCache: TeachMeCache | null;
  activeGroupId: string | null;
}
