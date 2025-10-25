import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { UserData, Language, TeachMeType, FlashcardSettings, FlashcardActivityType, FlashcardMode } from '../types';
import { CloseIcon, ChevronLeftIcon, ChevronRightIcon, CheckIcon, XIcon, RefreshIcon, VolumeUpIcon, SentenceIcon, MicIcon } from './Icons';
import LoadingSpinner from './LoadingSpinner';
import * as geminiService from '../services/geminiService';
import * as firestoreService from '../services/firestoreService';
import * as RecordRTC from 'recordrtc';

interface Flashcard {
    id: string;
    term: string; // The word/phrase in the target language
    translation?: string; // Translation in native language
    definition?: string; // Definition in target language (maybe simplified)
    imageUrl?: string; // URL for the generated image
}

interface TeachMeData {
    grammarData: Record<string, any[]>;
    vocabData: any[];
    conversationData: Record<string, any[]>;
}

interface FlashcardModalProps {
    user: UserData;
    targetLanguage: string; // User's default target language code (e.g., 'es-ES')
    nativeLanguage: string; // User's native language code
    onClose: () => void;
    onAddXp: (amount: number) => void;
    availableLanguages: Language[];
    teachMeData: TeachMeData;
    onSpeak: (text: string, languageCode: string) => Promise<void>;
    onListen: (languageCode: string) => Promise<string>;
}

// Helper: A simple LanguageSelector component (can be moved to Icons.tsx or its own file)
const LanguageSelector: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Language[];
  className?: string;
}> = ({ label, value, onChange, options, className }) => (
  <div className={`flex items-center gap-2 ${className}`}>
    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex-shrink-0">
      {label}
    </label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 input-style"
    >
      {options.map((lang) => (
        <option key={lang.code} value={lang.code}>
          {lang.name}
        </option>
      ))}
    </select>
  </div>
);


// Helper to extract potential words from TeachMe data (simple example)
const extractWordsFromTopic = (topicData: any): string[] => {
    if (!topicData || !topicData.title) return [];
    // A very basic extraction from the title.
    const words = topicData.title.match(/[\p{L}\p{N}]+/gu) || [];
    // Filter out very short words
    return words.filter(w => w.length > 2);
};


const FlashcardModal: React.FC<FlashcardModalProps> = ({
    user,
    targetLanguage,
    nativeLanguage,
    onClose,
    onAddXp,
    availableLanguages,
    teachMeData,
    onSpeak,
}) => {
    // --- STATE ---
    // Load last settings from user profile or use defaults
    const lastSettings = user.flashcardSettings || {};
    
    const [selectedLanguageCode, setSelectedLanguageCode] = useState(lastSettings.languageCode || targetLanguage);
    const [selectedLevel, setSelectedLevel] = useState(lastSettings.level || 1);
    const [selectedTopic, setSelectedTopic] = useState<string | null>(lastSettings.topic !== undefined ? lastSettings.topic : null);
    const [activityType, setActivityType] = useState<FlashcardActivityType>(lastSettings.activityType || 'translation');
    const [mode, setMode] = useState<FlashcardMode>(lastSettings.mode || 'study');
    const [amount, setAmount] = useState(lastSettings.amount || 5);
    const [translationTargetLanguageCode, setTranslationTargetLanguageCode] = useState(lastSettings.translationTargetLanguageCode || nativeLanguage);

    const [sessionState, setSessionState] = useState<'setup' | 'loading' | 'active' | 'finished'>('setup');
    const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [reviewInput, setReviewInput] = useState('');
    const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
    const [score, setScore] = useState(0);
    const [isLoadingContent, setIsLoadingContent] = useState(false);
    const [hasViewedPrompt, setHasViewedPrompt] = useState(false);
    const [isCheckingReview, setIsCheckingReview] = useState(false);
    const [definitionTranslation, setDefinitionTranslation] = useState<string | null>(null);
    const [isLoadingDefTranslation, setIsLoadingDefTranslation] = useState(false);
    const [sentenceTranslation, setSentenceTranslation] = useState<string | null>(null);
    const [isLoadingSentenceTranslation, setIsLoadingSentenceTranslation] =
    useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);


    // Refs for debouncing settings saves
    const recorderRef = useRef<RecordRTC | null>(null);
    const audioStreamRef = useRef<MediaStream | null>(null);
    const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const settingsRef = useRef<FlashcardSettings>({}); // <-- Declaration is here
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);


    // --- MEMOS ---

    // Get the name of the language being studied
    const targetLangName = useMemo(() => 
        availableLanguages.find(l => l.code === selectedLanguageCode)?.name || selectedLanguageCode, 
        [selectedLanguageCode, availableLanguages]
    );
    
    // Get the name of the language to translate *to*
    const translationTargetLangName = useMemo(() => 
        availableLanguages.find(l => l.code === translationTargetLanguageCode)?.name || translationTargetLanguageCode, 
        [translationTargetLanguageCode, availableLanguages]
    );

    // Get the name of the user's *actual* native language (for definition prompts)
    const userNativeLangName = useMemo(() => 
        availableLanguages.find(l => l.code === nativeLanguage)?.name || nativeLanguage,
        [nativeLanguage, availableLanguages]
    );

    // Get available topics based on selected language and level
    const availableTopics = useMemo(() => {
        const langKey = targetLangName as keyof typeof teachMeData.grammarData;
        const grammar = teachMeData.grammarData[langKey] || [];
        const vocab = teachMeData.vocabData || [];
        // Combine and filter by level
        return [...grammar, ...vocab].filter(topic => topic.level === selectedLevel);
    }, [selectedLevel, targetLangName, teachMeData]);

    // --- EFFECTS & CALLBACKS (Order is important!) ---

    // Debounced effect to save settings to Firestore as they change
    useEffect(() => {
        settingsRef.current = {
            languageCode: selectedLanguageCode,
            level: selectedLevel,
            topic: selectedTopic,
            activityType: activityType,
            mode: mode,
            amount: amount,
            translationTargetLanguageCode: translationTargetLanguageCode,
        };
        
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }
        
        saveTimeoutRef.current = setTimeout(() => {
            firestoreService.saveFlashcardSettings(user.uid, settingsRef.current);
        }, 1500); // Save after 1.5 seconds of inactivity

        return () => { // Cleanup on unmount
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, [selectedLanguageCode, selectedLevel, selectedTopic, activityType, mode, amount, translationTargetLanguageCode, user.uid]);


    // Load content (translation, definition, image) for a card on demand
    const loadCardContent = useCallback(async (card: Flashcard | undefined) => {
        if (!card ||
            (activityType === 'translation' && card.translation) ||
            (activityType === 'definition' && card.definition) ||
            (activityType === 'image' && card.imageUrl) ||
            (activityType === 'sentence' && card.sentence)) { // ADD sentence check
            return;
        }

        setIsLoadingContent(true);
        // Reset definition translation when loading new card content
        setDefinitionTranslation(null);
        try {
            let updatedCard = { ...card };
            const currentTopic = selectedTopic; // Capture selectedTopic at call time

            if (activityType === 'translation' && !card.translation) {
                updatedCard.translation = await geminiService.getTranslation(
                    card.term,
                    targetLangName,
                    translationTargetLangName,
                    selectedLevel
                );
            } else if (activityType === 'definition' && !card.definition) {
                updatedCard.definition = await geminiService.getDefinition(card.term, targetLangName, userNativeLangName);
            } else if (activityType === 'image' && !card.imageUrl) {
                // FIX: Pass the captured selectedTopic (topicTitle)
                updatedCard.imageUrl = await geminiService.generateImageForWord(card.term, targetLangName, selectedLevel, currentTopic);
            } else if (activityType === 'sentence' && !card.sentence) { // ADD sentence fetching
                updatedCard.sentence = await geminiService.getSentence(card.term, targetLangName, userNativeLangName);
            }

            setFlashcards(prev => prev.map(fc => fc.id === updatedCard.id ? updatedCard : fc));
        } catch (error) {
            console.error(`Error loading content for card ${card.id}:`, error);
            // Optionally set an error state on the card itself
        } finally {
            setIsLoadingContent(false);
        }
    }, [activityType, targetLangName, translationTargetLangName, userNativeLangName, selectedLevel, selectedTopic]);

    // Preload content for the *next* card
    useEffect(() => {
        if (sessionState === 'active' && currentIndex + 1 < flashcards.length) {
            loadCardContent(flashcards[currentIndex + 1]);
        }
    }, [currentIndex, flashcards, sessionState, loadCardContent]);


    // Start a new flashcard session
    const startSession = async () => {
        if (!selectedTopic) return;
        setSessionState('loading');
        setFeedback(null);
        setReviewInput('');
        setIsFlipped(false);
        setCurrentIndex(0);
        setScore(0);
        setHasViewedPrompt(false);
        setIsCheckingReview(false);

        // Save current settings immediately
        const currentSettings: FlashcardSettings = {
            languageCode: selectedLanguageCode,
            level: selectedLevel,
            topic: selectedTopic,
            activityType: activityType,
            mode: mode,
            amount: amount,
            translationTargetLanguageCode: translationTargetLanguageCode,
        };
        firestoreService.saveFlashcardSettings(user.uid, currentSettings);

        try {
            const topicData = availableTopics.find(t => t.title === selectedTopic);
            if (!topicData) throw new Error("Topic data not found");
            
            let words: string[] = []; // Start with an empty array
            const extractedWords = extractWordsFromTopic(topicData); // Get extracted words as a fallback
            
            try {
                // Always try to get words from the AI first, as it's more reliable
                console.log(`Asking AI for ${amount} words for "${selectedTopic}" in ${targetLangName}...`);
                const prompt = `
                    Generate a JSON array of exactly ${amount} unique key vocabulary words or short phrases (nouns, verbs, adjectives; max 3 words each)
                    strictly in the ${targetLangName} language, directly related to the content of the lesson topic "${selectedTopic}".
                    Focus on learnable content words from the topic itself.
                    Absolutely DO NOT include meta-words like "grammar", "vocabulary", "lesson", "introduction", "overview", "example", "level", "review", etc.
                    Do not include English words unless the topic is specifically about English loanwords in ${targetLangName}.
                    Do not include proper nouns unless they are essential vocabulary for the topic (e.g., names of concepts).
                    Prioritize words likely to be useful for a learner at level ${selectedLevel}.
                    Respond ONLY with the JSON array of strings, e.g., ["word1", "phrase two", "word3"].
                `;
                 const response = await geminiService.callGeminiProxy(prompt, "gemini-2.5-flash-lite");
                 
                 // --- FIX: Extract JSON from markdown-wrapped response ---
                 let rawText = response.candidates[0].content.parts[0].text;
                 const startIndex = rawText.indexOf('[');
                 const endIndex = rawText.lastIndexOf(']');
                 
                 if (startIndex === -1 || endIndex === -1) {
                     throw new Error("No JSON array found in AI response text: " + rawText);
                 }
                 
                 const jsonString = rawText.substring(startIndex, endIndex + 1);
                 const aiWords = JSON.parse(jsonString); // Parse the *clean* string
                 // --- END FIX ---

                 if (Array.isArray(aiWords) && aiWords.length > 0) {
                    words = [...new Set(aiWords)]; // Use *only* AI words, deduplicated
                 } else {
                    console.warn("AI returned no words, falling back to extraction.");
                    words = extractedWords; // Fallback to extracted words
                 }
            } catch (aiError) {
                 console.error("AI word generation failed, falling back to extraction:", aiError);
                 words = extractedWords; // Fallback to extracted words
            }
             
            if (words.length === 0) {
                throw new Error("No vocabulary words could be found or generated for this topic.");
            }

            // Shuffle and slice to the desired amount
            const selectedWords = words.sort(() => 0.5 - Math.random()).slice(0, amount);

            const fetchedCards: Flashcard[] = selectedWords.map((word, index) => ({
                id: `${selectedTopic}-${index}-${word}`,
                term: word,
            }));

            setFlashcards(fetchedCards);
            setSessionState('active');
            // Preload content for the *first* card
            await loadCardContent(fetchedCards[0]);

        } catch (error) {
            console.error("Error starting flashcard session:", error);
            alert(`Failed to start session for "${selectedTopic}". Please try another topic.`);
            setSessionState('setup');
        }
    };

    const handleFlip = () => {
        if (sessionState !== 'active') return;
        setIsFlipped(!isFlipped);
    };

    const handleReviewSubmit = async () => { // <-- CHANGED: Made async
        if (sessionState !== 'active' || !reviewInput.trim() || isCheckingReview) return;
        
        setIsCheckingReview(true); // <-- ADDED: Show loading
        const currentCard = flashcards[currentIndex];
        
        try {
            const result = await geminiService.checkFlashcardReview(
                reviewInput,
                currentCard.term,
                targetLangName
            );
            setFeedback(result);
            if (result === 'correct') {
                onAddXp(1); // Add 1 XP
                setScore(s => s + 1);
            }
        } catch (error) {
            console.error("Error during review check:", error);
            setFeedback('incorrect'); // Default to incorrect on error
        } finally {
            setIsCheckingReview(false); // <-- ADDED: Hide loading
        }
    };

    const nextCard = () => {
        if (currentIndex < flashcards.length - 1) {
            setCurrentIndex(currentIndex + 1);
            setIsFlipped(false);
            setReviewInput('');
            setFeedback(null);
            setHasViewedPrompt(false);
            setDefinitionTranslation(null);
            setIsLoadingDefTranslation(false);
            setSentenceTranslation(null);
            setIsLoadingSentenceTranslation(false);
            // loadCardContent(flashcards[currentIndex + 1]); // This is now handled by the useEffect
        } else {
            setSessionState('finished');
        }
    };

    const prevCard = () => {
        if (currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
            setIsFlipped(false);
            setReviewInput('');
            setFeedback(null);
            setHasViewedPrompt(false);
            setDefinitionTranslation(null);
            setIsLoadingDefTranslation(false);
            setSentenceTranslation(null);
            setIsLoadingSentenceTranslation(false);
        }
    };

    const restartSession = () => {
        startSession(); // Re-fetch and start over
    };

    const backToSetup = () => {
        setSessionState('setup');
        setFlashcards([]);
        setCurrentIndex(0);
        setSelectedTopic(null); // Reset topic
    };

    const handleSpeakTerm = () => {
        if (flashcards[currentIndex]) {
            onSpeak(flashcards[currentIndex].term, selectedLanguageCode);
        }
    };

    const handleSpeakBackContent = () => {
        if (!currentCard) return;
        let textToSpeak = '';
        let langCodeToSpeak = '';

        if (activityType === 'translation' && currentCard.translation) {
            textToSpeak = currentCard.translation;
            langCodeToSpeak = translationTargetLanguageCode; // Speak in the translation language
        } else if (activityType === 'definition' && currentCard.definition) {
            textToSpeak = currentCard.definition;
            langCodeToSpeak = selectedLanguageCode; // Speak definition in target language
        } else if (activityType === 'sentence' && currentCard.sentence) {
            textToSpeak = currentCard.sentence;
            langCodeToSpeak = selectedLanguageCode; // Speak sentence in target language
        }

        if (textToSpeak) {
            onSpeak(textToSpeak, langCodeToSpeak);
        }
    };

    // ADD: Handler to get translation for definition
    const handleTranslateDefinition = async () => {
        if (!currentCard || !currentCard.definition || isLoadingDefTranslation || definitionTranslation) return;
        setIsLoadingDefTranslation(true);
        try {
            const translation = await geminiService.getTranslation(
                currentCard.definition,
                targetLangName, // From target language
                translationTargetLangName, // To native/selected language
                selectedLevel // Pass level for context
            );
            setDefinitionTranslation(translation);
        } catch (error) {
            console.error("Error translating definition:", error);
            setDefinitionTranslation("Translation failed.");
        } finally {
            setIsLoadingDefTranslation(false);
        }
    };

    const handleTranslateSentence = async () => {
        if (!currentCard || !currentCard.sentence || isLoadingSentenceTranslation || sentenceTranslation) return;
        setIsLoadingSentenceTranslation(true);
        try {
            const translation = await geminiService.getTranslation(
                currentCard.sentence,
                targetLangName, // From target language
                translationTargetLangName, // To native/selected language
                selectedLevel // Pass level for context
            );
            setSentenceTranslation(translation);
        } catch (error) {
            console.error("Error translating sentence:", error);
            setSentenceTranslation("Translation failed.");
        } finally {
            setIsLoadingSentenceTranslation(false);
        }
    };

    const startRecording = useCallback(async () => {
        if (isListening) return;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioStreamRef.current = stream;

            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
            const options: RecordRTC.Options = {
                type: 'audio',
                mimeType: isIOS ? 'audio/mp4' : 'audio/webm',
                numberOfAudioChannels: 1,
                sampleRate: 48000,
                bufferSize: 16384,
                disableLogs: true,
            };
            const browserIsSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
            if (browserIsSafari) {
                options.recorderType = RecordRTC.StereoAudioRecorder;
            }

            // --- FIX: Use the 'default' export for the constructor ---
            // The 'as any' is used here to bypass strict TypeScript checking for the default property
            // if the type definitions (@types/recordrtc) don't explicitly define it this way.
            const newRecorder = new (RecordRTC as any).default(stream, options);
            // --- END FIX ---

            newRecorder.startRecording();
            recorderRef.current = newRecorder;

            setReviewInput('');
            setFeedback(null);
            setIsListening(true);
            setIsTranscribing(false);

        } catch (error) {
            console.error("Error starting flashcard recording:", error);
            alert("Could not start recording. Please check microphone permissions.");
            setIsListening(false);
        }
    }, [isListening]);

    const stopRecordingAndTranscribe = useCallback(async () => {
        if (!recorderRef.current || !isListening) return;

        // Clear any silence timeout if implemented
        if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);

        setIsListening(false); // Update button state immediately
        setIsTranscribing(true); // Show transcribing indicator

        try {
            await new Promise<Blob>((resolve, reject) => {
                 if (!recorderRef.current) return reject("Recorder not available");
                 recorderRef.current.stopRecording(() => {
                    const blob = recorderRef.current!.getBlob();
                    if (audioStreamRef.current) {
                        audioStreamRef.current.getTracks().forEach(track => track.stop());
                        audioStreamRef.current = null;
                    }
                    recorderRef.current?.destroy();
                    recorderRef.current = null;
                    resolve(blob);
                 });
            }).then(async (audioBlob) => {
                if (audioBlob && audioBlob.size > 100) { // Check if blob has some data
                    // Get the language code for the currently selected flashcard language
                    const langCodeToTranscribe = selectedLanguageCode; // Use state variable
                    const transcription = await geminiService.transcribeAudio(audioBlob, langCodeToTranscribe);
                    setReviewInput(transcription || ""); // Update input field
                    // Optional: Automatically submit after transcription?
                    // if (transcription) {
                    //    handleReviewSubmit(); // Need to adapt handleReviewSubmit to use the state directly
                    // }
                } else {
                    console.warn("Recorded audio blob is empty or too small.");
                }
            });
        } catch (error) {
            console.error('Error stopping recording or transcribing:', error);
            setReviewInput(""); // Clear input on error
        } finally {
            setIsTranscribing(false); // Hide transcribing indicator
             // Ensure recorder refs are cleared even on error
             if (audioStreamRef.current) {
                audioStreamRef.current.getTracks().forEach(track => track.stop());
                audioStreamRef.current = null;
            }
            if(recorderRef.current){
                 recorderRef.current?.destroy();
                 recorderRef.current = null;
            }
        }
    }, [isListening, selectedLanguageCode, geminiService.transcribeAudio]);

    const handleMicClick = () => {
        if (isListening) {
            stopRecordingAndTranscribe();
        } else {
            startRecording();
        }
    };

    // --- RENDER LOGIC ---

    const currentCard = flashcards[currentIndex];
    let frontContent: React.ReactNode = null;
    let backContent: React.ReactNode = null;
    let reviewPrompt: React.ReactNode = null;

    if (currentCard) {
        // --- Study Mode Rendering ---
        if (mode === 'study') {
            frontContent = <span className="text-3xl font-bold">{currentCard.term}</span>;

            // Define back content based on activity type
            if (activityType === 'translation') {
                backContent = isLoadingContent && !currentCard.translation ? <LoadingSpinner size="sm" /> : currentCard.translation;
            } else if (activityType === 'definition') {
                backContent = (
                    <div className="flex flex-col items-center">
                        <span className="mb-2">{isLoadingContent && !currentCard.definition ? <LoadingSpinner size="sm" /> : currentCard.definition}</span>
                        {/* REINSTATE: Translation button for definition */}
                        {currentCard.definition && (
                            <button
                                onClick={(e) => { e.stopPropagation(); handleTranslateDefinition(); }}
                                className="text-xs text-blue-200 hover:underline mt-2 disabled:opacity-90"
                                disabled={isLoadingDefTranslation || !!definitionTranslation}
                            >
                                {isLoadingDefTranslation ? 'Translating...' : (definitionTranslation ? definitionTranslation : 'Translate')}
                            </button>
                        )}
                    </div>
                );
            } else if (activityType === 'image') {
                backContent = isLoadingContent && !currentCard.imageUrl ?
                    <LoadingSpinner size="sm" /> :
                    <img src={currentCard.imageUrl} alt={currentCard.term} className="max-w-full max-h-48 mx-auto object-contain" />;
            } else if (activityType === 'sentence') { // ADD sentence display
                backContent = (
                    <div className="flex flex-col items-center">
                        <span className="mb-2">{isLoadingContent && !currentCard.sentence ? <LoadingSpinner size="sm" /> : currentCard.sentence}</span>
                        {currentCard.sentence && (
                            <button
                                onClick={(e) => { e.stopPropagation(); handleTranslateSentence(); }}
                                className="text-xs text-blue-200 hover:underline mt-2 disabled:opacity-90"
                                disabled={isLoadingSentenceTranslation || !!sentenceTranslation}
                            >
                                {isLoadingSentenceTranslation ? 'Translating...' : (sentenceTranslation ? sentenceTranslation : 'Translate')}
                            </button>
                        )}
                    </div>
                );
            }
        }
        // --- Review Mode Rendering ---
        else { // review mode
            if (activityType === 'translation') {
                reviewPrompt = isLoadingContent && !currentCard.translation ? <LoadingSpinner size="sm" /> : currentCard.translation;
            } else if (activityType === 'definition') {
                reviewPrompt = isLoadingContent && !currentCard.definition ? <LoadingSpinner size="sm" /> : currentCard.definition;
            } else if (activityType === 'image') {
                reviewPrompt = isLoadingContent && !currentCard.imageUrl ?
                    <LoadingSpinner size="sm" /> :
                    <img src={currentCard.imageUrl} alt="Guess the word" className="max-w-full max-h-48 mx-auto object-contain" />;
            } else if (activityType === 'sentence') { // ADD sentence prompt
                reviewPrompt = isLoadingContent && !currentCard.sentence ? <LoadingSpinner size="sm" /> : currentCard.sentence;
            }
        }
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4" role="dialog" aria-modal="true">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg h-[80vh] flex flex-col animate-fade-in-down">
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Flashcards: {targetLangName}</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200" aria-label="Close Flashcards">
                        <CloseIcon className="w-6 h-6" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-grow p-6 overflow-y-auto">
                    {/* Setup Screen */}
                    {sessionState === 'setup' && (
                        <div className="space-y-4">
                            {/* ... LanguageSelector and Level select ... */}
                            <LanguageSelector
                                label="Study Language:"
                                value={selectedLanguageCode}
                                onChange={setSelectedLanguageCode}
                                options={availableLanguages}
                            />
                             <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Level</label>
                                <select value={selectedLevel} onChange={e => setSelectedLevel(parseInt(e.target.value))} className="mt-1 block w-full input-style">
                                    {[1, 2, 3, 4, 5].map(lvl => <option key={lvl} value={lvl}>Level {lvl}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Topic</label>
                                <select value={selectedTopic || ""} onChange={e => setSelectedTopic(e.target.value || null)} className="mt-1 block w-full input-style" required>
                                    <option value="" disabled>-- Select a Topic --</option>
                                    {availableTopics.map(topic => <option key={topic.title} value={topic.title}>{topic.title}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Activity Type</label>
                                <select value={activityType} onChange={e => setActivityType(e.target.value as FlashcardActivityType)} className="mt-1 block w-full input-style">
                                    <option value="translation">Word - Translation</option>
                                    <option value="definition">Word - Definition</option>
                                    <option value="image">Word - Image</option>
                                    <option value="sentence">Word - Sentence</option> {/* ADDED */}
                                </select>
                            </div>

                            {/* Conditional Translation Language Selector */}
                            {(activityType === 'translation' || activityType === 'definition' || activityType === 'sentence') && (
                                <LanguageSelector
                                    label={
                                        activityType === 'definition' ? 'Translate Definition To:' :
                                        activityType === 'sentence' ? 'Translate Sentence To:' : // <-- Adjusted label
                                        'Translate Word To:'
                                    }
                                    value={translationTargetLanguageCode}
                                    onChange={setTranslationTargetLanguageCode}
                                    options={availableLanguages}
                                    className="mt-2"
                                />
                            )}

                             <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Mode</label>
                                <select value={mode} onChange={e => setMode(e.target.value as FlashcardMode)} className="mt-1 block w-full input-style">
                                    <option value="study">Study</option>
                                    <option value="review">Review</option>
                                </select>
                            </div>
                             <div>
                                <label htmlFor="amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Number of Cards (5-15)</label>
                                <input
                                    id="amount" type="number" min="5" max="15" value={amount}
                                    onChange={e => setAmount(Math.max(5, Math.min(15, parseInt(e.target.value) || 5)))}
                                    className="mt-1 block w-full input-style"
                                />
                            </div>
                            <button onClick={startSession} disabled={!selectedTopic} className="w-full button-primary disabled:opacity-50">
                                Start Session
                            </button>
                        </div>
                    )}

                    {/* Loading Screen */}
                    {sessionState === 'loading' && (
                        <div className="flex justify-center items-center h-full">
                            <LoadingSpinner />
                            <p className="ml-4">Generating flashcards...</p>
                        </div>
                    )}

                    {/* Active Session Screen */}
                    {sessionState === 'active' && currentCard && (
                        <div className="flex flex-col items-center justify-between h-full">
                            <div className="text-sm text-gray-500 dark:text-gray-400">Card {currentIndex + 1} of {flashcards.length}</div>

                            {/* Flashcard Area */}
                            <div className="w-full h-64 border dark:border-gray-600 rounded-lg flex items-center justify-center p-4 my-4 relative text-center bg-gray-50 dark:bg-gray-700 cursor-pointer"
                                 onClick={mode === 'study' ? handleFlip : undefined}
                                 style={{ perspective: '1000px' }}
                                 >
                                {mode === 'study' ? (
                                    <div className={`w-full h-full transition-transform duration-500 ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`} style={{ transformStyle: 'preserve-3d' }}>
                                        {/* Front */}
                                        <div className="absolute inset-0 flex items-center justify-center p-4 backface-hidden">
                                            {frontContent}
                                            {/* Speak button for Term */}
                                            <button onClick={(e) => { e.stopPropagation(); handleSpeakTerm(); }} className="absolute top-2 right-2 p-1 text-gray-200 hover:text-blue-200">
                                                <VolumeUpIcon className="w-5 h-5" />
                                            </button>
                                        </div>
                                        {/* Back */}
                                        <div className="absolute inset-0 flex items-center justify-center p-4 bg-blue-50 dark:bg-blue-900 [transform:rotateY(180deg)] backface-hidden">
                                            {backContent}
                                            {/* Speak button for Back Content (only if not image) */}
                                            {activityType !== 'image' && backContent && !(isLoadingContent && (
                                                (activityType === 'translation' && !currentCard.translation) ||
                                                (activityType === 'definition' && !currentCard.definition) ||
                                                (activityType === 'sentence' && !currentCard.sentence)
                                            )) && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleSpeakBackContent(); }}
                                                    className="absolute top-2 right-2 p-1 text-gray-500 hover:text-blue-200"
                                                    title="Read aloud"
                                                    aria-label="Read back content aloud"
                                                    >
                                                    <VolumeUpIcon className="w-5 h-5" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    // Review Mode
                                    // ... (Review mode logic remains the same, ensure reviewPrompt uses correct content type)
                                    <div className="w-full flex flex-col items-center justify-center">
                                        <div className="mb-4">{reviewPrompt}</div>
                                        {!hasViewedPrompt && feedback === null && (
                                            <button
                                                onClick={() => setHasViewedPrompt(true)}
                                                className="button-primary"
                                            >
                                                Ready to Guess
                                            </button>
                                        )}
                                        {hasViewedPrompt && feedback === null && (
                                            <form className="w-full max-w-xs" onSubmit={(e) => { e.preventDefault(); handleReviewSubmit(); }}>
                                                <div className="flex items-center space-x-2 mb-2"> {/* Added mb-2 */}
                                                    <input
                                                        type="text"
                                                        value={reviewInput}
                                                        onChange={(e) => setReviewInput(e.target.value)}
                                                        placeholder="Type or speak the word..." // Updated placeholder
                                                        className="w-full input-style text-center" // Removed mb-2 from here
                                                        autoFocus
                                                        // *** Disable input while listening/transcribing ***
                                                        disabled={isCheckingReview || isListening || isTranscribing}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={handleMicClick}
                                                        // *** Disable button during check/transcription ***
                                                        disabled={isCheckingReview || isTranscribing}
                                                        className={`p-2 rounded-full transition-colors ${
                                                          isListening
                                                            ? 'bg-red-500 text-white animate-pulse'
                                                            : 'bg-blue-500 text-white hover:bg-blue-600'
                                                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                                                        aria-label={
                                                          isListening ? 'Stop listening' : 'Start listening'
                                                        }
                                                    >
                                                        {/* *** Show spinner when transcribing *** */}
                                                        {isTranscribing ? <LoadingSpinner size="sm" /> : <MicIcon className="w-5 h-5" />}
                                                    </button>
                                                </div>
                                                <button type="submit" className="w-full button-primary"
                                                    // *** Disable submit while listening/transcribing ***
                                                    disabled={isCheckingReview || isListening || isTranscribing || !reviewInput.trim()}
                                                    >
                                                        {isCheckingReview ? <LoadingSpinner size="sm" /> : 'Check'}
                                                </button>
                                            </form>
                                        )}
                                        {feedback !== null && (
                                            <div className={`p-3 rounded text-center ${feedback === 'correct' ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' : 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'}`}>
                                                {feedback === 'correct' ? <CheckIcon className="w-6 h-6 inline mr-2"/> : <XIcon className="w-6 h-6 inline mr-2"/>}
                                                {feedback === 'correct' ? 'Correct!' : `Correct Answer: ${currentCard.term}`}
                                                {/* Optionally add speak button for correct term in review feedback */}
                                                <button onClick={handleSpeakTerm} className="ml-2 p-1 align-middle">
                                                    <VolumeUpIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Navigation */}
                             <div className="flex justify-between w-full">
                                <button onClick={prevCard} disabled={currentIndex === 0 || (mode === 'review' && feedback === null && hasViewedPrompt)} className="button-secondary disabled:opacity-50">
                                    <ChevronLeftIcon className="w-5 h-5 inline mr-1" /> Prev
                                </button>
                                {mode === 'study' && <button onClick={handleFlip} className="button-secondary">{isFlipped ? 'Show Term' : 'Show Answer'}</button>}
                                <button onClick={nextCard} disabled={mode === 'review' && feedback === null} className="button-secondary disabled:opacity-50">
                                    Next <ChevronRightIcon className="w-5 h-5 inline ml-1" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Finished Screen */}
                    {/* ... (Finished screen remains the same) */}
                    {sessionState === 'finished' && (
                        <div className="text-center space-y-4">
                            <h3 className="text-2xl font-bold">Session Complete!</h3>
                            {mode === 'review' && <p className="text-xl">Your score: {score} / {flashcards.length}</p>}
                            <p>You reviewed words related to: {selectedTopic}</p>
                            <div className="flex justify-center gap-4">
                                <button onClick={restartSession} className="button-secondary flex items-center gap-1">
                                    <RefreshIcon className="w-5 h-5"/> Restart
                                </button>
                                <button onClick={backToSetup} className="button-primary">New Session</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Styles */}
            {/* ... (Styles remain the same) */}
            <style>{`
                .input-style { padding: 8px 12px; border: 1px solid #ccc; border-radius: 6px; background-color: white; color: black; }
                .dark .input-style { border-color: #555; background-color: #333; color: white; }
                .button-primary { padding: 10px 15px; background-color: #3b82f6; color: white; font-weight: bold; border-radius: 6px; transition: background-color 0.2s; }
                .button-primary:hover { background-color: #2563eb; }
                .button-secondary { padding: 8px 12px; background-color: #e5e7eb; color: #374151; font-weight: bold; border-radius: 6px; transition: background-color 0.2s; }
                .button-secondary:hover { background-color: #d1d5db; }
                .dark .button-secondary { background-color: #4b5563; color: #e5e7eb; }
                .dark .button-secondary:hover { background-color: #6b7280; }
                .backface-hidden { backface-visibility: hidden; -webkit-backface-visibility: hidden; }
            `}</style>
        </div>
    );
};

export default FlashcardModal;