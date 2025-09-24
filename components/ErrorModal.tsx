import React from 'react';
import { CloseIcon, WarningIcon } from './Icons.tsx';

interface ErrorModalProps {
  title: string;
  message: React.ReactNode; // Allow for more complex messages with links
  onClose: () => void;
}

const ErrorModal: React.FC<ErrorModalProps> = ({ title, message, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4" role="dialog" aria-modal="true">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md animate-fade-in-down text-center p-8 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200" aria-label="Close">
          <CloseIcon className="w-6 h-6" />
        </button>
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
            <WarningIcon className="h-8 w-8 text-red-600" />
        </div>
        <h2 className="text-2xl font-bold text-red-600 mb-4">{title}</h2>
        <div className="text-gray-700 dark:text-gray-300 mb-6">
            {message}
        </div>
        <button onClick={onClose} className="w-full px-6 py-2 bg-blue-500 text-white font-bold rounded-lg hover:bg-blue-600 transition-colors text-lg">
             OK
        </button>
      </div>
    </div>
  );
};

export default ErrorModal;