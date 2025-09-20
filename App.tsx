
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { UserProfileData, Partner, Message, QuizQuestion, SavedChat, Language } from './types';
import { LANGUAGES } from './constants';
import * as geminiService from './services/geminiService';
import { ChevronDownIcon, CloseIcon, InfoIcon, TrashIcon, BookOpenIcon, VolumeUpIcon, SaveIcon, SendIcon } from './components/Icons';
import LoadingSpinner from './components/LoadingSpinner';
import { grammarData, vocabData } from './teachMeData';

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


// User Profile Component
const UserProfile: React.FC<{
  profile: UserProfileData;
  onProfileChange: (profile: UserProfileData) => void;
}> = ({ profile, onProfileChange }) => {
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

  return (
    <>
      {/* This is the new, cleaner button that will open the modal */}
      <button
        onClick={() => setIsOpen(true)}
        className="p-2 rounded-full text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
        aria-label="Open user profile"
      >
        <InfoIcon className="w-6 h-6" />
      </button>
      
      {/* This is the modal that will appear when the button is clicked */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4" role="dialog" aria-modal="true">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md animate-fade-in-down">
                 <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">My Info</h2>
                    <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200" aria-label="Close profile editor">
                        <CloseIcon className="w-6 h-6" />
                    </button>
                </div>
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
                </div>
                 <div className="flex justify-end p-4 border-t dark:border-gray-700">
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
}> = ({ partner, onStartChat }) => (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden transform hover:-translate-y-1 transition-transform duration-300 flex flex-col">
        <img src={partner.avatar} alt={partner.name} className="w-full h-48 object-cover"/>
        <div className="p-4 flex flex-col flex-grow">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">{partner.name}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Speaks: {partner.nativeLanguage}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Learning: {partner.learningLanguage}</p>
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

// Tutorial Modal Component
const TutorialModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4" role="dialog" aria-modal="true">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-fade-in-down">
            <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome to Polyglot Pal!</h2>
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
const QuizModal: React.FC<{ questions: QuizQuestion[]; topic: string; onClose: () => void }> = ({ questions, topic, onClose }) => {
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
                        <button onClick={onClose} className="mt-4 px-6 py-2 bg-blue-500 text-white font-bold rounded-lg hover:bg-blue-600">
                            Finish
                        </button>
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
const TeachMeModal: React.FC<{ language: string; onClose: () => void; nativeLanguage: string; }> = ({ language, onClose, nativeLanguage }) => {
    const [activeTab, setActiveTab] = useState<'Grammar' | 'Vocabulary'>('Grammar');
    const [level, setLevel] = useState(1); // State for the difficulty level
    const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
    const [content, setContent] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[] | null>(null);
    const [showQuiz, setShowQuiz] = useState(false);

    // Reset topic when tab or level changes
    useEffect(() => {
        setSelectedTopic(null);
        setContent('');
        setQuizQuestions(null);
    }, [activeTab, level]);

    const getTopicsForLevel = () => {
        if (activeTab === 'Grammar') {
            const langData = grammarData[language as keyof typeof grammarData] || [];
            return langData.filter(topic => topic.level === level).map(topic => topic.title);
        }
        if (activeTab === 'Vocabulary') {
            return vocabData.filter(topic => topic.level === level).map(topic => topic.title);
        }
        return [];
    };

    const availableTopics = getTopicsForLevel();

    const handleTopicSelect = async (topic: string) => {
        setSelectedTopic(topic);
        setIsLoading(true);
        setContent('');
        setQuizQuestions(null);
        try {
            const nativeLanguageName = LANGUAGES.find(lang => lang.code === nativeLanguage)?.name || nativeLanguage;
            const fetchedContent = await geminiService.getContent(topic, activeTab, language, nativeLanguageName);
            setContent(fetchedContent);
        } catch (error) {
            setContent('Sorry, there was an error loading the content. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleQuizMe = async () => {
        if (!selectedTopic) return;
        setIsLoading(true);
        try {
            const questions = await geminiService.generateQuiz(selectedTopic, activeTab, language);
            setQuizQuestions(questions);
            setShowQuiz(true);
        } catch (error) {
            alert('Failed to generate quiz. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4" role="dialog" aria-modal="true">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-fade-in-down">
                <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Teach Me: {language}</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200" aria-label="Close learning module">
                        <CloseIcon className="w-6 h-6" />
                    </button>
                </div>
                <div className="flex-grow flex overflow-hidden">
                    <div className="w-1/3 border-r dark:border-gray-700 p-4 flex flex-col">
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
                        <ul className="space-y-2 overflow-y-auto flex-grow">
                           {availableTopics.length > 0 ? availableTopics.map(topic => (
                                <li key={topic}>
                                    <button onClick={() => handleTopicSelect(topic)} className={`w-full text-left p-2 rounded text-sm ${selectedTopic === topic ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                                        {topic}
                                    </button>
                                </li>
                           )) : <p className="text-gray-500 text-center p-4">No topics found for this level and language.</p>}
                        </ul>
                    </div>
                    <div className="w-2/3 p-6 overflow-y-auto">
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
            {showQuiz && quizQuestions && <QuizModal questions={quizQuestions} topic={selectedTopic!} onClose={() => setShowQuiz(false)} />}
        </div>
    );
};


// Chat Modal Component
const ChatModal: React.FC<{
  partner: Partner;
  initialMessages: Message[];
  onClose: () => void;
  onSaveChat: (messages: Message[]) => void;
  userProfile: UserProfileData;
  nativeLanguage: string;
}> = ({ partner, initialMessages, onClose, onSaveChat, userProfile, nativeLanguage }) => { 
    const [messages, setMessages] = useState<Message[]>(initialMessages);
    const [newMessage, setNewMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [correctionsEnabled, setCorrectionsEnabled] = useState(true);
    const [showTeachMe, setShowTeachMe] = useState(false);
    const chatHistoryRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        chatHistoryRef.current?.scrollTo(0, chatHistoryRef.current.scrollHeight);
    }, [messages]);
    
    const handleSpeak = async (text: string) => {
      try {
        const audioContent = await geminiService.synthesizeSpeech(text, partnerLanguageCode);
        const audio = new Audio("data:audio/mp3;base64," + audioContent);
        audio.play();
      } catch (error) {
        console.error("Error synthesizing speech:", error);
        // Fallback to browser's speech synthesis if the API fails
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = partnerLanguageCode;
        window.speechSynthesis.speak(utterance);
      }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || isSending) return;

        const userMessage: Message = { sender: 'user', text: newMessage };
        setMessages(prev => [...prev, userMessage]);
        setNewMessage('');
        setIsSending(true);

        try {
            const updatedMessages = [...messages, userMessage];
            const aiResponse = await geminiService.getChatResponse(updatedMessages, partner, correctionsEnabled, userProfile);
            setMessages(prev => [...prev, aiResponse]);
        } catch (error) {
            console.error(error);
            const errorMessage: Message = { sender: 'ai', text: 'Sorry, I encountered an error. Please try again.' };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsSending(false);
        }
    };

    const partnerLanguageObject = LANGUAGES.find(lang => 
      partner.nativeLanguage.startsWith(lang.code.split('-')[0])
    ) || LANGUAGES.find(lang => lang.code === 'en-US')!;

    const partnerLanguageName = partnerLanguageObject.name;
    const partnerLanguageCode = partnerLanguageObject.code;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-40 p-4" role="dialog" aria-modal="true">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-fade-in-down">
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
            {showTeachMe && <TeachMeModal language={partnerLanguageName} onClose={() => setShowTeachMe(false)} nativeLanguage={nativeLanguage} />}
        </div>
    );
};


// Main App Component
const App: React.FC = () => {
  const [userProfile, setUserProfile] = useStickyState<UserProfileData>({ name: '', hobbies: '', bio: '' }, 'userProfile');
  const [nativeLanguage, setNativeLanguage] = useStickyState<string>(LANGUAGES[0].code, 'nativeLanguage');
  const [targetLanguage, setTargetLanguage] = useStickyState<string>(LANGUAGES[1].code, 'targetLanguage');
  const [partners, setPartners] = useState<Partner[]>([]);
  const [isLoadingPartners, setIsLoadingPartners] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPartner, setCurrentPartner] = useState<Partner | null>(null);
  const [currentChatMessages, setCurrentChatMessages] = useState<Message[]>([]);
  const [savedChat, setSavedChat] = useStickyState<SavedChat | null>(null, 'savedChat');
  const [showTutorial, setShowTutorial] = useStickyState<boolean>(true, 'showTutorial');

  const findPartners = useCallback(async () => {
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
  }, [nativeLanguage, targetLanguage, userProfile.hobbies]);

  const handleStartChat = (partner: Partner) => {
    setCurrentPartner(partner);
    setCurrentChatMessages([]);
  };

  const handleCloseChat = () => setCurrentPartner(null);

  const handleSaveChat = (messages: Message[]) => {
    if (currentPartner) {
        setSavedChat({ partner: currentPartner, messages });
        alert('Chat saved!');
    }
  };
  
  const handleResumeChat = () => {
    if (savedChat) {
        setCurrentPartner(savedChat.partner);
        setCurrentChatMessages(savedChat.messages);
    }
  };
  
  const handleDeleteSavedChat = () => {
      if (window.confirm('Are you sure you want to delete this saved chat?')) {
          setSavedChat(null);
      }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans">
      <header className="bg-white dark:bg-gray-800 shadow-md p-4 flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
        <h1 className="text-3xl font-bold text-blue-600 dark:text-blue-400 flex items-center">
          <img src="/logo.png" alt="Langcampus Exchange Logo" className="h-8 w-8 mr-3" />
          Langcampus Exchange
        </h1>
        <div className="flex flex-col sm:flex-row items-center gap-4">
           <LanguageSelector label="I speak:" value={nativeLanguage} onChange={setNativeLanguage} options={LANGUAGES} />
           <LanguageSelector label="I want to learn:" value={targetLanguage} onChange={setTargetLanguage} options={LANGUAGES} />
           <button onClick={findPartners} disabled={isLoadingPartners} className="px-6 py-2 bg-blue-500 text-white font-bold rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed">
            {isLoadingPartners ? 'Searching...' : 'Find New Pals'}
          </button>
           {/* The UserProfile is now here, inside the flex container */}
           <UserProfile profile={userProfile} onProfileChange={setUserProfile} />
        </div>
        {/* The old absolute positioning wrapper is gone */}
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

      {currentPartner && <ChatModal partner={currentPartner} initialMessages={currentChatMessages} onClose={handleCloseChat} onSaveChat={handleSaveChat} nativeLanguage={nativeLanguage}/>}
      {showTutorial && <TutorialModal onClose={() => setShowTutorial(false)} />}
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


export default App;
