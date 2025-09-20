
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
