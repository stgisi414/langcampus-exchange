import React from 'react';
import { Link } from 'react-router-dom';
import { WarningIcon } from './Icons';

const GroupNotFound: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 text-center p-4">
      <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg max-w-sm w-full">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 mb-4">
          <WarningIcon className="h-8 w-8 text-yellow-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Group Chat Unavailable</h1>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          This group chat either doesn't exist or is already full. Please check the link or ask for a new one.
        </p>
        <Link 
          to="/" 
          className="w-full inline-block px-6 py-3 bg-blue-500 text-white font-bold rounded-lg hover:bg-blue-600 transition-colors text-lg"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
};

export default GroupNotFound;