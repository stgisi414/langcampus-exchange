import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { UserProfileData, Partner, Message, QuizQuestion, SavedChat, Language, SubscriptionStatus } from './types';
import { LANGUAGES } from './constants';
import * as geminiService from './services/geminiService';
import { ChevronDownIcon, CloseIcon, InfoIcon, TrashIcon, BookOpenIcon, VolumeUpIcon, SaveIcon, SendIcon, MenuIcon, SearchIcon } from './components/Icons';
import LoadingSpinner from './components/LoadingSpinner';
import { grammarData, vocabData } from './teachMeData';
import { useAuth } from './hooks/useAuth.ts';
import LoginScreen from './components/LoginScreen.tsx';
import { auth } from './firebaseConfig.ts';
import { signOut } from 'firebase/auth';
import { checkAndIncrementUsage } from './services/firestoreService.ts';
import SubscriptionModal from './components/SubscriptionModal.tsx';
import * as firestoreService from './services/firestoreService.ts';
import { loadStripe } from '@stripe/stripe-js';


// Helper for localStorage
const useStickyState = <T,>(defaultValue: T, key: string): [T, React.Dispatch<React.SetStateAction<T>>] => {
  const [value, setValue] = useState<T>(() => {
    const stickyValue = window.localStorage.getItem(key);
    return stickyValue !== null ? JSON.parse(stickyValue) : defaultValue;
  });
  useEffect(() => {
    window.localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);
  return [value, setValue];
};

// Helper function to decode base64 string to ArrayBuffer
const base64ToArrayBuffer = (base64: string) => {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

// Helper function to convert raw PCM audio data to a playable WAV Blob
const pcmToWav = (pcmData: Int16Array, sampleRate: number) => {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcmData.length * (bitsPerSample / 8);
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF header
  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, 36 + dataSize, true);
  view.setUint32(8, 0x57415645, false); // "WAVE"

  // fmt sub-chunk
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true); // Sub-chunk size
  view.setUint16(20, 1, true); // Audio format (1 for PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data sub-chunk
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, dataSize, true);

  // Write PCM data
  const pcm16 = new Int16Array(buffer, 44);
  pcm16.set(pcmData);

  return new Blob([view], { type: 'audio/wav' });
};


// User Profile Component
const UserProfile: React.FC<{
  profile: { name: string; hobbies: string; bio: string; };
  subscriptionStatus: SubscriptionStatus; 
  onProfileChange: (profile: UserProfileData) => void;
  onUpgradeClick: () => void;
  usageData?: UsageData;
  isUpgrading: boolean;
}> = ({ profile, onProfileChange, onUpgradeClick, subscriptionStatus, usageData, isUpgrading }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [localProfile, setLocalProfile] = useState(profile);

  useEffect(() => { setLocalProfile(profile); }, [profile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setLocalProfile({ ...localProfile, [e.target.name]: e.target.value });
  };
  
  const handleSaveAndClose = () => {
    onProfileChange(localProfile);
    setIsOpen(false);
  };

  const handleSignOut = () => {
    if (window.confirm('Are you sure you want to sign out?')) {
        signOut(auth);
    }
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="p-2 rounded-full text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
        aria-label="Open user profile"
      >
        <InfoIcon className="w-6 h-6" />
      </button>
      
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4" role="dialog" aria-modal="true">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md animate-fade-in-down flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">My Info</h2>
                    <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200" aria-label="Close profile editor">
                        <CloseIcon className="w-6 h-6" />
                    </button>
                </div>
                <div className="overflow-y-auto">
                    <div className="p-6 space-y-4">
                      <div>
                        <label htmlFor="name-input" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
                        <input id="name-input" type="text" name="name" value={localProfile.name} onChange={handleChange} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900 dark:text-gray-100" />
                      </div>
                      <div>
                        <label htmlFor="hobbies-input" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Hobbies</label>
                        <input id="hobbies-input" type="text" name="hobbies" value={localProfile.hobbies} onChange={handleChange} placeholder="e.g., hiking, coding, music" className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900 dark:text-gray-100" />
                      </div>
                      <div>
                        <label htmlFor="bio-input" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Bio</label>
                        <textarea id="bio-input" name="bio" rows={3} value={localProfile.bio} onChange={handleChange} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900 dark:text-gray-100"></textarea>
                      </div>
                      <div className="border-t dark:border-gray-700 mt-4 pt-4">
                        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Account Type</h3>
                        <p className={`text-lg font-semibold ${subscriptionStatus === 'subscriber' ? 'text-green-500' : 'text-blue-500'}`}>
                            {subscriptionStatus === 'subscriber' ? 'Langcampus Pro' : 'Free Tier'}
                        </p>
                      </div>
                    </div>
                    {subscriptionStatus === 'free' && usageData && (
                        <div className="px-6 pb-4">
                            <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
                                <h3 className="text-lg font-semibold text-center mb-2 text-gray-800 dark:text-gray-200">Today's Usage</h3>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-gray-600 dark:text-gray-300">
                                    <p>Searches: {usageData.searches}/5</p>
                                    <p>Messages: {usageData.messages}/20</p>
                                    <p>Audio Plays: {usageData.audioPlays}/5</p>
                                    <p>Lessons: {usageData.lessons}/10</p>
                                    <p className="col-span-2 text-center">Quizzes: {usageData.quizzes}/10</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                <div className="flex justify-between p-4 border-t dark:border-gray-700">
                    <button onClick={handleSignOut} className="px-6 py-2 bg-red-500 text-white font-bold rounded-lg hover:bg-red-600 transition-colors">
                        Sign Out
                    </button>
                    {subscriptionStatus === 'subscriber' ? (
                        <button className="px-6 py-2 bg-gray-500 text-white font-bold rounded-lg cursor-not-allowed" disabled>
                            You're a Pro!
                        </button>
                    ) : (
                        <button 
                            onClick={onUpgradeClick} 
                            className="px-6 py-2 bg-green-500 text-white font-bold rounded-lg hover:bg-green-600 disabled:opacity-75"
                            disabled={isUpgrading}
                        >
                            {isUpgrading ? "Redirecting..." : "Upgrade"}
                        </button>
                    )}
                    <button onClick={handleSaveAndClose} className="px-6 py-2 bg-blue-500 text-white font-bold rounded-lg hover:bg-blue-600 transition-colors">
                        Save and Close
                    </button>
                </div>
            </div>
        </div>
      )}
    </>
  );
};

// Partner Card Component
const PartnerCard: React.FC<{
  partner: Partner;
  onStartChat: (partner: Partner) => void;
}> = ({ partner, onStartChat }) => {
    const nativeLangName = LANGUAGES.find(l => l.name === partner.nativeLanguage || l.code.split('-')[0] === partner.nativeLanguage)?.name || partner.nativeLanguage;
    const learningLangName = LANGUAGES.find(l => l.name === partner.learningLanguage || l.code.split('-')[0] === partner.learningLanguage)?.name || partner.learningLanguage;

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden transform hover:-translate-y-1 transition-transform duration-300 flex flex-col">
            <img src={partner.avatar} alt={partner.name} className="w-full h-48 object-cover"/>
            <div className="p-4 flex flex-col flex-grow">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">{partner.name}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Speaks: {nativeLangName}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Learning: {learningLangName}</p>
                <div className="mt-2 flex-grow">
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Interests:</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                        {partner.interests.slice(0, 3).map(interest => (
                            <span key={interest} className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs rounded-full">{interest}</span>
                        ))}
                    </div>
                </div>
                <button onClick={() => onStartChat(partner)} className="mt-4 w-full bg-blue-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors">
                    Start Chat
                </button>
            </div>
        </div>
    );
};

// Tutorial Modal Component
const TutorialModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4" role="dialog" aria-modal="true">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-fade-in-down">
            <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome to Langcampus Exchange!</h2>
                <button onClick={onClose} className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200" aria-label="Close tutorial">
                    <CloseIcon className="w-6 h-6" />
                </button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">
                <p className="text-gray-700 dark:text-gray-300">Here's a quick guide to get you started:</p>
                <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-400">
                    <li><strong>Set Your Languages:</strong> Use the dropdown menus at the top to select your native language and the language you want to learn.</li>
                    <li><strong>Personalize Your Profile:</strong> Click on "My Info" to add your name and hobbies. This helps find partners with similar interests!</li>
                    <li><strong>Find a Partner:</strong> Click the "Find New Pals" button to generate a list of AI language partners.</li>
                    <li><strong>Start Chatting:</strong> Choose a partner and click "Start Chat" to open the conversation window.</li>
                    <li><strong>Use Learning Tools:</strong> Inside the chat, you can toggle "Corrections" for real-time feedback, use the "Teach Me" button for grammar/vocab lessons, and click any message to hear it spoken.</li>
                    <li><strong>Save Your Progress:</strong> Don't want to lose a great conversation? Click the "Save Chat" icon to save it for later.</li>
                </ul>
            </div>
             <div className="flex justify-end p-4 border-t dark:border-gray-700">
                <button onClick={onClose} className="px-6 py-2 bg-blue-500 text-white font-bold rounded-lg hover:bg-blue-600 transition-colors">
                    Got it!
                </button>
            </div>
        </div>
    </div>
);

// Quiz Modal Component
const QuizModal: React.FC<{ 
    questions: QuizQuestion[]; 
    topic: string; 
    onClose: () => void;
    onShareQuizResults: (topic: string, score: number, questions: QuizQuestion[], userAnswers: string[]) => void;
}> = ({ questions, topic, onClose, onShareQuizResults }) => {
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [userAnswers, setUserAnswers] = useState<string[]>([]);
    const [showResults, setShowResults] = useState(false);

    if (!questions || questions.length === 0) {
        return (
             <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl text-center">
                    <p className="text-gray-800 dark:text-gray-200">Could not load quiz questions.</p>
                    <button onClick={onClose} className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">Close</button>
                </div>
            </div>
        );
    }

    const currentQuestion = questions[currentQuestionIndex];
    const score = userAnswers.reduce((acc, answer, index) => acc + (answer === questions[index].correctAnswer ? 1 : 0), 0);
    
    const handleAnswer = (answer: string) => {
        const newAnswers = [...userAnswers];
        newAnswers[currentQuestionIndex] = answer;
        setUserAnswers(newAnswers);

        setTimeout(() => {
            if (currentQuestionIndex < questions.length - 1) {
                setCurrentQuestionIndex(currentQuestionIndex + 1);
            } else {
                setShowResults(true);
            }
        }, 500);
    };

    const handleShare = () => {
        onShareQuizResults(topic, score, questions, userAnswers);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4" role="dialog" aria-modal="true">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-xl max-h-[90vh] flex flex-col animate-fade-in-down">
                <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">{showResults ? 'Quiz Results' : `Quiz: ${topic}`}</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200" aria-label="Close quiz">
                        <CloseIcon className="w-6 h-6" />
                    </button>
                </div>

                {showResults ? (
                    <div className="p-6 text-center space-y-4">
                        <p className="text-2xl text-gray-800 dark:text-gray-200">You scored</p>
                        <p className="text-5xl font-bold text-blue-500">{score} / {questions.length}</p>
                        <div className="mt-4 flex justify-center gap-4">
                            <button onClick={onClose} className="px-6 py-2 bg-gray-500 text-white font-bold rounded-lg hover:bg-gray-600">
                                Finish
                            </button>
                            <button onClick={handleShare} className="px-6 py-2 bg-green-500 text-white font-bold rounded-lg hover:bg-green-600">
                                Discuss with Pal
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="p-6 space-y-4">
                        <p className="text-lg text-gray-800 dark:text-gray-200">Question {currentQuestionIndex + 1} of {questions.length}</p>
                        <p className="text-xl font-semibold text-gray-900 dark:text-white">{currentQuestion.question}</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                            {currentQuestion.options.map((option, index) => {
                                const isSelected = userAnswers[currentQuestionIndex] === option;
                                return (
                                <button
                                    key={index}
                                    onClick={() => handleAnswer(option)}
                                    className={`p-4 rounded-lg text-left transition-colors duration-300 ${
                                        isSelected ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                                    }`}
                                >
                                    {option}
                                </button>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};


// Teach Me Modal Component
const TeachMeModal: React.FC<{ 
    language: string; 
    onClose: () => void; 
    nativeLanguage: string;
    cache: { language: string; type: string; topic: string; content: string; } | null;
    setCache: (cache: { language: string; type: string; topic: string; content: string; } | null) => void;
    onShareQuizResults: (topic: string, score: number, questions: QuizQuestion[], userAnswers: string[]) => void;
    handleUsageCheck: (feature: UsageKey, action: () => void) => Promise<void>;
}> = ({ language, onClose, nativeLanguage, cache, setCache, onShareQuizResults, handleUsageCheck }) => {
    const [activeTab, setActiveTab] = useState<'Grammar' | 'Vocabulary'>('Grammar');
    const [level, setLevel] = useState(1);
    const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
    const [content, setContent] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[] | null>(null);
    const [showQuiz, setShowQuiz] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
      // This effect runs whenever the modal is opened or the language changes.
      // If a valid cache exists for the current language, it loads the lesson.
      if (cache && cache.language === language) {
          setActiveTab(cache.type as 'Grammar' | 'Vocabulary');
          
          const topicData = (cache.type === 'Grammar'
              ? grammarData[language as keyof typeof grammarData]
              : vocabData
          )?.find(t => t.title === cache.topic);

          if (topicData) {
              setLevel(topicData.level);
          }
          setSelectedTopic(cache.topic);
          setContent(cache.content);
      } 
      // Otherwise, it ensures the modal's internal state is cleared.
      else {
          setSelectedTopic(null);
          setContent('');
          setQuizQuestions(null);
          setLevel(1);
      }
    }, [language, cache]);

    const availableTopics = useMemo(() => {
        const data = activeTab === 'Grammar'
            ? grammarData[language as keyof typeof grammarData] || []
            : vocabData;

        if (searchQuery.trim()) {
            const lowercasedQuery = searchQuery.toLowerCase();
            return data.filter(topic =>
                topic.title.toLowerCase().includes(lowercasedQuery) ||
                topic.tags.some(tag => tag.toLowerCase().includes(lowercasedQuery))
            );
        } else {
            return data.filter(topic => topic.level === level);
        }
    }, [activeTab, level, language, searchQuery]);

    const handleTopicSelect = async (topic: string) => {
        handleUsageCheck('lessons', async () => {
            setSelectedTopic(topic);
            setIsLoading(true);
            setContent('');
            setQuizQuestions(null);
            try {
                const nativeLanguageName = LANGUAGES.find(lang => lang.code === nativeLanguage)?.name || nativeLanguage;
                const fetchedContent = await geminiService.getContent(topic, activeTab, language, nativeLanguageName);
                setContent(fetchedContent);
                setCache({ language, type: activeTab, topic, content: fetchedContent });
            } catch (error) {
                setContent('Sorry, there was an error loading the content. Please try again.');
            } finally {
                setIsLoading(false);
            }
        });
    };

    const handleShareAndClose = (topic: string, score: number, questions: QuizQuestion[], userAnswers: string[]) => {
        onShareQuizResults(topic, score, questions, userAnswers);
        onClose(); 
    };

    const handleQuizMe = async () => {
        if (!selectedTopic) return;
        handleUsageCheck('quizzes', async () => {
            setIsLoading(true);
            try {
                const nativeLanguageName = LANGUAGES.find(lang => lang.code === nativeLanguage)?.name || nativeLanguage;
                const questions = await geminiService.generateQuiz(selectedTopic, activeTab, language, nativeLanguageName, level);
                setQuizQuestions(questions);
                setShowQuiz(true);
            } catch (error) {
                alert('Failed to generate quiz. Please try again.');
            } finally {
                setIsLoading(false);
            }
        });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-start pt-10 sm:items-center sm:pt-0 z-50 p-4" role="dialog" aria-modal="true">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[95vw] max-w-4xl h-[90vh] flex flex-col animate-fade-in-down">
                <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
                    <div className="flex items-center gap-2">
                        <button onClick={() => setIsMenuOpen(true)} className="p-1 rounded-md text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 md:hidden" aria-label="Open topics menu">
                            <MenuIcon className="w-6 h-6" />
                        </button>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Teach Me: {language}</h2>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200" aria-label="Close learning module">
                        <CloseIcon className="w-6 h-6" />
                    </button>
                </div>
                <div className="flex-grow flex relative overflow-hidden">
                    {/* Overlay for mobile view */}
                    {isMenuOpen && (
                        <div 
                            onClick={() => setIsMenuOpen(false)} 
                            className="fixed inset-0 bg-black bg-opacity-50 z-10 md:hidden"
                            aria-hidden="true"
                        ></div>
                    )}

                    {/* Left Side Menu (Topics) */}
                    <div className={`absolute top-0 left-0 h-full w-4/5 max-w-sm bg-white dark:bg-gray-800 z-20 transform transition-transform p-4 flex flex-col md:static md:w-1/3 md:translate-x-0 md:border-r md:dark:border-gray-700 ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                        <div className="flex justify-between items-center mb-4 md:hidden">
                            <h3 className="text-lg font-bold">Topics</h3>
                            <button onClick={() => setIsMenuOpen(false)} className="p-1" aria-label="Close topics menu">
                                <CloseIcon className="w-6 h-6" />
                            </button>
                        </div>
                        
                        <div className="relative mb-4">
                            <input
                                type="text"
                                placeholder="Search lessons..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border dark:border-gray-600 rounded-full bg-gray-100 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        </div>

                        {searchQuery.trim() === '' ? (
                            <>
                                <div className="flex border-b dark:border-gray-600 mb-4">
                                     <button onClick={() => setActiveTab('Grammar')} className={`flex-1 py-2 text-center ${activeTab === 'Grammar' ? 'border-b-2 border-blue-500 text-blue-500' : 'text-gray-500'}`}>Grammar</button>
                                     <button onClick={() => setActiveTab('Vocabulary')} className={`flex-1 py-2 text-center ${activeTab === 'Vocabulary' ? 'border-b-2 border-blue-500 text-blue-500' : 'text-gray-500'}`}>Vocabulary</button>
                                </div>
                                <div className="mb-4">
                                    <p className="font-semibold mb-2 text-center">Select Level:</p>
                                    <div className="flex justify-center gap-2">
                                        {[1, 2, 3, 4, 5].map(lvl => (
                                            <button key={lvl} onClick={() => setLevel(lvl)} className={`px-3 py-1 rounded-full text-sm ${level === lvl ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>
                                                {lvl}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </>
                        ) : (
                           <div className="text-center mb-2">
                             <p className="font-semibold">Search Results</p>
                           </div>
                        )}

                        <ul className="space-y-2 overflow-y-auto flex-grow">
                           {availableTopics.length > 0 ? availableTopics.map(topic => (
                                <li key={topic.title}>
                                    <button onClick={() => handleTopicSelect(topic.title)} className={`w-full text-left p-2 rounded text-sm ${selectedTopic === topic.title ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                                        {topic.title}
                                    </button>
                                </li>
                           )) : <p className="text-gray-500 text-center p-4">No topics found.</p>}
                        </ul>
                    </div>
                    
                    {/* Right Side Content */}
                    <div className="w-full p-6 overflow-y-auto">
                        {isLoading && <div className="flex justify-center items-center h-full"><LoadingSpinner /></div>}
                        {!isLoading && content && (
                            <div className="prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: (window as any).marked.parse(content) }}></div>
                        )}
                        {!isLoading && !content && <p className="text-gray-500">Select a topic to begin learning.</p>}
                    </div>
                </div>
                <div className="flex justify-end p-4 border-t dark:border-gray-700">
                    <button onClick={handleQuizMe} disabled={!selectedTopic || isLoading} className="px-6 py-2 bg-green-500 text-white font-bold rounded-lg hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed">
                        Quiz Me!
                    </button>
                </div>
            </div>
            {showQuiz && quizQuestions && <QuizModal questions={quizQuestions} topic={selectedTopic!} onClose={() => setShowQuiz(false)} onShareQuizResults={handleShareAndClose} />}
        </div>
    );
};


// Chat Modal Component
const ChatModal: React.FC<{
  partner: Partner;
  messages: Message[];
  onMessagesChange: React.Dispatch<React.SetStateAction<Message[]>>;
  onClose: () => void;
  onSaveChat: (messages: Message[]) => void;
  nativeLanguage: string; 
  teachMeCache: { language: string; type: string; topic: string; content: string; } | null;
  setTeachMeCache: (cache: { language: string; type: string; topic: string; content: string; } | null) => void;
  onShareQuizResults: (topic: string, score: number, questions: QuizQuestion[], userAnswers: string[]) => void;
  userProfile: UserProfileData;
  handleUsageCheck: (feature: UsageKey, action: () => void) => Promise<void>;
}> = ({ partner, messages, onMessagesChange, onClose, onSaveChat, nativeLanguage, teachMeCache, setTeachMeCache, onShareQuizResults, userProfile, handleUsageCheck }) => {
    const [newMessage, setNewMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [correctionsEnabled, setCorrectionsEnabled] = useState(true);
    const [showTeachMe, setShowTeachMe] = useState(false);
    const chatHistoryRef = useRef<HTMLDivElement>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const isFetchingResponse = useRef(false);

    const getBotResponse = useCallback(async (currentMessages: Message[]) => {
      if (isSending) return;
      setIsSending(true);
      try {
        const aiResponse = await geminiService.getChatResponse(currentMessages, partner, correctionsEnabled, userProfile);
        onMessagesChange(prev => [...prev, aiResponse]);
      } catch (error) {
        console.error(error);
        const errorMessage: Message = { sender: 'ai', text: 'Sorry, I encountered an error. Please try again.' };
        onMessagesChange(prev => [...prev, errorMessage]);
      } finally {
        setIsSending(false);
      }
    }, [partner, correctionsEnabled, userProfile, onMessagesChange]);

    useEffect(() => {
        chatHistoryRef.current?.scrollTo(0, chatHistoryRef.current.scrollHeight);
    }, [messages]);
    
    useEffect(() => {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage?.sender === 'user' && !isFetchingResponse.current) {
        // Lock to prevent duplicate requests
        isFetchingResponse.current = true;
        
        getBotResponse(messages).finally(() => {
          // Unlock after the request is complete (success or fail)
          isFetchingResponse.current = false;
        });
      }
    }, [messages, getBotResponse]);

    useEffect(() => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      if (messages.length === 0 && !isSending) {
        timerRef.current = setTimeout(() => {
          getBotResponse([{ sender: 'user', text: '(Start of conversation)' }]);
        }, 8000);
      }
      return () => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }
      };
    }, [partner, messages, isSending, getBotResponse]);

    const partnerLanguageObject = LANGUAGES.find(lang => 
      lang.name.toLowerCase() === partner.nativeLanguage.toLowerCase()
    ) || LANGUAGES.find(lang => lang.code === 'en-US')!;

    const partnerLanguageName = partnerLanguageObject.name;
    const partnerLanguageCode = partnerLanguageObject.code;

    const handleSpeak = async (text: string) => {
        handleUsageCheck('audioPlays', async () => {
          try {
            const audioContent = await geminiService.synthesizeSpeech(text, partnerLanguageCode);
            const pcmData = base64ToArrayBuffer(audioContent);
            // The Gemini TTS model returns signed 16-bit PCM audio data at a 24000 Hz sample rate.
            const pcm16 = new Int16Array(pcmData);
            const wavBlob = pcmToWav(pcm16, 24000);
            const audioUrl = URL.createObjectURL(wavBlob);
            const audio = new Audio(audioUrl);
            audio.play();
          } catch (error) {
            console.error("Error synthesizing speech:", error);
            // Fallback to browser's built-in speech synthesis
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = partnerLanguageCode;
            window.speechSynthesis.speak(utterance);
          }
        });
    };

    const handleSendMessage = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newMessage.trim() || isSending) return;
      handleUsageCheck('messages', () => {
        const userMessage: Message = { sender: 'user', text: newMessage };
        onMessagesChange(prev => [...prev, userMessage]);
        setNewMessage('');
      });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-start pt-10 sm:items-center sm:pt-0 z-40 p-4" role="dialog" aria-modal="true">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[95vw] max-w-2xl h-[90vh] flex flex-col animate-fade-in-down">
                <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
                    <div className="flex items-center gap-3">
                        <img src={partner.avatar} alt={partner.name} className="w-12 h-12 rounded-full object-cover"/>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">{partner.name}</h2>
                    </div>
                    <div className="flex items-center gap-2">
                         <button onClick={() => onSaveChat(messages)} className="p-2 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200" aria-label="Save chat">
                            <SaveIcon className="w-6 h-6" />
                        </button>
                        <button onClick={() => setShowTeachMe(true)} className="p-2 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200" aria-label="Open learning module">
                            <BookOpenIcon className="w-6 h-6" />
                        </button>
                        <button onClick={onClose} className="p-2 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200" aria-label="Close chat">
                            <CloseIcon className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                <div ref={chatHistoryRef} className="flex-grow p-4 space-y-4 overflow-y-auto bg-gray-50 dark:bg-gray-900">
                    {messages.map((msg, index) => (
                         <div key={index} className={`flex items-end gap-2 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.sender === 'ai' && <img src={partner.avatar} className="w-8 h-8 rounded-full"/>}
                            <div className={`max-w-md p-3 rounded-lg ${msg.sender === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'}`}>
                                <p>{msg.text}</p>
                                {msg.correction && <p className="mt-2 pt-2 border-t border-green-300 dark:border-green-700 text-sm text-green-700 dark:text-green-300">Correction: <em>{msg.correction}</em></p>}
                                {msg.translation && <p className="mt-2 pt-2 border-t border-gray-300 dark:border-gray-600 text-sm text-gray-500 dark:text-gray-400"><em>{msg.translation}</em></p>}
                                <button onClick={() => handleSpeak(msg.text)} className="mt-1 text-xs opacity-60 hover:opacity-100">
                                    <VolumeUpIcon className="w-4 h-4 inline-block"/>
                                </button>
                            </div>
                        </div>
                    ))}
                    {isSending && (
                         <div className="flex items-end gap-2 justify-start">
                            <img src={partner.avatar} className="w-8 h-8 rounded-full"/>
                            <div className="max-w-md p-3 rounded-lg bg-gray-200 dark:bg-gray-700">
                               <LoadingSpinner size="sm" />
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t dark:border-gray-700">
                    <form onSubmit={handleSendMessage} className="flex items-center gap-3">
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Type your message..."
                            className="flex-grow px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100"
                            disabled={isSending}
                        />
                        <button type="submit" className="p-3 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:bg-gray-400" disabled={isSending || !newMessage.trim()}>
                            <SendIcon className="w-6 h-6" />
                        </button>
                    </form>
                    <div className="flex items-center justify-center mt-2">
                        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                            <input type="checkbox" checked={correctionsEnabled} onChange={() => setCorrectionsEnabled(!correctionsEnabled)} className="form-checkbox h-4 w-4 rounded text-blue-600 focus:ring-blue-500" />
                            Enable Corrections
                        </label>
                    </div>
                </div>
            </div>
            {showTeachMe && <TeachMeModal 
                language={partnerLanguageName} 
                onClose={() => setShowTeachMe(false)} 
                nativeLanguage={nativeLanguage}
                cache={teachMeCache}
                setCache={setTeachMeCache}
                onShareQuizResults={onShareQuizResults}
                handleUsageCheck={handleUsageCheck}
            />}
        </div>
    );
};


// Main App Component
const AppContent: React.FC = () => {
  const [nativeLanguage, setNativeLanguage] = useStickyState<string>(LANGUAGES[0].code, 'nativeLanguage');
  const [targetLanguage, setTargetLanguage] = useStickyState<string>(LANGUAGES[1].code, 'targetLanguage');
  const [partners, setPartners] = useState<Partner[]>([]);
  const [isLoadingPartners, setIsLoadingPartners] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPartner, setCurrentPartner] = useState<Partner | null>(null);
  const [currentChatMessages, setCurrentChatMessages] = useState<Message[]>([]);
  const [showTutorial, setShowTutorial] = useStickyState<boolean>(true, 'showTutorial');
  const [teachMeCache, setTeachMeCache] = useState<{ language: string; type: string; topic: string; content: string; } | null>(null);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [subscriptionModalReason, setSubscriptionModalReason] = useState<'limit' | 'manual'>('limit');
  const [isUpgrading, setIsUpgrading] = useState(false);
  const { user } = useAuth();

  const handleUsageCheck = async (feature: UsageKey, action: () => void) => {
    if (!user) return;
    const canProceed = await checkAndIncrementUsage(user.uid, feature);
    if (canProceed) {
      action();
    } else {
      setSubscriptionModalReason('limit'); // Set the reason here
      setShowSubscriptionModal(true);
    }
  };

  useEffect(() => {
    // When the user changes their target language,
    // clear out the old partners and the cached lesson content
    // to avoid showing stale information.
    setPartners([]);
    setTeachMeCache(null);
  }, [targetLanguage]);


  const findPartners = async () => {
    handleUsageCheck('searches', async () => {
        setIsLoadingPartners(true);
        setError(null);
        setPartners([]);
        try {
            const nativeLangName = LANGUAGES.find(l => l.code === nativeLanguage)?.name || nativeLanguage;
            const targetLangName = LANGUAGES.find(l => l.code === targetLanguage)?.name || targetLanguage;
            const generatedPartners = await geminiService.generatePartners(nativeLangName, targetLangName, userProfile.hobbies);
            setPartners(generatedPartners);
        } catch (err: any) {
            setError(err.message || "An unknown error occurred.");
        } finally {
            setIsLoadingPartners(false);
        }
    });
  };

  const handleStartChat = (partner: Partner) => {
    setCurrentPartner(partner);
    if (savedChat && savedChat.partner.name === partner.name) {
      setCurrentChatMessages(savedChat.messages);
    } else {
      setCurrentChatMessages([]);
    }
  };

  const handleCloseChat = () => setCurrentPartner(null);

  const handleProfileChange = (profile: { name: string; hobbies: string; bio: string; }) => {
    if (user) {
      // Corrected to use firestoreService
      firestoreService.updateUserProfile(user.uid, profile);
    }
  };

  const handleSaveChat = (messages: Message[]) => {
    if (currentPartner && user) {
        // Sanitize messages to remove any undefined fields before saving to Firestore
        const sanitizedMessages = messages.map(msg => {
            const sanitizedMsg: Message = {
                sender: msg.sender,
                text: msg.text,
            };
            // Only include correction and translation if they exist
            if (msg.correction) {
                sanitizedMsg.correction = msg.correction;
            }
            if (msg.translation) {
                sanitizedMsg.translation = msg.translation;
            }
            return sanitizedMsg;
        });

        const chatToSave = { partner: currentPartner, messages: sanitizedMessages };
        firestoreService.saveChatInFirestore(user.uid, chatToSave);
        alert('Chat saved!');
    }
  };
  
  const handleDeleteSavedChat = () => {
      if (user && window.confirm('Are you sure you want to delete this saved chat?')) {
          firestoreService.deleteChatFromFirestore(user.uid);
      }
  };
  
  const handleResumeChat = () => {
    if (savedChat) {
        setCurrentPartner(savedChat.partner);
        setCurrentChatMessages(savedChat.messages);
    }
  };
  
  const handleShareQuizResults = (topic: string, score: number, questions: QuizQuestion[], userAnswers: string[]) => {
    let quizSummary = `I just took a quiz on "${topic}" and my score was ${score}/${questions.length}.`;
    
    if (score < questions.length) {
      quizSummary += "\n\nHere are the questions I got wrong:\n";
      questions.forEach((q, index) => {
        if (userAnswers[index] !== q.correctAnswer) {
          quizSummary += `- Question: "${q.question}"\n  - My answer: "${userAnswers[index] || 'No answer'}"\n  - Correct answer: "${q.correctAnswer}"\n`;
        }
      });
      quizSummary += "\nCan you help me understand my mistakes?";
    } else {
      quizSummary += " I got a perfect score! Let's talk about something related to this topic.";
    }

    const quizMessage: Message = { sender: 'user', text: quizSummary };
    
    setCurrentChatMessages(prev => [...prev, quizMessage]);
    if (!currentPartner) {
        const partnerToChatWith = savedChat?.partner || partners[0];
        if(partnerToChatWith) setCurrentPartner(partnerToChatWith);
    }
  };

  const userProfile = {
    name: user?.name || '',
    hobbies: user?.hobbies || '',
    bio: user?.bio || ''
  };

  const savedChat = user?.savedChat || null;

  const handleUpgrade = async () => {
    if (!user) return;
    setIsUpgrading(true);

    try {
        const stripePromise = loadStripe(process.env.VITE_STRIPE_PUBLISHABLE_KEY!);
        //const functionUrl = "https://us-central1-langcampus-exchange.cloudfunctions.net/createStripeCheckout";
        const functionUrl =
        process.env.NODE_ENV === 'development'
          ? "http://127.0.0.1:5001/langcampus-exchange/us-central1/createStripeCheckout"
          : "https://us-central1-langcampus-exchange.cloudfunctions.net/createStripeCheckout";
        
        const response = await fetch(functionUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: { userId: user.uid, userEmail: user.email } }),
        });

        const { sessionId, error } = await response.json();

        if (error) {
            throw new Error(error);
        }

        const stripe = await stripePromise;
        if (stripe) {
            await stripe.redirectToCheckout({ sessionId });
        } else {
            throw new Error("Stripe.js failed to load.");
        }

    } catch (error) {
        console.error("Upgrade Error:", error);
        alert("Could not connect to the payment gateway. Please try again later.");
    } finally {
        setIsUpgrading(false);
    }
  };

  useEffect(() => {
    // Check for a successful checkout redirect from Stripe
    const query = new URLSearchParams(window.location.search);
    if (query.get("checkout_success")) {
      alert("Your subscription is complete! Welcome to Langcampus Pro.");
      // Clean the URL to prevent the message from showing on refresh
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans">
      <header className="bg-white dark:bg-gray-800 shadow-md p-4 flex flex-col md:flex-row justify-between items-center gap-4">
        <h1 className="text-3xl font-bold text-blue-600 dark:text-blue-400 flex items-center">
          <img src="/logo.png" alt="Langcampus Exchange Logo" className="h-16 w-16 mr-3" />
          Langcampus Exchange
        </h1>
        <div className="flex flex-wrap items-center justify-center md:justify-end gap-4">
           <LanguageSelector label="I speak:" value={nativeLanguage} onChange={setNativeLanguage} options={LANGUAGES} />
           <LanguageSelector label="I want to learn:" value={targetLanguage} onChange={setTargetLanguage} options={LANGUAGES} />
           <button onClick={findPartners} disabled={isLoadingPartners} className="px-6 py-2 bg-blue-500 text-white font-bold rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed">
            {isLoadingPartners ? 'Searching...' : 'Find New Pals'}
          </button>
          <UserProfile profile={userProfile} onProfileChange={handleProfileChange} onUpgradeClick={() => { setSubscriptionModalReason('manual'); setShowSubscriptionModal(true); }} subscriptionStatus={user?.subscription || 'free'} usageData={user?.usage} isUpgrading={isUpgrading} />
        </div>
      </header>

      <main className="p-4 sm:p-8">
        {showTutorial && (
            <div className="bg-blue-100 dark:bg-blue-900 border-l-4 border-blue-500 text-blue-700 dark:text-blue-200 p-4 rounded-md mb-6 flex justify-between items-center shadow-lg">
                <div>
                    <p className="font-bold">New Here?</p>
                    <p>Click the button to learn how to use Langcampus Exchange.</p>
                </div>
                <button onClick={() => setShowTutorial(true)} className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">Show Tutorial</button>
            </div>
        )}

        {savedChat && (
             <div className="bg-green-100 dark:bg-green-900 border-l-4 border-green-500 text-green-700 dark:text-green-200 p-4 rounded-md mb-6 flex justify-between items-center shadow-lg">
                <div>
                    <p className="font-bold">Resume your conversation with {savedChat.partner.name}?</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={handleResumeChat} className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600">Resume Chat</button>
                    <button onClick={handleDeleteSavedChat} className="p-2 text-red-500 hover:text-red-700 dark:hover:text-red-300" aria-label="Delete saved chat">
                        <TrashIcon className="w-6 h-6"/>
                    </button>
                </div>
            </div>
        )}
        
        {isLoadingPartners && <div className="flex justify-center mt-12"><LoadingSpinner size="lg"/></div>}
        {error && <div className="text-center text-red-500 mt-12 bg-red-100 dark:bg-red-900 p-4 rounded-md">{error}</div>}
        {!isLoadingPartners && partners.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {partners.map(p => <PartnerCard key={p.name} partner={p} onStartChat={handleStartChat} />)}
            </div>
        )}
        {!isLoadingPartners && !error && partners.length === 0 && (
            <div className="text-center mt-12 text-gray-500">
                <p className="text-xl">Welcome to Langcampus Exchange!</p>
                <p>Select your languages and click "Find New Pals" to start your journey.</p>
            </div>
        )}
      </main>

      {currentPartner && <ChatModal 
          partner={currentPartner} 
          messages={currentChatMessages}
          onMessagesChange={setCurrentChatMessages}
          onClose={handleCloseChat} 
          onSaveChat={handleSaveChat}
          nativeLanguage={nativeLanguage}
          teachMeCache={teachMeCache}
          setTeachMeCache={setTeachMeCache}
          onShareQuizResults={handleShareQuizResults}
          userProfile={userProfile}
          handleUsageCheck={handleUsageCheck}
      />}
      {showTutorial && <TutorialModal onClose={() => setShowTutorial(false)} />}
      {showSubscriptionModal && <SubscriptionModal onClose={() => setShowSubscriptionModal(false)} onSubscribe={handleUpgrade} reason={subscriptionModalReason} isUpgrading={isUpgrading} />}
    </div>
  );
};

const LanguageSelector: React.FC<{
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: Language[];
}> = ({ label, value, onChange, options }) => (
    <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
        <select value={value} onChange={e => onChange(e.target.value)} className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
            {options.map(lang => (
                <option key={lang.code} value={lang.code}>{lang.name}</option>
            ))}
        </select>
    </div>
);

const App: React.FC = () => {
    const { user, loading } = useAuth();
    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <LoadingSpinner size="lg" />
            </div>
        );
    }
    return user ? <AppContent /> : <LoginScreen />;
};

export default App;
