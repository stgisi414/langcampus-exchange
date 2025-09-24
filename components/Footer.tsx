import React from 'react';
import { Link } from 'react-router-dom';

const Footer: React.FC = () => {
  return (
    <footer className="bg-white dark:bg-gray-800 shadow-inner mt-12 py-6">
      <div className="container mx-auto px-4 text-center text-gray-600 dark:text-gray-400">
        <div className="flex justify-center items-center space-x-4 mb-4">
          <Link to="/terms-of-service" className="hover:text-blue-500 transition-colors">
            Terms of Service
          </Link>
          <span>|</span>
          <Link to="/privacy-policy" className="hover:text-blue-500 transition-colors">
            Privacy Policy
          </Link>
        </div>
        <p className="text-sm">
          &copy; {new Date().getFullYear()} Langcampus Exchange. All Rights Reserved.
        </p>
        <p className="text-sm mt-2">
          Powered by Gemini
        </p>
      </div>
    </footer>
  );
};

export default Footer;