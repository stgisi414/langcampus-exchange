import React, { useState } from 'react';
import { signInWithPopup, AuthError } from 'firebase/auth';
import { auth, googleProvider } from '../firebaseConfig.ts';
import LoadingSpinner from './LoadingSpinner.tsx';
import ErrorModal from './ErrorModal.tsx';
import { InfoIcon } from './Icons.tsx'; // Import the InfoIcon

const GoogleIcon = () => (
    <svg className="w-6 h-6 mr-3" viewBox="0 0 48 48">
        <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
        <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z" />
        <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
        <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l6.19 5.238C42.012 35.245 44 30.022 44 24c0-1.341-.138-2.65-.389-3.917z" />
    </svg>
);

const LoginScreen: React.FC = () => {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBrowserErrorModal, setShowBrowserErrorModal] = useState(false);

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    setError(null);
    setShowBrowserErrorModal(false);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const error = err as AuthError;
      console.error("Error during sign-in:", error.code, error.message);

      if (error.code) { 
        setShowBrowserErrorModal(true);
      } else {
        setError("An unknown error occurred during sign-in. Please try again.");
      }
      
      setIsSigningIn(false);
    }
  };

  return (
    <>
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 text-center p-4">
          <img src="/logo.png" alt="Langcampus Exchange Logo" className="h-32 w-32 mb-4" />
          <h1 className="text-4xl font-bold text-blue-600 dark:text-blue-400">Langcampus Exchange</h1>
          <p className="mt-2 text-lg text-gray-600 dark:text-gray-300">Your AI-powered portal to language fluency.</p>
          
          <div className="mt-12 w-full max-w-sm">
              <div className="bg-yellow-100 dark:bg-yellow-900 border-l-4 border-yellow-500 text-yellow-800 dark:text-yellow-200 p-4 rounded-md mb-6 text-left flex items-start">
                  <InfoIcon className="w-6 h-6 mr-3 flex-shrink-0" />
                  <div>
                    <p className="font-bold">Browser Recommendation</p>
                    <p className="text-sm">For the best experience, please use a standard browser like Chrome, Safari, or Edge. In-app browsers may be blocked by Google for security reasons.</p>
                  </div>
              </div>

              <button
                onClick={handleGoogleSignIn}
                disabled={isSigningIn}
                className="w-full flex items-center justify-center px-6 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-wait"
              >
                {isSigningIn ? (
                  <>
                    <LoadingSpinner size="sm" />
                    <span className="ml-3">Signing In...</span>
                  </>
                ) : (
                  <>
                    <GoogleIcon />
                    <span className="font-semibold text-gray-800 dark:text-gray-200">Sign in with Google</span>
                  </>
                )}
              </button>
              {error && <p className="mt-4 text-red-500">{error}</p>}
          </div>
      </div>

      {showBrowserErrorModal && (
        <ErrorModal
          title="Unsupported Browser"
          message={
            <p>
              It looks like you're using a browser that isn't supported for Google Sign-In. 
              Please copy the website link and open it in a standard browser like Chrome or Safari to continue.
            </p>
          }
          onClose={() => setShowBrowserErrorModal(false)}
        />
      )}
    </>
  );
};

export default LoginScreen;