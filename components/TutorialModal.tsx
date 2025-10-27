import React from 'react';
import { CloseIcon, ChatIcon, BookOpenIcon, FlashcardsIcon, ClipboardListIcon, UsersIcon, InfoIcon, CrownIcon } from './Icons';

interface TutorialModalProps {
  onClose: () => void;
}

// Helper component for consistent section styling
const Section: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <div className="mb-6">
    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 flex items-center">
      {icon}
      <span className="ml-2">{title}</span>
    </h3>
    <div className="space-y-2 text-gray-700 dark:text-gray-300">
      {children}
    </div>
  </div>
);

const TutorialModal: React.FC<TutorialModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4" role="dialog" aria-modal="true">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl h-[80vh] flex flex-col animate-fade-in-down">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Welcome to Langcampus Exchange!</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200" aria-label="Close Tutorial">
            <CloseIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Body (Scrollable) */}
        <div className="flex-grow p-6 overflow-y-auto">
          <Section title="1. The AI Chat Partner" icon={<ChatIcon className="w-6 h-6" />}>
            <p>The main screen is your chat with an AI partner. You can practice conversation, ask for translations, or request corrections by starting your message with "Correct this:".</p>
          </Section>

          <Section title="2. Teach Me Mode" icon={<BookOpenIcon className="w-6 h-6" />}>
            <p>Click the <BookOpenIcon className="w-5 h-5 inline-block" /> icon in any chat to open the "Teach Me" module. Here you can select your language, level, and a topic (Vocabulary, Grammar, or Conversation) to learn about.</p>
          </Section>

          <Section title="3. Flashcards" icon={<FlashcardsIcon className="w-6 h-6" />}>
            <p>From the dashboard, click the <FlashcardsIcon className="w-5 h-5 inline-block" /> icon. This opens the Flashcard modal, letting you study the vocabulary from your chosen lesson in "Study" or "Review" mode. Pro only feature.</p>
          </Section>

          <Section title="4. Notes" icon={<ClipboardListIcon className="w-6 h-6" />}>
            <p>Click the <ClipboardListIcon className="w-5 h-5 inline-block" /> icon in the TeachMe module to open your personal notebook. You can add new notes, edit them, or click the speaker icon to hear them spoken in the correct language.</p>
          </Section>

          <Section title="5. Group Chat" icon={<UsersIcon className="w-6 h-6" />}>
            <p>Want to practice with others? Click the <UsersIcon className="w-5 h-5 inline-block" /> icon in the chat menu to join or create a group chat. Group chats have their own shared "Teach Me" lessons.</p>
          </Section>

          <Section title="6. My Info Panel" icon={<InfoIcon className="w-6 h-6" />}>
            <p>Click the <InfoIcon className="w-5 h-5 inline-block" /> icon (in the header) to open your info panel. This is where you can see your stats (XP, level), change your user settings (like gender), and manage your subscription.</p>
          </Section>

          <Section title="7. Pro Features" icon={<CrownIcon className="w-6 h-6" />}>
            <p>A "Pro" subscription gives you unlimited AI messages, AI-generated images for flashcards (with fallback to Google Search), and full access to all features.</p>
          </Section>
        </div>
      </div>
    </div>
  );
};

export default TutorialModal;