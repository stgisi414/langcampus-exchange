import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Flashcard, 
  FlashcardActivityType, 
  FlashcardMode, 
  Language, 
  TeachMeData,
  UserProfileData,
  VocabData
} from '../types'; // Make sure all these types are in your types.ts
import * as geminiService from '../services/geminiService';
import LoadingSpinner from './LoadingSpinner';
import {
  VolumeUpIcon,
  XIcon,
  CheckIcon,
  LightBulbIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from './Icons.tsx';

// Define a new SessionState that includes setup
type ModalSessionState = 'configuring' | 'studying' | 'reviewing' | 'finished';

interface FlashcardModalProps {
  user: UserProfileData;
  targetLanguage: string; // This is the language code (e.g., "ko")
  nativeLanguage: string; // This is the language code (e.g., "en")
  onClose: () => void;
  onAddXp: (xp: number) => void;
  availableLanguages: Language[];
  teachMeData: TeachMeData;
  onSpeak: (text: string, langCode: string) => void;
}

export const FlashcardModal: React.FC<FlashcardModalProps> = ({
  user,
  targetLanguage,
  nativeLanguage,
  onClose,
  onAddXp,
  availableLanguages,
  teachMeData,
  onSpeak
}) => {
  // --- STATE FOR MODAL ---
  const [modalState, setModalState] = useState<ModalSessionState>('configuring');
  
  // --- STATE FOR SETUP SCREEN ---
  // Use `teachMeData` to find the vocab for the target language
  const vocabTopics = useMemo(() => {
    return teachMeData.vocabData[targetLanguage] || [];
  }, [teachMeData.vocabData, targetLanguage]);

  const [selectedTopic, setSelectedTopic] = useState<VocabData | null>(vocabTopics[0] || null);
  const [selectedActivityType, setSelectedActivityType] = useState<FlashcardActivityType>('translation');
  const [selectedMode, setSelectedMode] = useState<FlashcardMode>('study');

  // --- STATE FOR FLASHCARD SESSION ---
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isLoadingContent, setIsLoadingContent] = useState(false);

  // State for Review Mode
  const [reviewInput, setReviewInput] = useState('');
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [hasViewedPrompt, setHasViewedPrompt] = useState(false);

  // State for Definition Translation
  const [translatedDefinition, setTranslatedDefinition] = useState<string | null>(null);
  const [isTranslatingDefinition, setIsTranslatingDefinition] = useState(false);

  // State for Sentence Translation
  const [exampleSentence, setExampleSentence] = useState<string | null>(null);
  const [translatedSentence, setTranslatedSentence] = useState<string | null>(null);
  const [isLoadingSentence, setIsLoadingSentence] = useState(false);
  const [isTranslatingSentence, setIsTranslatingSentence] = useState(false);
  
  // --- DERIVED VALUES ---
  const currentCard = useMemo(() => flashcards[currentIndex], [flashcards, currentIndex]);
  const targetLangName = useMemo(() => availableLanguages.find(lang => lang.code === targetLanguage)?.name || 'the selected language', [availableLanguages, targetLanguage]);
  const translationTargetLangName = useMemo(() => availableLanguages.find(lang => lang.code === nativeLanguage)?.name || 'your language', [availableLanguages, nativeLanguage]);

  // Options for setup dropdowns
  const activityTypeOptions = [
    { value: 'translation', label: 'Word -> Translation' },
    { value: 'definition', label: 'Word -> Definition' },
    { value: 'sentence', label: 'Word -> Sentence' },
    { value: 'image', label: 'Word -> Image' },
  ];
  const modeOptions = [
    { value: 'study', label: 'Study Mode' },
    { value: 'review', label: 'Review Mode' },
  ];

  // --- FUNCTIONS ---

  /**
   * Called when "Start Session" is clicked.
   * Creates the flashcard deck and changes the modal state.
   */
  const handleStartSession = () => {
    if (!selectedTopic) return;

    // Create the initial flashcard deck from the topic's items
    const newFlashcards = selectedTopic.items.map(item => ({
      id: item,
      term: item
      // All other content (translation, definition, etc.) will be lazy-loaded
    }));

    setFlashcards(newFlashcards);
    setCurrentIndex(0);
    setModalState(selectedMode === 'study' ? 'studying' : 'reviewing');
  };

  /**
   * Helper to update a single card in the main `flashcards` state.
   */
  const handleUpdateCard = (index: number, updatedCard: Flashcard) => {
    setFlashcards(prevCards => {
      const newCards = [...prevCards];
      if (newCards[index]) {
        newCards[index] = updatedCard;
      }
      return newCards;
    });
  };

  const fetchCardContent = useCallback(async (card: Flashcard, type: FlashcardActivityType) => {
    if (!selectedTopic) return; // Need topic info

    let contentField: keyof Flashcard | null = null;
    let setIsLoading: React.Dispatch<React.SetStateAction<boolean>> | null = null;
    let setContent: ((content: any) => void) | null = null;

    switch (type) {
      case 'translation':
        if (!card.translation) contentField = 'translation';
        break;
      case 'definition':
        if (!card.definition) contentField = 'definition';
        break;
      case 'image':
        if (card.imageUrl === undefined) contentField = 'imageUrl';
        break;
      case 'sentence':
        if (!card.sentence) {
          contentField = 'sentence';
          setIsLoading = setIsLoadingSentence;
          setContent = setExampleSentence;
        } else {
          setExampleSentence(card.sentence);
        }
        break;
      default:
        return;
    }
    
    // Set main loader for all types except sentence (which has its own)
    if (type !== 'sentence' && contentField) {
      setIsLoadingContent(true);
    }
    if (setIsLoading) {
      setIsLoading(true);
    }

    if (contentField) {
      try {
        const updatedCard = await geminiService.generateFlashcardContent(
          card,
          type,
          targetLangName,
          translationTargetLangName,
          selectedTopic.level,
          selectedTopic.topic
        );

        handleUpdateCard(currentIndex, updatedCard);

        if (setContent && contentField in updatedCard) {
          setContent(updatedCard[contentField as keyof Flashcard]);
        }
      } catch (error) {
        console.error(`Error fetching content for ${type}:`, error);
      } finally {
        if (type !== 'sentence') setIsLoadingContent(false);
        if (setIsLoading) setIsLoading(false);
      }
    } else {
      // Content already exists or no fetch needed
      setIsLoadingContent(false);
      if (setIsLoading) setIsLoading(false);
    }
  }, [
    currentIndex,
    selectedTopic,
    targetLangName,
    translationTargetLangName,
  ]);

  // This useEffect triggers when the session starts (studying/reviewing)
  // and when the card index changes.
  useEffect(() => {
    if ((modalState === 'studying' || modalState === 'reviewing') && currentCard) {
      // Reset states for the new card
      setIsLoadingContent(true);
      setExampleSentence(null);
      setIsLoadingSentence(false);
      setTranslatedDefinition(null);
      setIsTranslatingDefinition(false);
      setTranslatedSentence(null);
      setIsTranslatingSentence(false);
      setIsFlipped(false);
      
      // Fetch primary content for the current card
      fetchCardContent(currentCard, selectedActivityType);

      // Handle content that might already exist from a previous fetch
      if (selectedActivityType === 'translation' && currentCard.translation) setIsLoadingContent(false);
      if (selectedActivityType === 'definition' && currentCard.definition) setIsLoadingContent(false);
      if (selectedActivityType === 'image' && currentCard.imageUrl !== undefined) setIsLoadingContent(false);
      if (selectedActivityType === 'sentence' && currentCard.sentence) {
        setExampleSentence(currentCard.sentence);
        setIsLoadingContent(false);
        setIsLoadingSentence(false);
      }

      // Pre-fetch next card's content silently
      const nextCardIndex = currentIndex + 1;
      if (nextCardIndex < flashcards.length && selectedTopic) {
        const nextCard = flashcards[nextCardIndex];
        geminiService.generateFlashcardContent(
          nextCard,
          selectedActivityType,
          targetLangName,
          translationTargetLangName,
          selectedTopic.level,
          selectedTopic.topic
        ).then(updatedNextCard => {
          handleUpdateCard(nextCardIndex, updatedNextCard);
        }).catch(error => {
          console.error("Error pre-fetching content:", error);
        });
      }
    }
  }, [
    currentIndex,
    modalState,
    currentCard,
    selectedActivityType,
    fetchCardContent,
    flashcards.length,
    selectedTopic,
    targetLangName,
    translationTargetLangName
  ]);
  
  // Reset index and state when modal is closed
  useEffect(() => {
    if (!onClose) return; // This modal is always "open" when rendered
    
    // Reset to config screen when closed
    setModalState('configuring');
    setCurrentIndex(0);
    setFlashcards([]);
    setIsFlipped(false);
    // ... other resets
    
  }, [onClose]); // This is not ideal, but `isOpen` isn't a prop.
                 // We'll rely on the parent unmounting/remounting.
                 // Let's reset when the modal *opens* (i.e., mounts)
  useEffect(() => {
    setModalState('configuring');
    setCurrentIndex(0);
    setFlashcards([]);
    setIsFlipped(false);
    setFeedback(null);
    setReviewInput('');
    // etc.
  }, []); // Empty dependency array means this runs on mount

  const handleFlip = () => {
    if (modalState === 'studying') {
      setIsFlipped(!isFlipped);
    }
  };

  const handleSubmitReview = async () => {
    if (!currentCard || feedback) return;

    const result = await geminiService.checkFlashcardReview(
      reviewInput,
      currentCard.term,
      targetLangName
    );
    setFeedback(result);
    if (result === 'correct') {
      onAddXp(5); // Add XP for correct review
    }
  };

  const nextCard = () => {
    if (currentIndex < flashcards.length - 1) {
      setCurrentIndex(currentIndex + 1);
      // Resets for the next card
      setIsFlipped(false);
      setReviewInput('');
      setFeedback(null);
      setHasViewedPrompt(false);
      setTranslatedDefinition(null);
      setIsTranslatingDefinition(false);
      setExampleSentence(null);
      setTranslatedSentence(null);
      setIsTranslatingSentence(false);
    } else {
      setModalState('finished');
      // onSessionComplete(flashcards); // We don't have this prop, but that's ok
    }
  };

  const prevCard = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      // Resets
      setIsFlipped(false);
      setReviewInput('');
      setFeedback(null);
      setHasViewedPrompt(false);
      setTranslatedDefinition(null);
      setIsTranslatingDefinition(false);
      setExampleSentence(null);
      setTranslatedSentence(null);
      setIsTranslatingSentence(false);
    }
  };

  const handleTranslateDefinition = async () => {
    if (!currentCard?.definition || isTranslatingDefinition || translatedDefinition || !selectedTopic) return;

    setIsTranslatingDefinition(true);
    try {
      const translation = await geminiService.getTranslation(
        currentCard.definition,
        targetLangName,
        translationTargetLangName,
        selectedTopic.level
      );
      setTranslatedDefinition(translation);
    } catch (error) {
      console.error("Error translating definition:", error);
      setTranslatedDefinition("Translation failed.");
    } finally {
      setIsTranslatingDefinition(false);
    }
  };

  const handleTranslateSentence = async () => {
    if (!exampleSentence || isTranslatingSentence || translatedSentence || !selectedTopic) return;

    setIsTranslatingSentence(true);
    try {
      const translation = await geminiService.getTranslation(
        exampleSentence,
        targetLangName,
        translationTargetLangName,
        selectedTopic.level
      );
      setTranslatedSentence(translation);
    } catch (error) {
      console.error("Error translating sentence:", error);
      setTranslatedSentence("Translation failed.");
    } finally {
      setIsTranslatingSentence(false);
    }
  };

  const handleStudyAgain = () => {
    setModalState('configuring'); // Go back to setup screen
    setCurrentIndex(0);
    setFlashcards([]);
    setIsFlipped(false);
    setReviewInput('');
    setFeedback(null);
    setHasViewedPrompt(false);
    // ... all other resets
  };

  const handleViewPrompt = () => {
    setHasViewedPrompt(true);
  };
  
  // --- RENDER LOGIC ---

  const renderSetupScreen = () => (
    <>
      <div className="p-4 md:p-6 flex-grow flex flex-col space-y-4">
        <div>
          <label htmlFor="topicSelect" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Topic
          </label>
          <select
            id="topicSelect"
            className="mt-1 w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
            value={selectedTopic?.topic || ''}
            onChange={(e) => {
              const topicObj = vocabTopics.find(t => t.topic === e.target.value) || null;
              setSelectedTopic(topicObj);
            }}
          >
            {vocabTopics.length === 0 && <option disabled>No topics found for {targetLangName}</option>}
            {vocabTopics.map(topic => (
              <option key={topic.topic} value={topic.topic}>
                {topic.topic} (Level {topic.level})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="activityTypeSelect" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Activity Type
          </label>
          <select
            id="activityTypeSelect"
            className="mt-1 w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
            value={selectedActivityType}
            onChange={(e) => setSelectedActivityType(e.target.value as FlashcardActivityType)}
          >
            {activityTypeOptions.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="modeSelect" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Mode
          </label>
          <select
            id="modeSelect"
            className="mt-1 w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
            value={selectedMode}
            onChange={(e) => setSelectedMode(e.target.value as FlashcardMode)}
          >
            {modeOptions.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex items-center justify-end p-4 border-t dark:border-gray-700">
        <button
          onClick={handleStartSession}
          disabled={!selectedTopic}
          className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
        >
          Start Session
        </button>
      </div>
    </>
  );

  const renderFlashcardScreen = () => {
    let frontContent: React.ReactNode = null;
    let backContent: React.ReactNode = null;

    if (currentCard) {
      if (modalState === 'studying') {
        frontContent = <span className="text-3xl font-bold">{currentCard.term}</span>;

        if (selectedActivityType === 'translation') {
          backContent = isLoadingContent ? <LoadingSpinner size="sm" /> : (currentCard.translation || "N/A");
        } else if (selectedActivityType === 'definition') {
          if (isLoadingContent) {
            backContent = <LoadingSpinner size="sm" />;
          } else if (currentCard.definition) {
            backContent = (
              <div className="text-center w-full">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className="flex-grow">{currentCard.definition}</span>
                  <button onClick={(e) => { e.stopPropagation(); onSpeak(currentCard.definition!, targetLanguage); }} className="p-1 text-gray-500 hover:text-blue-500 flex-shrink-0" title="Read definition"><VolumeUpIcon className="w-5 h-5" /></button>
                  <button onClick={(e) => { e.stopPropagation(); handleTranslateDefinition(); }} className="p-1 text-gray-500 hover:text-blue-500 flex-shrink-0 disabled:opacity-50" disabled={isTranslatingDefinition || !!translatedDefinition} title={`Translate to ${translationTargetLangName}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 01-3.827-5.802" /></svg>
                  </button>
                </div>
                {isTranslatingDefinition && <div className="mt-2 text-sm text-gray-500"><LoadingSpinner size="sm" /> Translating...</div>}
                {translatedDefinition && <div className="mt-2 pt-2 border-t dark:border-gray-600 text-sm text-gray-600 dark:text-gray-400"><strong>{translationTargetLangName}:</strong> {translatedDefinition}</div>}
              </div>
            );
          } else {
            backContent = "Definition not available.";
          }
        } else if (selectedActivityType === 'image') {
          if (isLoadingContent) {
            backContent = <LoadingSpinner size="sm" />;
          } else if (currentCard.imageUrl) {
            backContent = <img src={currentCard.imageUrl} alt={currentCard.term} className="max-h-full max-w-full object-contain rounded-md" />;
          } else {
            backContent = "Image not available.";
          }
        } else if (selectedActivityType === 'sentence') {
          if (isLoadingSentence) {
            backContent = <LoadingSpinner size="sm" />;
          } else if (exampleSentence) {
            backContent = (
              <div className="text-center w-full">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className="flex-grow italic">"{exampleSentence}"</span>
                  <button onClick={(e) => { e.stopPropagation(); onSpeak(exampleSentence, targetLanguage); }} className="p-1 text-gray-500 hover:text-blue-500 flex-shrink-0" title="Read sentence"><VolumeUpIcon className="w-5 h-5" /></button>
                  <button onClick={(e) => { e.stopPropagation(); handleTranslateSentence(); }} className="p-1 text-gray-500 hover:text-blue-500 flex-shrink-0 disabled:opacity-50" disabled={isTranslatingSentence || !!translatedSentence} title={`Translate to ${translationTargetLangName}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 01-3.827-5.802" /></svg>
                  </button>
                </div>
                {isTranslatingSentence && <div className="mt-2 text-sm text-gray-500"><LoadingSpinner size="sm" /> Translating...</div>}
                {translatedSentence && <div className="mt-2 pt-2 border-t dark:border-gray-600 text-sm text-gray-600 dark:text-gray-400"><strong>{translationTargetLangName}:</strong> {translatedSentence}</div>}
              </div>
            );
          } else {
            backContent = "Example sentence not available.";
          }
        }
      } else { // review mode
        if (selectedActivityType === 'translation') {
          frontContent = isLoadingContent ? <LoadingSpinner size="sm" /> : (currentCard.translation || "N/A");
        } else if (selectedActivityType === 'definition') {
          frontContent = isLoadingContent ? <LoadingSpinner size="sm" /> : (currentCard.definition || "N/A");
        } else if (selectedActivityType === 'image') {
          if (isLoadingContent) {
            frontContent = <LoadingSpinner size="sm" />;
          } else if (currentCard.imageUrl) {
            frontContent = <img src={currentCard.imageUrl} alt="Flashcard prompt" className="max-h-full max-w-full object-contain rounded-md" />;
          } else {
            frontContent = "Image not available.";
          }
        } else if (selectedActivityType === 'sentence') {
          if (isLoadingSentence) {
            frontContent = <LoadingSpinner size="sm" />;
          } else if (exampleSentence) {
            frontContent = (
              <div className="text-center">
                <p className="mb-2">What word fits here?</p>
                <p className="italic">"{exampleSentence.replace(new RegExp(currentCard.term, 'i'), '_____')}"</p>
              </div>
            );
          } else {
            frontContent = "Sentence not available.";
          }
        }
        
        backContent = (
          <div className="w-full flex flex-col items-center">
            <input
              type="text"
              value={reviewInput}
              onChange={(e) => setReviewInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !feedback && handleSubmitReview()}
              className={`w-full p-2 border rounded-md dark:bg-gray-700 ${
                feedback === 'correct' ? 'border-green-500' : feedback === 'incorrect' ? 'border-red-500' : 'dark:border-gray-600'
              }`}
              placeholder={`Type the ${targetLangName} word...`}
              disabled={!!feedback}
            />
            {!feedback && <button onClick={handleSubmitReview} className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600">Check</button>}
            {feedback && (
              <div className="mt-4 w-full text-center">
                {feedback === 'correct' ? <p className="text-green-500 font-bold">Correct!</p> : <div className="text-red-500"><p className="font-bold">Not quite.</p><p>Correct answer: <strong>{currentCard.term}</strong></p></div>}
                <button onClick={nextCard} className="mt-2 w-full px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-800">Next</button>
              </div>
            )}
            {!feedback && !hasViewedPrompt && <button onClick={handleViewPrompt} className="mt-2 text-sm text-gray-500 hover:text-gray-400">Need a hint?</button>}
            {hasViewedPrompt && <p className="mt-2 text-sm text-gray-400">The word starts with: <strong>{currentCard.term[0]}</strong></p>}
          </div>
        );
      }
    }

    return (
      <>
        <div className="p-4 md:p-6 flex-grow flex flex-col items-center justify-center min-h-[350px]">
          <div
            className={`flip-card w-full h-64 md:h-80 perspective ${isFlipped || modalState === 'reviewing' ? 'flipped' : ''}`}
            onClick={handleFlip}
          >
            <div className="flip-card-inner">
              <div className="flip-card-front">{frontContent}</div>
              <div className="flip-card-back">{backContent}</div>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between p-4 border-t dark:border-gray-700">
          <button onClick={prevCard} disabled={currentIndex === 0} className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30"><ChevronLeftIcon className="w-6 h-6" /></button>
          <span className="text-sm text-gray-500 dark:text-gray-400">{currentIndex + 1} / {flashcards.length}</span>
          <button onClick={nextCard} disabled={modalState === 'reviewing' && !feedback} className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30"><ChevronRightIcon className="w-6 h-6" /></button>
        </div>
      </>
    );
  };

  const renderFinishedScreen = () => (
    <div className="p-4 md:p-6 flex-grow flex flex-col items-center justify-center min-h-[350px] text-center">
      <h4 className="text-xl font-bold mb-4">Session Complete!</h4>
      <button
        onClick={handleStudyAgain}
        className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
      >
        New Session
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75" onClick={onClose}>
      <div
        className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-11/12 max-w-lg max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {modalState === 'configuring' && 'Flashcard Setup'}
            {(modalState === 'studying' || modalState === 'reviewing') && (selectedTopic?.topic || 'Flashcard Session')}
            {modalState === 'finished' && 'Session Complete'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-sm p-1.5"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        {modalState === 'configuring' && renderSetupScreen()}
        {(modalState === 'studying' || modalState === 'reviewing') && renderFlashcardScreen()}
        {modalState === 'finished' && renderFinishedScreen()}
      </div>
    </div>
  );
};

