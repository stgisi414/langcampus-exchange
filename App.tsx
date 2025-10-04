// stgisi414/langcampus-exchange/langcampus-exchange-7396249458dd1d8ce1c090fdfb48f150b9e06d7e/App.tsx

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import {
  UserProfileData,
  Partner,
  Message,
  QuizQuestion,
  SavedChat,
  Language,
  SubscriptionStatus,
  UserData,
  UsageData,
  TeachMeCache,
  GroupChat,
} from "./types";
import { LANGUAGES } from "./constants";
import * as geminiService from "./services/geminiService";
import * as groupService from "./services/groupService";
import * as storageService from "./services/storageService";
import {
  ChevronDownIcon,
  CloseIcon,
  InfoIcon,
  TrashIcon,
  BookOpenIcon,
  VolumeUpIcon,
  SaveIcon,
  SendIcon,
  MenuIcon,
  SearchIcon,
  UsersIcon,
  MicrophoneIcon,
  StopIcon,
  PlayIcon,
} from "./components/Icons";
import LoadingSpinner from "./components/LoadingSpinner";
import { grammarData, vocabData } from "./teachMeData";
import { useAuth } from "./hooks/useAuth.ts";
import LoginScreen from "./components/LoginScreen.tsx";
import { auth, app, payments, functions } from "./firebaseConfig.ts";
import { signOut } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { checkAndIncrementUsage } from "./services/firestoreService.ts";
import SubscriptionModal from "./components/SubscriptionModal.tsx";
import * as firestoreService from "./services/firestoreService.ts";
import { loadStripe } from "@stripe/stripe-js";
import {
  createCheckoutSession,
  onCurrentUserSubscriptionUpdate,
} from "@invertase/firestore-stripe-payments";
import Footer from "./components/Footer.tsx";
import TermsOfService from "./components/TermsOfService.tsx";
import PrivacyPolicy from "./components/PrivacyPolicy.tsx";
import GroupJoinPage from "./components/GroupJoinPage.tsx";
import GroupNotFound from "./components/GroupNotFound.tsx";

// Helper for localStorage (Removed as we are using Firestore for persistence)

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

interface AppContentProps {
  user: UserData;
}

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

  return new Blob([view], { type: "audio/wav" });
};

// User Profile Component
const UserProfile: React.FC<{
  profile: { name: string; hobbies: string; bio: string };
  subscriptionStatus: SubscriptionStatus;
  onProfileChange: (profile: {
    name: string;
    hobbies: string;
    bio: string;
  }) => void;
  onUpgradeClick: () => void;
  onCancelSubscription: () => void;
  usageData?: UsageData;
  isUpgrading: boolean;
  isCancelling: boolean;
}> = ({
  profile,
  onProfileChange,
  onUpgradeClick,
  onCancelSubscription,
  subscriptionStatus,
  usageData,
  isUpgrading,
  isCancelling,
}) => {
  // <-- ADD isCancelling HERE
  const [isOpen, setIsOpen] = useState(false);
  const [localProfile, setLocalProfile] = useState(profile);

  useEffect(() => {
    setLocalProfile(profile);
  }, [profile]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setLocalProfile({ ...localProfile, [e.target.name]: e.target.value });
  };

  const handleSaveAndClose = () => {
    onProfileChange(localProfile);
    setIsOpen(false);
  };

  const handleSignOut = () => {
    if (window.confirm("Are you sure you want to sign out?")) {
      signOut(auth);
    }
  };

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
        <div
          className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md animate-fade-in-down flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                My Info
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
                aria-label="Close profile editor"
              >
                <CloseIcon className="w-6 h-6" />
              </button>
            </div>
            <div className="overflow-y-auto">
              <div className="p-6 space-y-4">
                <div>
                  <label
                    htmlFor="name-input"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Name
                  </label>
                  <input
                    id="name-input"
                    type="text"
                    name="name"
                    value={localProfile.name}
                    onChange={handleChange}
                    className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label
                    htmlFor="hobbies-input"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Hobbies
                  </label>
                  <input
                    id="hobbies-input"
                    type="text"
                    name="hobbies"
                    value={localProfile.hobbies}
                    onChange={handleChange}
                    placeholder="e.g., hiking, coding, music"
                    className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label
                    htmlFor="bio-input"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Bio
                  </label>
                  <textarea
                    id="bio-input"
                    name="bio"
                    rows={3}
                    value={localProfile.bio}
                    onChange={handleChange}
                    className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900 dark:text-gray-100"
                  ></textarea>
                </div>
                <div className="border-t dark:border-gray-700 mt-4 pt-4">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Account Type
                  </h3>
                  <p
                    className={`text-lg font-semibold ${subscriptionStatus === "subscriber" ? "text-green-500" : "text-blue-500"}`}
                  >
                    {subscriptionStatus === "subscriber"
                      ? "Langcampus Pro"
                      : "Free Tier"}
                  </p>
                </div>
              </div>
              {subscriptionStatus === "free" && usageData && (
                <div className="px-6 pb-4">
                  <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
                    <h3 className="text-lg font-semibold text-center mb-2 text-gray-800 dark:text-gray-200">
                      Today's Usage
                    </h3>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-gray-600 dark:text-gray-300">
                      <p>Searches: {usageData.searches}/5</p>
                      <p>Messages: {usageData.messages}/20</p>
                      <p>Audio Plays: {usageData.audioPlays}/5</p>
                      <p>Lessons: {usageData.lessons}/10</p>
                      <p className="col-span-2 text-center">
                        Quizzes: {usageData.quizzes}/10
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-between items-center p-4 border-t dark:border-gray-700">
              <button
                onClick={handleSignOut}
                className="px-4 py-2 bg-gray-500 text-white font-bold rounded-lg hover:bg-gray-600 transition-colors text-sm"
              >
                Sign Out
              </button>

              {subscriptionStatus === "subscriber" ? (
                <button
                  onClick={onCancelSubscription}
                  className="px-4 py-2 bg-red-500 text-white font-bold rounded-lg hover:bg-red-600 text-sm disabled:opacity-75"
                  disabled={isCancelling} // <-- USE THE NEW STATE HERE
                >
                  {isCancelling ? "Loading..." : "Manage Plan"}
                </button>
              ) : (
                <button
                  onClick={onUpgradeClick}
                  className="px-4 py-2 bg-green-500 text-white font-bold rounded-lg hover:bg-green-600 disabled:opacity-75 text-sm"
                  disabled={isUpgrading}
                >
                  {isUpgrading ? "Redirecting..." : "Upgrade"}
                </button>
              )}

              <button
                onClick={handleSaveAndClose}
                className="px-4 py-2 bg-blue-500 text-white font-bold rounded-lg hover:bg-blue-600 transition-colors text-sm"
              >
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
  const nativeLangName =
    LANGUAGES.find(
      (l) =>
        l.name === partner.nativeLanguage ||
        l.code.split("-")[0] === partner.nativeLanguage,
    )?.name || partner.nativeLanguage;
  const learningLangName =
    LANGUAGES.find(
      (l) =>
        l.name === partner.learningLanguage ||
        l.code.split("-")[0] === partner.learningLanguage,
    )?.name || partner.learningLanguage;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden transform hover:-translate-y-1 transition-transform duration-300 flex flex-col">
      <img
        src={partner.avatar}
        alt={partner.name}
        className="w-full h-48 object-cover"
      />
      <div className="p-4 flex flex-col flex-grow">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
          {partner.name}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Speaks: {nativeLangName}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Learning: {learningLangName}
        </p>
        <div className="mt-2 flex-grow">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Interests:
          </p>
          <div className="flex flex-wrap gap-1 mt-1">
            {partner.interests.slice(0, 3).map((interest) => (
              <span
                key={interest}
                className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs rounded-full"
              >
                {interest}
              </span>
            ))}
          </div>
        </div>
        <button
          onClick={() => onStartChat(partner)}
          className="mt-4 w-full bg-blue-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors"
        >
          Start Chat
        </button>
      </div>
    </div>
  );
};

// Tutorial Modal Component
const TutorialModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div
    className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4"
    role="dialog"
    aria-modal="true"
  >
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-fade-in-down">
      <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Welcome to Langcampus Exchange!
        </h2>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
          aria-label="Close tutorial"
        >
          <CloseIcon className="w-6 h-6" />
        </button>
      </div>
      <div className="p-6 space-y-4 overflow-y-auto">
        <p className="text-gray-700 dark:text-gray-300">
          Here's a quick guide to get you started:
        </p>
        <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-400">
          <li>
            <strong>Set Your Languages:</strong> Use the dropdown menus at the
            top to select your native language and the language you want to
            learn.
          </li>
          <li>
            <strong>Personalize Your Profile:</strong> Click on "My Info" to add
            your name and hobbies. This helps find partners with similar
            interests!
          </li>
          <li>
            <strong>Find a Partner:</strong> Click the "Find New Pals" button to
            generate a list of AI language partners.
          </li>
          <li>
            <strong>Start Chatting:</strong> Choose a partner and click "Start
            Chat" to open the conversation window.
          </li>
          <li>
            <strong>Use Learning Tools:</strong> Inside the chat, you can toggle
            "Corrections" for real-time feedback, use the "Teach Me" button for
            grammar/vocab lessons, and click any message to hear it spoken.
          </li>
          <li>
            <strong>Save Your Progress:</strong> Don't want to lose a great
            conversation? Click the "Save Chat" icon to save it for later.
          </li>
        </ul>
      </div>
      <div className="flex justify-end p-4 border-t dark:border-gray-700">
        <button
          onClick={onClose}
          className="px-6 py-2 bg-blue-500 text-white font-bold rounded-lg hover:bg-blue-600 transition-colors"
        >
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
  onShareQuizResults: (
    topic: string,
    score: number,
    questions: QuizQuestion[],
    userAnswers: string[],
  ) => Promise<void>;
}> = ({ questions, topic, onClose, onShareQuizResults }) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<string[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  if (!questions || questions.length === 0) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl text-center">
          <p className="text-gray-800 dark:text-gray-200">
            Could not load quiz questions.
          </p>
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const score = userAnswers.reduce(
    (acc, answer, index) =>
      acc + (answer === questions[index].correctAnswer ? 1 : 0),
    0,
  );

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

  const handleShare = async () => {
    if (isSharing) return;
    setIsSharing(true);
    
    await onShareQuizResults(topic, score, questions, userAnswers);

    setIsSharing(false);
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-xl max-h-[90vh] flex flex-col animate-fade-in-down">
        <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {showResults ? "Quiz Results" : `Quiz: ${topic}`}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
            aria-label="Close quiz"
          >
            <CloseIcon className="w-6 h-6" />
          </button>
        </div>

        {showResults ? (
          <div className="p-6 text-center space-y-4">
            <p className="text-2xl text-gray-800 dark:text-gray-200">
              You scored
            </p>
            <p className="text-5xl font-bold text-blue-500">
              {score} / {questions.length}
            </p>
            <div className="mt-4 flex justify-center gap-4">
              <button
                onClick={onClose}
                disabled={isSharing}
                className="px-6 py-2 bg-gray-500 text-white font-bold rounded-lg hover:bg-gray-600"
              >
                Finish
              </button>
              <button
                onClick={handleShare}
                disabled={isSharing}
                className="px-6 py-2 bg-green-500 text-white font-bold rounded-lg hover:bg-green-600 disabled:opacity-75"
              >
                {isSharing ? "Sharing..." : "Discuss with Pal"}
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-4">
            <p className="text-lg text-gray-800 dark:text-gray-200">
              Question {currentQuestionIndex + 1} of {questions.length}
            </p>
            <p className="text-xl font-semibold text-gray-900 dark:text-white">
              {currentQuestion.question}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              {currentQuestion.options.map((option, index) => {
                const isSelected = userAnswers[currentQuestionIndex] === option;
                return (
                  <button
                    key={index}
                    onClick={() => handleAnswer(option)}
                    className={`p-4 rounded-lg text-left transition-colors duration-300 ${
                      isSelected
                        ? "bg-blue-500 text-white"
                        : "bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
                    }`}
                  >
                    {option}
                  </button>
                );
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
  cache: TeachMeCache | null;
  setCache: (cache: TeachMeCache | null) => void;
  onShareQuizResults: (
    topic: string,
    score: number,
    questions: QuizQuestion[],
    userAnswers: string[],
  ) => void;
  handleUsageCheck: (feature: UsageKey, action: () => void) => Promise<void>;
  isGroupChat: boolean;
  userIsGroupCreator: boolean;
  groupTopic: string | null;
  onSetGroupTopic?: (topic: string) => void;
}> = ({
  language,
  onClose,
  nativeLanguage,
  cache,
  setCache,
  onShareQuizResults,
  handleUsageCheck,
  isGroupChat,
  userIsGroupCreator,
  groupTopic,
  onSetGroupTopic,
}) => {
  const [activeTab, setActiveTab] = useState<"Grammar" | "Vocabulary">(
    "Grammar",
  );
  const [level, setLevel] = useState(1);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [content, setContent] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[] | null>(
    null,
  );
  const [showQuiz, setShowQuiz] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const topicListRef = useRef<HTMLUListElement>(null);
  const topicRefs = useRef<Map<string, HTMLButtonElement | null>>(new Map());

  const isHost = isGroupChat && userIsGroupCreator;
  const isMember = isGroupChat && !userIsGroupCreator;

  useEffect(() => {
    const fetchContentForTopic = async (topic: string, type: "Grammar" | "Vocabulary") => {
      setIsLoading(true);
      setContent("");
      try {
        const nativeLanguageName =
          LANGUAGES.find((lang) => lang.code === nativeLanguage)?.name ||
          nativeLanguage;
        const fetchedContent = await geminiService.getContent(
          topic,
          type,
          language,
          nativeLanguageName,
        );
        setContent(fetchedContent);
      } catch (error) {
        setContent("Sorry, there was an error loading the topic content.");
      } finally {
        setIsLoading(false);
      }
    };

    if (isGroupChat && groupTopic) {
      // Priority 1: If in a group chat and a topic is set, load that topic for everyone.
      if (selectedTopic !== groupTopic) {
        setSelectedTopic(groupTopic);
        fetchContentForTopic(groupTopic, activeTab);
      }
    } else if (!isGroupChat && cache && cache.language === language) {
      // Priority 2: If in a solo chat, load from the personal cache.
      setActiveTab(cache.type as "Grammar" | "Vocabulary");
      const topicData = (
        cache.type === "Grammar"
          ? grammarData[language as keyof typeof grammarData]
          : vocabData
      )?.find((t) => t.title === cache.topic);

      if (topicData) {
        setLevel(topicData.level);
      }
      setSelectedTopic(cache.topic);
      setContent(cache.content);
      setTimeout(() => {
        topicRefs.current.get(cache.topic)?.scrollIntoView({ block: "center" });
      }, 0);
    } else {
      // Otherwise, clear the state.
      setSelectedTopic(null);
      setContent("");
      setQuizQuestions(null);
    }
  }, [language, cache, isGroupChat, groupTopic, activeTab, nativeLanguage, selectedTopic]);


  const availableTopics = useMemo(() => {
    const data =
      activeTab === "Grammar"
        ? grammarData[language as keyof typeof grammarData] || []
        : vocabData;

    if (searchQuery.trim()) {
      const lowercasedQuery = searchQuery.toLowerCase();
      return data.filter(
        (topic) =>
          topic.title.toLowerCase().includes(lowercasedQuery) ||
          topic.tags.some((tag) => tag.toLowerCase().includes(lowercasedQuery)),
      );
    } else {
      return data.filter((topic) => topic.level === level);
    }
  }, [activeTab, level, language, searchQuery]);

  const handleLevelChange = (lvl: number) => {
    setLevel(lvl);
    if (topicListRef.current) {
      topicListRef.current.scrollTop = 0;
    }
  };

  const handleTopicSelect = async (topic: string) => {
    if (isHost && onSetGroupTopic) {
      onSetGroupTopic(topic);
      return;
    }

    if (!isGroupChat) {
        handleUsageCheck("lessons", async () => {
        setSelectedTopic(topic);
        setIsLoading(true);
        setContent("");
        setQuizQuestions(null);
        try {
            const nativeLanguageName =
            LANGUAGES.find((lang) => lang.code === nativeLanguage)?.name ||
            nativeLanguage;
            const fetchedContent = await geminiService.getContent(
            topic,
            activeTab,
            language,
            nativeLanguageName,
            );
            setContent(fetchedContent);
            setCache({ language, type: activeTab, topic, content: fetchedContent });
        } catch (error) {
            setContent(
            "Sorry, there was an error loading the content. Please try again.",
            );
        } finally {
            setIsLoading(false);
        }
        });
    }
  };

  const handleShareAndClose = (
    topic: string,
    score: number,
    questions: QuizQuestion[],
    userAnswers: string[],
  ) => {
    onShareQuizResults(topic, score, questions, userAnswers);
    onClose();
  };

  const handleQuizMe = async () => {
    const finalTopic = groupTopic || selectedTopic;
    if (!finalTopic) return;

    handleUsageCheck("quizzes", async () => {
      setIsLoading(true);
      try {
        const nativeLanguageName =
          LANGUAGES.find((lang) => lang.code === nativeLanguage)?.name ||
          nativeLanguage;
        const questions = await geminiService.generateQuiz(
          finalTopic,
          activeTab,
          language,
          nativeLanguageName,
          level,
        );
        setQuizQuestions(questions);
        setShowQuiz(true);
      } catch (error) {
        alert("Failed to generate quiz. Please try again.");
      } finally {
        setIsLoading(false);
      }
    });
  };

  const currentIndex = useMemo(() => {
    const currentDisplayTopic = groupTopic || selectedTopic;
    if (!currentDisplayTopic) return -1;
    return availableTopics.findIndex((t) => t.title === currentDisplayTopic);
  }, [selectedTopic, availableTopics, groupTopic]);


  const handlePreviousChapter = () => {
    if (currentIndex > 0) {
      const previousTopic = availableTopics[currentIndex - 1];
      handleTopicSelect(previousTopic.title);
    }
  };

  const handleNextChapter = () => {
    if (currentIndex !== -1 && currentIndex < availableTopics.length - 1) {
      const nextTopic = availableTopics[currentIndex + 1];
      handleTopicSelect(nextTopic.title);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-start pt-10 sm:items-center sm:pt-0 z-50 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[95vw] max-w-4xl h-[90vh] flex flex-col animate-fade-in-down">
        <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMenuOpen(true)}
              className="p-1 rounded-md text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 md:hidden"
              aria-label="Open topics menu"
            >
              <MenuIcon className="w-6 h-6" />
            </button>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {isGroupChat ? `Group Topic: ${language}` : `Teach Me: ${language}`}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
            aria-label="Close learning module"
          >
            <CloseIcon className="w-6 h-6" />
          </button>
        </div>
        <div className="flex-grow flex relative overflow-hidden">
          {isMenuOpen && (
            <div
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-black bg-opacity-50 z-10 md:hidden"
              aria-hidden="true"
            ></div>
          )}

          <div
             className={`absolute top-0 left-0 h-full w-4/5 max-w-sm bg-white dark:bg-gray-800 z-20 transform transition-transform p-4 flex-col md:static md:w-1/3 md:translate-x-0 md:border-r md:dark:border-gray-700 ${isMenuOpen ? "translate-x-0 flex" : "-translate-x-full hidden md:flex"}`}
          >
            <div className="flex justify-between items-center mb-4 md:hidden">
              <h3 className="text-lg font-bold">Topics</h3>
              <button
                onClick={() => setIsMenuOpen(false)}
                className="p-1"
                aria-label="Close topics menu"
              >
                <CloseIcon className="w-6 h-6" />
              </button>
            </div>

            {(isHost || !isGroupChat) && <div className="relative mb-4">
              <input
                type="text"
                placeholder="Search lessons..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border dark:border-gray-600 rounded-full bg-gray-100 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            </div>}

            {(isHost || !isGroupChat) && searchQuery.trim() === "" ? (
              <>
                <div className="flex border-b dark:border-gray-600 mb-4">
                  <button
                    onClick={() => setActiveTab("Grammar")}
                    className={`flex-1 py-2 text-center ${activeTab === "Grammar" ? "border-b-2 border-blue-500 text-blue-500" : "text-gray-500"}`}
                  >
                    Grammar
                  </button>
                  <button
                    onClick={() => setActiveTab("Vocabulary")}
                    className={`flex-1 py-2 text-center ${activeTab === "Vocabulary" ? "border-b-2 border-blue-500 text-blue-500" : "text-gray-500"}`}
                  >
                    Vocabulary
                  </button>
                </div>
                <div className="mb-4">
                  <p className="font-semibold mb-2 text-center">
                    Select Level:
                  </p>
                  <div className="flex justify-center gap-2">
                    {[1, 2, 3, 4, 5].map((lvl) => (
                      <button
                        key={lvl}
                        onClick={() => handleLevelChange(lvl)}
                        className={`px-3 py-1 rounded-full text-sm ${level === lvl ? "bg-blue-500 text-white" : "bg-gray-200 dark:bg-gray-700"}`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center mb-2">
                <p className="font-semibold">{isGroupChat ? 'Current Topic' : 'Search Results'}</p>
              </div>
            )}

            <ul
              ref={topicListRef}
              className="space-y-2 overflow-y-auto flex-grow"
            >
              {(isHost || !isGroupChat) && availableTopics.length > 0 ? (
                availableTopics.map((topic) => (
                  <li key={topic.title}>
                    <button
                      ref={(el) => topicRefs.current.set(topic.title, el)}
                      onClick={() => handleTopicSelect(topic.title)}
                      className={`w-full text-left p-2 rounded text-sm ${(groupTopic || selectedTopic) === topic.title ? "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100" : "hover:bg-gray-100 dark:hover:bg-gray-700"}`}
                    >
                      {topic.title}
                    </button>
                  </li>
                ))
              ) : (
                isMember && (groupTopic || selectedTopic) ? (
                    <li>
                        <button className="w-full text-left p-2 rounded text-sm bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100">
                            {groupTopic || selectedTopic}
                        </button>
                    </li>
                ) : (
                    <p className="text-gray-500 text-center p-4">No topics found.</p>
                )
              )}
            </ul>
          </div>

          <div className="w-full p-6 overflow-y-auto">
            {(isHost || !isGroupChat) && (groupTopic || selectedTopic) && (
              <div className="flex justify-between items-center mb-4">
                <button
                  onClick={handlePreviousChapter}
                  disabled={currentIndex <= 0 || isLoading}
                  className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded-lg text-sm hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  &larr; Previous
                </button>
                <button
                  onClick={handleNextChapter}
                  disabled={
                    currentIndex === -1 ||
                    currentIndex >= availableTopics.length - 1 ||
                    isLoading
                  }
                  className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded-lg text-sm hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next &rarr;
                </button>
              </div>
            )}
            {isLoading && (
              <div className="flex justify-center items-center h-full">
                <LoadingSpinner />
              </div>
            )}
            {!isLoading && content && (
              <div
                className="prose dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{
                  __html: (window as any).marked.parse(content),
                }}
              ></div>
            )}
             {!isLoading && !content && !isGroupChat && (
              <p className="text-gray-500">Select a topic to begin learning.</p>
            )}
             {!isLoading && !content && isGroupChat && (
              <p className="text-gray-500">{isHost ? "Select a topic for the group." : "Waiting for the host to select a topic."}</p>
            )}
          </div>
        </div>
        <div className="flex justify-end p-4 border-t dark:border-gray-700">
          <button
            onClick={handleQuizMe}
            disabled={!(groupTopic || selectedTopic) || isLoading}
            className="px-6 py-2 bg-green-500 text-white font-bold rounded-lg hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Quiz Me!
          </button>
        </div>
      </div>
      {showQuiz && quizQuestions && (
        <QuizModal
          questions={quizQuestions}
          topic={(groupTopic || selectedTopic)!}
          onClose={() => setShowQuiz(false)}
          onShareQuizResults={handleShareAndClose}
        />
      )}
    </div>
  );
};

const GroupTopicSelector: React.FC<{
  language: string;
  currentTopic: string | null;
  onTopicSelect: (topic: string) => void;
  isLoading: boolean;
  nativeLanguage: string;
  handleUsageCheck: (feature: UsageKey, action: () => void) => Promise<void>;
}> = ({
  language,
  currentTopic,
  onTopicSelect,
  isLoading,
  nativeLanguage,
  handleUsageCheck,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"Grammar" | "Vocabulary">(
    "Grammar",
  );
  const [level, setLevel] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");

  const availableTopics = useMemo(() => {
    const data =
      activeTab === "Grammar"
        ? grammarData[language as keyof typeof grammarData] || []
        : vocabData;

    if (searchQuery.trim()) {
      const lowercasedQuery = searchQuery.toLowerCase();
      return data.filter(
        (topic) =>
          topic.title.toLowerCase().includes(lowercasedQuery) ||
          topic.tags.some((tag) => tag.toLowerCase().includes(lowercasedQuery)),
      );
    } else {
      return data.filter((topic) => topic.level === level);
    }
  }, [activeTab, level, language, searchQuery]);

  const handleFinalTopicSelect = (topic: string) => {
    onTopicSelect(topic);
    setIsOpen(false);
  };

  // In a real application, fetching lesson content here isn't needed, just the name.
  // The topic selection still counts as a "lesson" action to limit abuse.
  const handleCheckAndOpen = () => {
    handleUsageCheck("lessons", () => {
      setIsOpen(true);
    });
  };

  return (
    <>
      <button
        onClick={handleCheckAndOpen}
        className="px-2 py-1 bg-blue-500 text-white font-bold rounded-lg hover:bg-blue-600 transition-colors text-xs"
        disabled={isLoading}
      >
        {currentTopic
          ? `Change Topic: ${currentTopic.substring(0, 20)}...`
          : "Choose Topic"}
      </button>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg h-[80vh] flex flex-col animate-fade-in-down">
            <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Select Topic for Group
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
                aria-label="Close topic selector"
              >
                <CloseIcon className="w-6 h-6" />
              </button>
            </div>
            <div className="p-4 flex flex-col flex-grow overflow-y-auto">
              <div className="flex border-b dark:border-gray-600 mb-4">
                <button
                  onClick={() => setActiveTab("Grammar")}
                  className={`flex-1 py-2 text-center ${activeTab === "Grammar" ? "border-b-2 border-blue-500 text-blue-500" : "text-gray-500"}`}
                >
                  Grammar
                </button>
                <button
                  onClick={() => setActiveTab("Vocabulary")}
                  className={`flex-1 py-2 text-center ${activeTab === "Vocabulary" ? "border-b-2 border-blue-500 text-blue-500" : "text-gray-500"}`}
                >
                  Vocabulary
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
              {searchQuery.trim() === "" && (
                <div className="mb-4">
                  <p className="font-semibold mb-2 text-center">
                    Select Level:
                  </p>
                  <div className="flex justify-center gap-2">
                    {[1, 2, 3, 4, 5].map((lvl) => (
                      <button
                        key={lvl}
                        onClick={() => setLevel(lvl)}
                        className={`px-3 py-1 rounded-full text-sm ${level === lvl ? "bg-blue-500 text-white" : "bg-gray-200 dark:bg-gray-700"}`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <ul className="space-y-2 overflow-y-auto flex-grow">
                {availableTopics.length > 0 ? (
                  availableTopics.map((topic) => (
                    <li key={topic.title}>
                      <button
                        onClick={() => handleFinalTopicSelect(topic.title)}
                        className={`w-full text-left p-2 rounded text-sm ${currentTopic === topic.title ? "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100" : "hover:bg-gray-100 dark:hover:bg-gray-700"}`}
                      >
                        {topic.title}
                      </button>
                    </li>
                  ))
                ) : (
                  <p className="text-gray-500 text-center p-4">
                    No topics found.
                  </p>
                )}
              </ul>
            </div>
            <div className="flex justify-end p-4 border-t dark:border-gray-700">
              <button
                onClick={() => setIsOpen(false)}
                className="px-6 py-2 bg-gray-500 text-white font-bold rounded-lg hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

interface AudioRecorderProps {
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onSendAudio: (audioBlob: Blob, duration: number) => Promise<void>;
  onCancelRecording: () => void;
  isSending: boolean;
  recordedBlob: Blob | null;
  setRecordedBlob: React.Dispatch<React.SetStateAction<Blob | null>>;
  audioDuration: number;
  setAudioDuration: React.Dispatch<React.SetStateAction<number>>;
}

const AudioRecorder: React.FC<AudioRecorderProps> = ({
  isRecording,
  onStartRecording,
  onStopRecording,
  onSendAudio,
  onCancelRecording,
  isSending,
  recordedBlob,
  setRecordedBlob,
  audioDuration,
  setAudioDuration,
}) => {
  const handleSend = () => {
    if (recordedBlob) {
      onSendAudio(recordedBlob, audioDuration);
      setRecordedBlob(null);
      setAudioDuration(0);
    }
  };

  const handleCancel = () => {
    onCancelRecording(); // This will also call onStopRecording from the parent
    setRecordedBlob(null);
    setAudioDuration(0);
  };

  const formatTime = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex-grow flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-full">
      {isRecording ? (
        // Recording state UI
        <div className="flex items-center w-full">
          <button
            onClick={onStopRecording}
            className="p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
            disabled={isSending}
            aria-label="Stop recording"
          >
            <StopIcon className="w-5 h-5" />
          </button>
          <div className="flex-grow text-center text-red-500 font-semibold ml-4 animate-pulse">
            Recording... {formatTime(audioDuration)}
          </div>
        </div>
      ) : recordedBlob ? (
        // Playback and Send state UI
        <div className="flex items-center w-full gap-2">
          <button
            onClick={handleSend}
            className="p-1 bg-green-500 text-white rounded-full hover:bg-green-600 transition-colors"
            disabled={isSending}
            aria-label="Send voice message"
          >
            <SendIcon className="w-5 h-5" />
          </button>
          <div className="flex-grow text-center text-gray-800 dark:text-gray-200 font-semibold text-xs sm:text-base">
            Ready to Send ({formatTime(audioDuration)})
          </div>
          <button
            onClick={handleCancel}
            className="p-1 bg-gray-500 text-white rounded-full hover:bg-gray-600 transition-colors"
            disabled={isSending}
            aria-label="Cancel recording"
          >
            <TrashIcon className="w-5 h-5" />
          </button>
        </div>
      ) : (
        // Initial state UI
        <button
          onClick={onStartRecording}
          className="flex-grow flex items-center justify-center gap-1 px-3 py-1 text-gray-500 hover:text-red-500"
          disabled={isSending}
          aria-label="Start voice recording"
        >
          <MicrophoneIcon className="w-5 h-5" />
          <span className="text-sm">Record Voice Message</span>
        </button>
      )}
    </div>
  );
};

// Chat Modal Component
interface ChatModalProps {
  user: UserData;
  partner: Partner;
  messages: Message[];
  onMessagesChange: React.Dispatch<React.SetStateAction<Message[]>>;
  onClose: () => void;
  onSaveChat: (messages: Message[]) => void;
  nativeLanguage: string;
  teachMeCache: TeachMeCache | null;
  setTeachMeCache: (cache: TeachMeCache | null) => void;
  onShareQuizResults: (
    topic: string,
    score: number,
    questions: QuizQuestion[],
    userAnswers: string[],
  ) => void;
  userProfile: UserProfileData;
  handleUsageCheck: (feature: UsageKey, action: () => void) => Promise<void>;
  groupChat: GroupChat | null;
  onStartGroup: () => void;
  userIsGroupCreator: boolean;
  onShareGroupLink: (link: string) => void;
  onSetGroupTopic: (topic: string) => void;
  onSendTextMessage: (messageText: string) => Promise<void>;
  onSendVoiceMessage: (voiceMessage: Message) => Promise<void>;
  // Add props for controlled input
  newMessage: string;
  setNewMessage: React.Dispatch<React.SetStateAction<string>>;
  isSending: boolean;
  setIsSending: React.Dispatch<React.SetStateAction<boolean>>;
  onTextSubmit: (e: React.FormEvent, correctionsEnabled: boolean) => void;
  nudgeCount: number;
  onAddNudge: (response: Message, messagesSnapshot: Message[]) => void;
}

const ChatModal: React.FC<ChatModalProps> = ({
  user,
  partner,
  messages,
  onMessagesChange,
  onClose,
  onSaveChat,
  nativeLanguage,
  teachMeCache,
  setTeachMeCache,
  onShareQuizResults,
  userProfile,
  handleUsageCheck,
  groupChat,
  onStartGroup,
  userIsGroupCreator,
  onShareGroupLink,
  onSetGroupTopic,
  onSendTextMessage,
  onSendVoiceMessage,
  newMessage,
  setNewMessage,
  isSending,
  setIsSending,
  onTextSubmit,
  nudgeCount,
  onAddNudge,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [correctionsEnabled, setCorrectionsEnabled] = useState(true);
  const [showTeachMe, setShowTeachMe] = useState(false);
  const chatHistoryRef = useRef<HTMLDivElement>(null);
  const quizSharedRef = useRef(false); 
  const [recorder, setRecorder] = useState<MediaRecorder | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [speakingMessageIndex, setSpeakingMessageIndex] = useState<number | null>(null);
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // 1. Clear any existing timer when dependencies change (new message, sending status, etc.)
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }

    // 2. Only run this logic for solo chats
    if (!groupChat) {
      const lastMessage = messages[messages.length - 1];
      const isInitialChat = messages.length === 0;

      // Determine if a timer should be set:
      // - Not currently waiting for an AI response (!isSending)
      // - AND (The chat is empty OR the last message was from the AI - ensuring it's the user's turn to speak)
      const shouldSetTimer = !isSending && (isInitialChat || (lastMessage && lastMessage.sender === 'ai'));

      if (shouldSetTimer) {
        // 8 seconds for the first AI-initiated message (the welcome), 60 seconds for subsequent nudges
        const TIMEOUT_DURATION = isInitialChat ? 8000 : 60000;
        const MAX_AI_INITIATED_MESSAGES = 3; // Welcome (1) + 2 Nudges (2)

        // Only set the timer if we are within the maximum number of AI-initiated messages
        if (isInitialChat || nudgeCount < MAX_AI_INITIATED_MESSAGES) {
          inactivityTimerRef.current = setTimeout(async () => {
            
            if (isSending) return; // Final safety check
            
            setIsSending(true); 
            try {
              let response: Message;

              if (isInitialChat) {
                // Initial Welcome Message (Nudge #1)
                response = await geminiService.getInitialWelcomeMessage(partner);
              } else {
                // Subsequent Nudge (Nudge #2 or #3)
                response = await geminiService.getNudgeResponse(
                  messages,
                  partner,
                  userProfile,
                  nativeLanguage
                );
              }
              
              onMessagesChange(prevMessages => {
                let didAddNudge = false;
                // Check if the conversation length is still the same (user hasn't sent a message yet)
                if (prevMessages.length === messages.length) { 
                  didAddNudge = true; // Set flag inside setter for atomic check
                  return [...prevMessages, {...response, timestamp: Date.now()}]; 
                }
                return prevMessages; // User sent a message, so don't add the nudge
              });

              onAddNudge(response, messages);
            } catch (error) {
              console.error("Failed to get AI response:", error);
            } finally {
              setIsSending(false);
            }
          }, TIMEOUT_DURATION);
        }
      }
    }

    // Cleanup function to clear the timer when the component unmounts or dependencies change
    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [messages, groupChat, partner, userProfile, onMessagesChange, isSending, nudgeCount]);

  const startTimer = useCallback(() => {
    setAudioDuration(0);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setAudioDuration((prev) => prev + 1);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const handleStartRecording = useCallback(async () => {
    if (isRecording || recorder) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm",
      });

      const chunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (e) => {
        chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        setRecordedBlob(blob);
        stream.getTracks().forEach((track) => track.stop());
        setIsRecording(false);
        setRecorder(null);
        stopTimer();
      };

      mediaRecorder.start();
      setRecorder(mediaRecorder);
      setRecordedBlob(null);
      setIsRecording(true);
      startTimer();
    } catch (error) {
      console.error("Error starting recording:", error);
      alert("Could not start recording. Please check microphone permissions.");
      setIsRecording(false);
      stopTimer();
    }
  }, [isRecording, recorder, startTimer, stopTimer]);

  const handleStopRecording = useCallback(() => {
    if (recorder && recorder.state === "recording") {
      recorder.stop();
    }
  }, [recorder]);

  const handleCancelRecording = useCallback(() => {
    handleStopRecording();
    setIsRecording(false);
    setRecordedBlob(null);
    setAudioDuration(0);
  }, [handleStopRecording]);

  useEffect(() => {
    chatHistoryRef.current?.scrollTo(0, chatHistoryRef.current.scrollHeight);
  }, [messages]);

  const partnerLanguageObject =
    LANGUAGES.find(
      (lang) =>
        lang.name.toLowerCase() === partner.nativeLanguage.toLowerCase(),
    ) || LANGUAGES.find((lang) => lang.code === "en-US")!;

  const partnerLanguageName = partnerLanguageObject.name;
  const partnerLanguageCode = partnerLanguageObject.code;

  const handleSpeak = (text: string, index: number) => {
    // Prevent another TTS request while one is already loading/playing
    if (speakingMessageIndex !== null) {
      return;
    }

    handleUsageCheck("audioPlays", async () => {
      setSpeakingMessageIndex(index); // Disable button & show loading state
      try {
        const audioContent = await geminiService.synthesizeSpeech(
          text,
          partnerLanguageCode,
        );
        const pcmData = base64ToArrayBuffer(audioContent);
        const pcm16 = new Int16Array(pcmData);
        const wavBlob = pcmToWav(pcm16, 24000);
        const audioUrl = URL.createObjectURL(wavBlob);
        const audio = new Audio(audioUrl);
        
        audio.onended = () => setSpeakingMessageIndex(null);
        audio.onerror = () => {
            console.error("Audio playback error.");
            setSpeakingMessageIndex(null);
        };
        audio.play();

      } catch (error) {
        // Fallback to browser's built-in speech synthesis
        console.error("Error synthesizing speech, falling back to browser TTS:", error);
        try {
            if ('speechSynthesis' in window) {
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.lang = partnerLanguageCode;
                utterance.onend = () => setSpeakingMessageIndex(null);
                utterance.onerror = (e) => {
                    console.error("Browser TTS error:", e);
                    setSpeakingMessageIndex(null);
                };
                window.speechSynthesis.speak(utterance);
            } else {
                 setSpeakingMessageIndex(null); // No TTS available
            }
        } catch (speechError) {
            console.error("Browser speech synthesis failed to start:", speechError);
            setSpeakingMessageIndex(null);
        }
      }
    });
  };

  const AudioPlayer: React.FC<{ audioUrl: string; duration: number }> = ({
    audioUrl,
    duration,
  }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
  
    // This effect ensures the audio source is updated if the URL changes,
    // and that the player pauses when the component is unmounted.
    useEffect(() => {
      const audio = audioRef.current;
      if (audio) {
        audio.src = audioUrl;
        const handleEnded = () => setIsPlaying(false);
        audio.addEventListener("ended", handleEnded);
  
        // Cleanup function to run when the component unmounts
        return () => {
          audio.removeEventListener("ended", handleEnded);
          if (!audio.paused) {
            audio.pause();
          }
        };
      }
    }, [audioUrl]);
  
    const togglePlay = () => {
      if (!audioRef.current) return;
  
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        handleUsageCheck("audioPlays", () => {
          audioRef.current?.play().catch((e) => console.error("Audio playback failed:", e));
          setIsPlaying(true);
        });
      }
    };
  
    const formatTime = (seconds: number) => {
      const min = Math.floor(seconds / 60);
      const sec = Math.floor(seconds % 60); // Use Math.floor to avoid decimals
      return `${min.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
    };
  
    return (
      <div className="flex items-center gap-2 p-1 bg-white dark:bg-gray-700 rounded-full w-full">
        {/* The single <audio> element, hidden from view but controllable via the ref */}
        <audio ref={audioRef} src={audioUrl} preload="metadata"></audio>
        
        <button
          onClick={togglePlay}
          className="p-1 bg-blue-500 text-white rounded-full hover:bg-blue-600"
          aria-label={isPlaying ? "Pause audio" : "Play audio"}
        >
          {isPlaying ? (
            <StopIcon className="w-5 h-5" />
          ) : (
            <PlayIcon className="w-5 h-5" />
          )}
        </button>
        <span className="text-gray-800 dark:text-gray-200 text-sm font-semibold">
          {formatTime(duration)}
        </span>
      </div>
    );
  };

  const handleSendAudio = async (audioBlob: Blob, duration: number) => {
    const currentUserId = auth.currentUser?.uid;
    const identifier = groupChat?.id || partner?.name;
    if (!identifier || !currentUserId) return;
    await handleUsageCheck("messages", async () => {
      let transcription = "";
      try {
        const audioUrl = await storageService.uploadAudioMessage(audioBlob, identifier, currentUserId);
        const voiceMessage: Message = {
          sender: "user",
          text: "(Voice Message)",
          audioUrl,
          audioDuration: duration,
          senderId: currentUserId,
          senderName: user.displayName || 'User',
          timestamp: Date.now() // Add timestamp
        };
        await onSendVoiceMessage(voiceMessage);
      } catch (error) {
        console.error("Upload or Post Failed:", error);
        alert("Failed to send voice message. Please try again.");
        return;
      }
      try {
          transcription = await geminiService.transcribeAudio(audioBlob, partnerLanguageCode);
      } catch (error) {
          console.error("Transcription Failed:", error);
          transcription = "";
      }
      if (transcription) {
          const isBotMention = transcription.toLowerCase().startsWith('@bot');
          const userTranscriptionMessage: Message = {
            sender: "user",
            text: `(Transcription: ${transcription})`,
            senderId: currentUserId,
            senderName: user.displayName || 'User',
            timestamp: Date.now() // Add timestamp
          };
          if (activeGroup) {
              await groupService.addMessageToGroup(activeGroup.id, userTranscriptionMessage);
              if (isBotMention) {
                  setIsSending(true);
                  try {
                      const rawContextMessage: Message = { sender: "user", text: transcription, senderId: currentUserId, senderName: user.displayName || 'User', timestamp: Date.now() }; // Add timestamp
                      const updatedGroup = await groupService.getGroupById(activeGroup.id);
                      const currentMessages = updatedGroup ? [...updatedGroup.messages, rawContextMessage] : [userTranscriptionMessage, rawContextMessage];
                      const groupTeachMeCache: TeachMeCache | null = activeGroup.topic
                      ? { topic: activeGroup.topic, language: partnerLanguageObject.name, type: 'Grammar', content: '', } : null;
                      const botResponse = await groupService.getGroupBotResponse(currentMessages, activeGroup.partner, userProfile, true, groupTeachMeCache);
                      await groupService.addMessageToGroup(activeGroup.id, {...botResponse, timestamp: Date.now()}); // Add timestamp
                  } catch (error) {
                      console.error("Bot Reply Failed:", error);
                  } finally {
                      setIsSending(false);
                  }
              }
          } else {
               setCurrentChatMessages(prev => [...prev, userMessage]);
          }
      }
    });
    setRecordedBlob(null);
    setIsRecording(false);
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-start pt-10 sm:items-center sm:pt-0 z-40 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[95vw] max-w-2xl h-[90vh] flex flex-col animate-fade-in-down">
        <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
          <div className="flex items-center gap-3">
            <img
              src={partner.avatar}
              alt={partner.name}
              className="w-12 h-12 rounded-full object-cover"
            />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {partner.name}
            </h2>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            {!groupChat && (
              <button
                onClick={onStartGroup}
                className="p-1 sm:p-2 rounded-full text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                aria-label="Start group chat"
              >
                <UsersIcon className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            )}
            {!groupChat && (
              <button
                onClick={() => onSaveChat(messages)}
                className="p-1 sm:p-2 rounded-full text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                aria-label="Save chat"
              >
                <SaveIcon className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            )}
            <button
              onClick={() => setShowTeachMe(true)}
              className="p-1 sm:p-2 rounded-full text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
              aria-label="Open learning module"
            >
              <BookOpenIcon className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
            <button
              onClick={onClose}
              className="p-1 sm:p-2 rounded-full text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
              aria-label="Close chat"
            >
              <CloseIcon className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </div>
        </div>

        <div
          ref={chatHistoryRef}
          className="flex-grow p-4 space-y-4 overflow-y-auto bg-gray-50 dark:bg-gray-900"
        >
          {messages.map((msg, index) => {
            // This logic correctly identifies the current user's messages in any context
            const isMyMessage = msg.senderId === user?.uid;

            return (
              <div
                key={index}
                className={`flex items-end gap-2 ${isMyMessage ? "justify-end" : "justify-start"}`}
              >
                {/* Avatar for AI and other users */}
                {!isMyMessage && (
                  <img
                    src={
                      msg.sender === "ai"
                        ? partner.avatar
                        : `https://api.dicebear.com/8.x/micah/svg?seed=${msg.senderName || "guest"}`
                    }
                    alt={msg.senderName || "Partner"}
                    className="w-8 h-8 rounded-full"
                  />
                )}
                <div
                  className={`max-w-md p-3 rounded-lg ${isMyMessage ? "bg-blue-500 text-white" : "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white"}`}
                >
                  {/* Display sender's name for other users in a group chat */}
                  {!isMyMessage && msg.sender !== "ai" && groupChat && (
                    <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">
                      {msg.senderName || "Another User"}
                    </p>
                  )}

                  {msg.audioUrl ? (
                    <AudioPlayer
                      audioUrl={msg.audioUrl}
                      duration={msg.audioDuration || 0}
                    />
                  ) : (
                    <p>{msg.text}</p>
                  )}

                  {!msg.audioUrl && (
                    <>
                      {msg.correction && (
                        <p className="mt-2 pt-2 border-t border-green-300 dark:border-green-700 text-sm text-green-700 dark:text-green-300">
                          Correction: <em>{msg.correction}</em>
                        </p>
                      )}
                      {msg.translation && (
                        <p className="mt-2 pt-2 border-t border-gray-300 dark:border-gray-600 text-sm text-gray-500 dark:text-gray-400">
                          <em>{msg.translation}</em>
                        </p>
                      )}
                      <button
                        onClick={() => handleSpeak(msg.text, index)}
                        className="mt-1 text-xs opacity-60 hover:opacity-100 disabled:opacity-30 disabled:cursor-wait"
                        disabled={speakingMessageIndex === index}
                      >
                        <VolumeUpIcon className={`w-4 h-4 inline-block ${speakingMessageIndex === index ? 'animate-pulse text-blue-500' : ''}`} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
          {isSending && (
            <div className="flex items-end gap-2 justify-start">
              <img src={partner.avatar} className="w-8 h-8 rounded-full" />
              <div className="max-w-md p-3 rounded-lg bg-gray-200 dark:bg-gray-700">
                <span className="text-gray-500 text-sm">
                  {isRecording ? "Uploading audio..." : "Typing..."}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="px-4 py-2 border-t dark:border-gray-700">
          {isRecording || recordedBlob ? (
            <AudioRecorder
              isRecording={isRecording}
              onStartRecording={handleStartRecording}
              onStopRecording={handleStopRecording}
              onSendAudio={handleSendAudio}
              onCancelRecording={handleCancelRecording}
              isSending={isSending}
              recordedBlob={recordedBlob}
              setRecordedBlob={setRecordedBlob}
              audioDuration={audioDuration}
              setAudioDuration={setAudioDuration}
            />
          ) : (
            <form
              onSubmit={(e) => onTextSubmit(e, correctionsEnabled)}
              className="flex-grow flex items-center gap-2 sm:gap-3"
            >
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your message..."
                className="flex-grow px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100"
                disabled={isSending}
              />
              <button
                type="button"
                onClick={handleStartRecording}
                className="p-2 sm:p-3 bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-full hover:bg-gray-400 dark:hover:bg-gray-600"
                disabled={isSending}
                aria-label="Start voice recording"
              >
                <MicrophoneIcon className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
              <button
                type="submit"
                className="p-2 sm:p-3 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:bg-gray-400"
                disabled={isSending || !newMessage.trim()}
              >
                <SendIcon className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </form>
          )}

          <div className="flex items-center justify-center mt-2">
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={correctionsEnabled}
                onChange={() => setCorrectionsEnabled(!correctionsEnabled)}
                className="form-checkbox h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
              />
              Enable Corrections
            </label>
          </div>
        </div>
      </div>
      {showTeachMe && (
        <TeachMeModal
          language={partnerLanguageName}
          onClose={() => setShowTeachMe(false)}
          nativeLanguage={nativeLanguage}
          cache={teachMeCache}
          setCache={setTeachMeCache}
          onShareQuizResults={onShareQuizResults}
          handleUsageCheck={handleUsageCheck}
          isGroupChat={!!groupChat}
          userIsGroupCreator={userIsGroupCreator}
          groupTopic={groupChat?.topic || null}
          onSetGroupTopic={onSetGroupTopic}
        />
      )}
    </div>
  );
};

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <>
      {children}
      <Footer />
    </>
  );
};

// AppContent Component - now receives user as a prop
const AppContent: React.FC<AppContentProps> = ({ user }) => {
  const [nativeLanguage, setNativeLanguage] = useState<string>(
    () => localStorage.getItem("nativeLanguage") || LANGUAGES[0].code,
  );
  const [targetLanguage, setTargetLanguage] = useState<string>(
    () => localStorage.getItem("targetLanguage") || LANGUAGES[1].code,
  );
  const [partners, setPartners] = useState<Partner[]>([]);
  const [isLoadingPartners, setIsLoadingPartners] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPartner, setCurrentPartner] = useState<Partner | null>(null);
  const [currentChatMessages, setCurrentChatMessages] = useState<Message[]>([]);
  const [showTutorial, setShowTutorial] = useState(
    () => !localStorage.getItem("tutorialShown"),
  );
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [subscriptionModalReason, setSubscriptionModalReason] = useState<
    "limit" | "manual"
  >("limit");
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [activeGroup, setActiveGroup] = useState<GroupChat | null>(null);
  const [groupMessages, setGroupMessages] = useState<Message[]>([]); // New state for group messages
  const unsubscribeGroupRef = useRef<(() => void) | null>(null); // For unsubscribing from Firestore listener
  const lastQuizShareTimestamp = useRef(0);
  const DEBOUNCE_TIME = 500; // 500ms debounce time
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [nudgeCount, setNudgeCount] = useState(0);

  useEffect(() => {
    localStorage.setItem("nativeLanguage", nativeLanguage);
  }, [nativeLanguage]);

  const handleAddNudge = useCallback((response: Message, messagesSnapshot: Message[]) => {
    // Check if the conversation length has NOT changed since the timer started.
    // This is the CRITICAL check to prevent duplicates if the user types quickly.
    if (messagesSnapshot.length === currentChatMessages.length) { 
      // 1. Atomically update the messages list
      setCurrentChatMessages((prev) => [...prev, { ...response, timestamp: Date.now() }]);
      
      // 2. Separately update the nudge count (React will batch these two updates)
      setNudgeCount((prev) => prev + 1);
    }
  }, [currentChatMessages.length]); // Re-create if messages.length changes

  useEffect(() => {
    localStorage.setItem("targetLanguage", targetLanguage);
    setPartners([]);
    // The line deleting from Firestore is removed. The local component state
    // will now handle the UI update gracefully without a flicker.
    setNudgeCount(0); 
  }, [targetLanguage]);

  useEffect(() => {
    // 1. Clean up any existing listener
    if (unsubscribeGroupRef.current) {
      unsubscribeGroupRef.current();
      unsubscribeGroupRef.current = null;
    }

    if (user?.activeGroupId) {
      // 2. Start a listener on the active group
      const unsubscribe = groupService.subscribeToGroup(
        user.activeGroupId,
        (group) => {
          if (group) {
            // When group data changes in Firestore, update local state
            setActiveGroup(group);
            // Switch the current chat to the group's state
            setCurrentPartner(group.partner);

            // *** FIX: SORT MESSAGES BY TIMESTAMP ***
            const sortedMessages = [...group.messages].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
            setCurrentChatMessages(sortedMessages);

          } else {
            // Group was deleted or user was removed
            setActiveGroup(null);
            setCurrentPartner(null);
            setCurrentChatMessages([]);
            // In a real app, you'd also need a service call to clear the user's activeGroupId in Firestore.
          }
        },
      );
      unsubscribeGroupRef.current = unsubscribe;
    } else {
      // Clear local group state if user has no active group
      setActiveGroup(null);
    }

    return () => {
      // Cleanup on component unmount
      if (unsubscribeGroupRef.current) {
        unsubscribeGroupRef.current();
      }
    };
  }, [user?.activeGroupId]); // Re-run when the user's active group ID changes

  // FIX: Treat the user prop as the single source of truth for teachMeCache, 
  // as it is already kept in sync with Firestore via the useAuth hook.
  // This eliminates the race condition/stale data on page load.
  const teachMeCache = user?.teachMeCache || null;

  // NEW: Define the setter function to ONLY call Firestore (the source of truth)
  // The 'user' prop updates automatically via the useAuth listener, which 
  // then updates the 'teachMeCache' variable declared above.
  const setTeachMeCache = (cache: TeachMeCache | null) => {
    if (user) {
      if (cache) {
        // Persist the change to Firestore in the background.
        firestoreService.saveTeachMeCacheInFirestore(user.uid, cache);
      } else {
        firestoreService.deleteTeachMeCacheFromFirestore(user.uid);
      }
    }
  };

  const handleTextSubmit = async (e: React.FormEvent, correctionsEnabled: boolean) => {
    e.preventDefault();
    if (!newMessage.trim() || isSending) return;

    const messageToSend = newMessage;
    setNewMessage(''); // Clear input instantly

    await handleUsageCheck('messages', async () => {
        const userMessage: Message = {
            sender: 'user',
            text: messageToSend,
            senderId: user.uid,
            senderName: user.displayName || 'User',
            timestamp: Date.now() 
        };

        if (activeGroup) {
            // Group Chat Logic (Remains the same - not subject to this bug)
            await groupService.addMessageToGroup(activeGroup.id, userMessage);
            if (messageToSend.toLowerCase().startsWith('@bot')) {
                setIsSending(true);

                const updatedGroup = await groupService.getGroupById(activeGroup.id);
                const currentMessages = updatedGroup ? updatedGroup.messages : [userMessage];
                
                const groupTeachMeCache: TeachMeCache | null = activeGroup.topic
                ? {
                    topic: activeGroup.topic,
                    language: currentPartner?.nativeLanguage || targetLanguage,
                    type: 'Grammar',
                    content: '',
                  }
                : null;

                try {
                  const botResponse = await groupService.getGroupBotResponse(currentMessages, activeGroup.partner, userProfile, correctionsEnabled, groupTeachMeCache);
                  await groupService.addMessageToGroup(activeGroup.id, {...botResponse, timestamp: Date.now()}); 
                } finally {
                  setIsSending(false);
                }
            }
        } else {
            // SOLO CHAT LOGIC (Fixed for instantaneous display and atomic response)
            setIsSending(true); // Start sending visual feedback

            // 1. IMMEDIATELY add the user message for instantaneous display
            setCurrentChatMessages((prev) => [...prev, userMessage]); 

            // 2. Build the full context array for the API call using the current messages state 
            //    from this closure + the new user message.
            const messagesContext = [...currentChatMessages, userMessage];

            try {
                // 3. Fetch AI response
                const aiResponse = await geminiService.getChatResponse(
                    messagesContext,
                    currentPartner!, // currentPartner is guaranteed here
                    correctionsEnabled,
                    userProfile,
                    teachMeCache,
                    false // Not a group chat
                );
                
                // 4. Append only the AI message to the state
                setCurrentChatMessages((prev) => [...prev, { ...aiResponse, timestamp: Date.now() }]);
            } catch (error) {
                console.error("Solo Chat Response Error:", error);
                const errorMessage: Message = {
                    sender: "ai",
                    text: "Sorry, I encountered an error. Please try again.",
                    timestamp: Date.now()
                };
                // 4. Append only the error message
                setCurrentChatMessages((prev) => [...prev, errorMessage]);
            } finally {
                setIsSending(false);
            }
        }
    });
  };

  const handleSendTextMessage = async (messageText: string) => {
    if (!messageText.trim() || isSending) return;

    handleUsageCheck("messages", async () => {
      const userMessage: Message = { sender: "user", text: messageText };

      if (activeGroup) {
        // Group Chat Logic
        await groupService.addMessageToGroup(activeGroup.id, userMessage);
        // Simulate bot response immediately after user sends message
        const updatedGroup = await groupService.getGroupById(activeGroup.id);
        const currentMessages = updatedGroup ? updatedGroup.messages : [userMessage];
        // FIX: Create a specific cache object for the group context
        // This ensures the bot knows about the group's topic, not the user's individual cache.
        const groupTeachMeCache: TeachMeCache | null = activeGroup.topic
        ? {
            topic: activeGroup.topic,
            language: currentPartner?.nativeLanguage || targetLanguage,
            type: 'Grammar', // Type can be generic as the topic provides context
            content: '', // Content is not needed for the prompt
          }
        : null;

        const botResponse = await groupService.getGroupBotResponse(currentMessages, activeGroup.partner, userProfile, true, groupTeachMeCache);
        await groupService.addMessageToGroup(activeGroup.id, botResponse);
      } else {
        // Single Chat Logic
        setCurrentChatMessages((prev) => [...prev, userMessage]);
      }
    });
  };

  const handleSendVoiceMessage = async (voiceMessage: Message) => {
    if (activeGroup) {
      await groupService.addMessageToGroup(activeGroup.id, voiceMessage);
    } else {
      setCurrentChatMessages((prev) => [...prev, voiceMessage]);
    }
  };

  const handleUsageCheck = async (feature: UsageKey, action: () => void) => {
    if (!user) return;
    const canProceed = await checkAndIncrementUsage(
      user.uid,
      feature,
      user.subscription,
    );
    if (canProceed) {
      action();
    } else {
      setSubscriptionModalReason("limit");
      setShowSubscriptionModal(true);
    }
  };

  const findPartners = async () => {
    handleUsageCheck("searches", async () => {
      setIsLoadingPartners(true);
      setError(null);
      setPartners([]);
      try {
        const nativeLangName =
          LANGUAGES.find((l) => l.code === nativeLanguage)?.name ||
          nativeLanguage;
        const targetLangName =
          LANGUAGES.find((l) => l.code === targetLanguage)?.name ||
          targetLanguage;
        const generatedPartners = await geminiService.generatePartners(
          nativeLangName,
          targetLangName,
          user.hobbies,
        );
        setPartners(generatedPartners);
      } catch (err: any) {
        setError(err.message || "An unknown error occurred.");
      } finally {
        setIsLoadingPartners(false);
      }
    });
  };

  const handleStartChat = async (partner: Partner) => {
    setCurrentPartner(partner);
    setNudgeCount(0); // <--- FIX 2: Reset nudge count on starting a new chat

    // If a saved chat exists for this partner, resume it.
    if (savedChat && savedChat.partner.name === partner.name) {
      setCurrentChatMessages(savedChat.messages);
    } else {
      // New chat - Start with an empty array.
      setCurrentChatMessages([]);
    }
  };

  const handleCloseChat = async () => {
    // Make the function asynchronous
    if (activeGroup && user) {
      // Await the asynchronous operation to complete.
      // This ensures the database has updated BEFORE the UI state changes.
      await groupService.leaveGroup(activeGroup.id, user.uid);
    }
    // Now, it's safe to dismiss the chat UI
    setCurrentPartner(null);
    // Also explicitly clear the local activeGroup state
    setActiveGroup(null);
  };

  const handleProfileChange = (profile: {
    name: string;
    hobbies: string;
    bio: string;
  }) => {
    if (user) {
      firestoreService.updateUserProfile(user.uid, profile);
    }
  };

  const handleSaveChat = (messages: Message[]) => {
    if (currentPartner && user) {
      const sanitizedMessages = messages.map((msg) => ({
        sender: msg.sender,
        senderId: msg.senderId || null, // <-- ADDED: Preserve senderId for proper rendering/identification
        senderName: msg.senderName || null, // <-- ADDED: Preserve senderName 
        text: msg.text,
        correction: msg.correction || null,
        translation: msg.translation || null,
        audioUrl: msg.audioUrl || null, // <-- ADDED: For complete saving of voice messages
        audioDuration: msg.audioDuration || null, // <-- ADDED
        timestamp: msg.timestamp || null, // <-- ADDED: For consistent message order
      }));

      const chatToSave = {
        partner: currentPartner,
        messages: sanitizedMessages,
      };
      firestoreService.saveChatInFirestore(user.uid, chatToSave);
      alert("Chat saved!");
    }
  };

  const handleDeleteSavedChat = () => {
    if (
      user &&
      window.confirm("Are you sure you want to delete this saved chat?")
    ) {
      firestoreService.deleteChatFromFirestore(user.uid);
    }
  };

  const handleResumeChat = () => {
    if (savedChat) {
      setCurrentPartner(savedChat.partner);
      setActiveGroup(null);
      setCurrentChatMessages(savedChat.messages);
    }
  };

  const handleShareQuizResults = (
    topic: string,
    score: number,
    questions: QuizQuestion[],
    userAnswers: string[],
): Promise<void> => {
    
    // Mutex: Prevent multiple simultaneous executions of this function
    if (isSending) {
        return Promise.resolve();
    }

    setIsSending(true); // Global Lock START

    return new Promise<void>(async (resolve) => {
        try {
            // 1. Prepare Message
            let quizSummary = `I just took a quiz on "${topic}" and my score was ${score}/${questions.length}. `;

            const incorrectAnswers = questions
                .map((q, index) => ({
                    question: q.question,
                    userAnswer: userAnswers[index],
                    correctAnswer: q.correctAnswer,
                }))
                .filter((item, index) => userAnswers[index] !== item.correctAnswer);

            if (incorrectAnswers.length > 0) {
                quizSummary += `I missed ${incorrectAnswers.length} question(s). I would like help understanding the following: `;
                incorrectAnswers.forEach((item, index) => {
                    quizSummary += `[Q${index + 1}: "${item.question}". My Answer: "${item.userAnswer}". Correct: "${item.correctAnswer}"]. `;
                });
                quizSummary = quizSummary.trim();
            } else {
                quizSummary += "I got everything right, but I'd love some encouragement!";
            }

            const quizMessage: Message = {
                sender: "user",
                text: quizSummary,
                senderId: user.uid,
                senderName: user.displayName || "User",
                timestamp: Date.now(),
            };

            // 2. Check Usage
            const canProceed = await checkAndIncrementUsage(
                user.uid,
                "messages",
                user.subscription,
            );

            if (!canProceed) {
                setSubscriptionModalReason("limit");
                setShowSubscriptionModal(true);
                return; // Exit try block and go to finally
            }

            // 3. Execute Action
            if (activeGroup) {
                // Group Chat Logic
                const groupQuizMessage = { ...quizMessage, text: `@bot ${quizSummary}` };

                // 3a. Add user message
                await groupService.addMessageToGroup(activeGroup.id, groupQuizMessage);

                try {
                    // 3b. Fetch updated context, get bot response, and add it
                    const updatedGroup = await groupService.getGroupById(activeGroup.id);
                    const currentMessages = updatedGroup ? [...updatedGroup.messages, groupQuizMessage] : [groupQuizMessage];

                    const groupTeachMeCache: TeachMeCache | null = activeGroup.topic
                        ? {
                            topic: activeGroup.topic,
                            language: currentPartner?.nativeLanguage || targetLanguage,
                            type: "Grammar",
                            content: "",
                        }
                        : null;

                    const botResponse = await groupService.getGroupBotResponse(
                        currentMessages,
                        activeGroup.partner,
                        userProfile,
                        true,
                        groupTeachMeCache,
                    );
                    await groupService.addMessageToGroup(activeGroup.id, {
                        ...botResponse,
                        timestamp: Date.now(),
                    });
                } catch (error) {
                    console.error("Bot Reply Failed in Group Quiz Share:", error);
                    const errorMessage: Message = {
                        sender: "ai",
                        text: "Sorry, I encountered an error responding to the quiz share.",
                    };
                    await groupService.addMessageToGroup(activeGroup.id, {
                        ...errorMessage,
                        timestamp: Date.now(),
                    });
                }
            } else {
                // Solo Chat Logic - FIX: Get response immediately to prevent useEffect loop.
                
                // 3a. Immediately get the AI response for the new message
                const aiResponse = await geminiService.getChatResponse(
                    [...currentChatMessages, quizMessage], // Pass current messages + new quiz message
                    currentPartner || partners[0], 
                    true, // Corrections are implicitly on for quiz results
                    userProfile,
                    teachMeCache,
                    false // Not a group chat
                );
                
                // 3b. Single atomic update: add both the user's quiz message and the AI's reply.
                // This prevents the ChatModal useEffect from being triggered by a lone user message.
                setCurrentChatMessages((prev) => [...prev, quizMessage, aiResponse]);
            }

            // 4. Update UI context for chat
            if (!currentPartner) {
                const partnerToChatWith = savedChat?.partner || partners[0];
                if (partnerToChatWith) setCurrentPartner(partnerToChatWith);
            }

        } catch (error) {
            console.error("Critical error in handleShareQuizResults:", error);
        } finally {
            setIsSending(false); // Global Lock END - Crucial for preventing re-execution
            resolve();
        }
    });
  };

  const handleStartGroup = async () => {
    if (!user || activeGroup) return;

    const groupPartner = currentPartner || partners[0];
    if (!groupPartner) {
      setError(
        "Please select a language partner first to set the bot's identity.",
      );
      return;
    }

    const uniqueId = Math.random().toString(36).substring(2, 9);
    const shareLink = `${window.location.origin}/group/${uniqueId}`;

    // Update the initial message to use "@bot"
    const initialMessageText = `Welcome to the group chat! To talk to the bot, start your message with "@bot".\n\nShare this link with up to two friends to join: ${shareLink}`;
    const initialMessage: Message = { sender: "ai", text: initialMessageText };

    try {
      await groupService.createGroupInFirestore(
        uniqueId,
        user.uid,
        shareLink,
        groupPartner,
        initialMessage,
      );

      alert(`Group started! Copy this link to share: ${shareLink}`);
    } catch (error) {
      console.error("Error starting group:", error);
      setError("Failed to start group chat. Please try again.");
    }
  };

  const handleShareGroupLink = (link: string) => {
    navigator.clipboard
      .writeText(link)
      .then(() =>
        alert(
          `Group link copied to clipboard! You can share it with up to 2 friends.`,
        ),
      )
      .catch((err) => console.error("Could not copy text: ", err));
  };

  const handleSetGroupTopic = (topic: string) => {
    if (activeGroup && user?.uid === activeGroup.creatorId) {
      groupService.updateGroupTopic(activeGroup.id, topic);
    }
  };

  const handleUpgrade = async () => {
    if (!user) return;
    setIsUpgrading(true);

    try {
      const session = await createCheckoutSession(payments, {
        price: "price_1SAjgiGYNyUbUaQ68m7HlTMu",
        success_url: `${window.location.origin}?checkout_success=true`,
        cancel_url: window.location.origin,
      });

      console.log("Stripe session created:", session);

      window.location.assign(session.url);
    } catch (error) {
      console.error("Stripe Checkout Error:", error);
      alert(
        "Could not connect to the payment gateway. Please try again later.",
      );
      setIsUpgrading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!user) return;
    setIsCancelling(true);

    const currentUser = auth.currentUser;

    if (!currentUser) {
      alert("Could not verify user. Please sign in again.");
      setIsCancelling(false);
      return;
    }

    try {
      const functionUrl =
        "https://us-central1-langcampus-exchange.cloudfunctions.net/createStripePortalLink";

      const idToken = await currentUser.getIdToken();

      const response = await fetch(functionUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          returnUrl: window.location.origin,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create portal link.");
      }

      const { url } = await response.json();
      window.location.assign(url);
    } catch (error) {
      console.error("Error creating portal link:", error);
      alert(
        "An error occurred while trying to access your subscription details. Please try again later.",
      );
    } finally {
      setIsCancelling(false);
    }
  };

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.get("checkout_success")) {
      alert("Your subscription is complete! Welcome to Langcampus Pro.");
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  const userProfile = {
    name: user?.name || "",
    hobbies: user?.hobbies || "",
    bio: user?.bio || "",
  };

  const savedChat = user?.savedChat || null;

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans flex flex-col">
      <header className="bg-white dark:bg-gray-800 shadow-md p-4 flex flex-col md:flex-row justify-between items-center gap-4">
        <h1 className="text-3xl font-bold text-blue-600 dark:text-blue-400 flex items-center">
          <img
            src="/logo.png"
            alt="Langcampus Exchange Logo"
            className="h-16 w-16 mr-3"
          />
          Langcampus Exchange
        </h1>
        <div className="flex flex-wrap items-center justify-center md:justify-end gap-4">
          <LanguageSelector
            label="I speak:"
            value={nativeLanguage}
            onChange={setNativeLanguage}
            options={LANGUAGES}
          />
          <LanguageSelector
            label="I want to learn:"
            value={targetLanguage}
            onChange={setTargetLanguage}
            options={LANGUAGES}
          />
          <button
            onClick={findPartners}
            disabled={isLoadingPartners}
            className="px-6 py-2 bg-blue-500 text-white font-bold rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isLoadingPartners ? "Searching..." : "Find New Pals"}
          </button>
          <UserProfile
            profile={userProfile}
            onProfileChange={handleProfileChange}
            onUpgradeClick={() => {
              setSubscriptionModalReason("manual");
              setShowSubscriptionModal(true);
            }}
            onCancelSubscription={handleCancelSubscription}
            subscriptionStatus={user?.subscription || "free"}
            usageData={user?.usage}
            isUpgrading={isUpgrading}
            isCancelling={isCancelling}
          />
        </div>
      </header>

      <main className="p-4 sm:p-8 flex-grow">
        {showTutorial && (
          <div className="bg-blue-100 dark:bg-blue-900 border-l-4 border-blue-500 text-blue-700 dark:text-blue-200 p-4 rounded-md mb-6 flex justify-between items-center shadow-lg">
            <div>
              <p className="font-bold">New Here?</p>
              <p>
                Click the "My Info" icon to learn how to use Langcampus
                Exchange.
              </p>
            </div>
            <button
              onClick={() => {
                setShowTutorial(false);
                localStorage.setItem("tutorialShown", "true");
              }}
              className="p-2 text-blue-500 hover:text-blue-700"
            >
              <CloseIcon className="w-6 h-6" />
            </button>
          </div>
        )}

        {savedChat && (
          <div className="bg-green-100 dark:bg-green-900 border-l-4 border-green-500 text-green-700 dark:text-green-200 p-4 rounded-md mb-6 flex justify-between items-center shadow-lg">
            <div>
              <p className="font-bold">
                Resume your conversation with {savedChat.partner.name}?
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleResumeChat}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
              >
                Resume Chat
              </button>
              <button
                onClick={handleDeleteSavedChat}
                className="p-2 text-red-500 hover:text-red-700 dark:hover:text-red-300"
                aria-label="Delete saved chat"
              >
                <TrashIcon className="w-6 h-6" />
              </button>
            </div>
          </div>
        )}

        {isLoadingPartners && (
          <div className="flex justify-center mt-12">
            <LoadingSpinner size="lg" />
          </div>
        )}
        {error && (
          <div className="text-center text-red-500 mt-12 bg-red-100 dark:bg-red-900 p-4 rounded-md">
            {error}
          </div>
        )}
        {!isLoadingPartners && partners.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {partners.map((p) => (
              <PartnerCard
                key={p.name}
                partner={p}
                onStartChat={handleStartChat}
              />
            ))}
          </div>
        )}
        {!isLoadingPartners &&
          !error &&
          partners.length === 0 &&
          !savedChat && (
            <div className="text-center mt-12 text-gray-500">
              <p className="text-xl">Welcome to Langcampus Exchange!</p>
              <p>
                Select your languages and click "Find New Pals" to start your
                journey.
              </p>
            </div>
          )}
      </main>

      {currentPartner && (
        <ChatModal
          user={user}
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
          isGroupChat={!!activeGroup}
          groupTopic={activeGroup?.topic || null}
          groupChat={activeGroup}
          onStartGroup={handleStartGroup}
          userIsGroupCreator={user?.uid === activeGroup?.creatorId}
          onShareGroupLink={handleShareGroupLink}
          onSetGroupTopic={handleSetGroupTopic}
          newMessage={newMessage}
          setNewMessage={setNewMessage}
          isSending={isSending}
          setIsSending={setIsSending}
          onTextSubmit={handleTextSubmit}
          onSendTextMessage={handleSendTextMessage}
          onSendVoiceMessage={handleSendVoiceMessage}
          nudgeCount={nudgeCount} 
          onAddNudge={handleAddNudge}
        />
      )}
      {showSubscriptionModal && (
        <SubscriptionModal
          onClose={() => setShowSubscriptionModal(false)}
          onSubscribe={handleUpgrade}
          reason={subscriptionModalReason}
          isUpgrading={isUpgrading}
        />
      )}
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
    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
      {label}
    </label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
    >
      {options.map((lang) => (
        <option key={lang.code} value={lang.code}>
          {lang.name}
        </option>
      ))}
    </select>
  </div>
);

// Main App component - this is now the single source of truth for auth state
const App: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100 dark:bg-gray-900">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/terms-of-service" element={<TermsOfService />} />
      <Route path="/privacy-policy" element={<PrivacyPolicy />} />

      {/* ADD a new route for joining groups */}
      <Route
        path="/group/:groupId"
        element={user ? <GroupJoinPage /> : <LoginScreen />}
      />

      {/* The main route */}
      <Route
        path="/*"
        element={
          user ? (
            <Layout>
              <AppContent user={user} />
            </Layout>
          ) : (
            <LoginScreen />
          )
        }
      />
    </Routes>
  );
};

export default App;
