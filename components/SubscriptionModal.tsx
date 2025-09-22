import React from 'react';
import { CloseIcon } from './Icons.tsx';

interface SubscriptionModalProps {
  onClose: () => void;
  onSubscribe: () => void;
  reason: 'limit' | 'manual';
  isUpgrading: boolean;
}

const SubscriptionModal: React.FC<SubscriptionModalProps> = ({ onClose, onSubscribe, reason, isUpgrading   }) => {
  // Define messages based on the reason
  const title = reason === 'limit' ? "Daily Limit Reached" : "Upgrade to Langcampus Pro";
  const message = reason === 'limit' 
    ? "You've used all your free actions for today. Upgrade to Langcampus Pro for unlimited access!"
    : "Unlock unlimited partner searches, messages, audio plays, and lessons by upgrading your account.";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4" role="dialog" aria-modal="true">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md animate-fade-in-down text-center p-8 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200" aria-label="Close">
          <CloseIcon className="w-6 h-6" />
        </button>
        <h2 className="text-3xl font-bold text-blue-500 mb-4">{title}</h2>
        <p className="text-gray-700 dark:text-gray-300 mb-6">{message}</p>
        
        <div className="text-left mb-8 space-y-2">
            <p className="text-lg text-gray-800 dark:text-gray-200 flex items-center"><span className="text-green-500 mr-2">✔</span> Unlimited Partner Searches</p>
            <p className="text-lg text-gray-800 dark:text-gray-200 flex items-center"><span className="text-green-500 mr-2">✔</span> Unlimited Messages</p>
            <p className="text-lg text-gray-800 dark:text-gray-200 flex items-center"><span className="text-green-500 mr-2">✔</span> Unlimited Audio Plays</p>
            <p className="text-lg text-gray-800 dark:text-gray-200 flex items-center"><span className="text-green-500 mr-2">✔</span> Unlimited Lessons & Quizzes</p>
        </div>
        
        <button onClick={onSubscribe} className="w-full px-6 py-3 bg-green-500 text-white font-bold rounded-lg hover:bg-green-600 transition-colors text-lg" disabled={isUpgrading}>
             {isUpgrading ? "Redirecting..." : "Upgrade to Pro"}
        </button>
      </div>
    </div>
  );
};

export default SubscriptionModal;