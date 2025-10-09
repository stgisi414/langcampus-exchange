import React, { useState, useEffect } from 'react';
import { signInWithPopup, AuthError } from 'firebase/auth';
import { auth, googleProvider } from '../firebaseConfig.ts';
import LoadingSpinner from './LoadingSpinner.tsx';
import ErrorModal from './ErrorModal.tsx';
import { InfoIcon } from './Icons.tsx';
import { FEATURES, FeatureCard } from '../App.tsx';

// --- UPDATED SCRIPT FOR IOS & ANDROID ---
// This script now handles redirects for both operating systems.
(function() {
  const userAgent = window.navigator.userAgent.toLowerCase();
  const currentUrl = window.location.href;
  
  // Check for iOS devices
  const isIos = userAgent.includes('iphone') || userAgent.includes('ipad');
  if (isIos) {
    const isNaverIOS = userAgent.includes('naver(inapp;');
    const isGenericIOSWebView = !userAgent.includes('safari') && !userAgent.includes('crios');
    if (isNaverIOS || isGenericIOSWebView) {
      window.location.href = 'x-safari-' + currentUrl;
      return;
    }
  }

  // Check for Android devices
  const isAndroid = userAgent.includes('android');
  if (isAndroid) {
    // The Naver app on Android also includes 'naver' in its user agent.
    // 'wv' is a common indicator of a WebView.
    const isNaverAndroid = userAgent.includes('naver');
    const isGenericAndroidWebView = userAgent.includes('wv');

    if (isNaverAndroid || isGenericAndroidWebView) {
      // This is an Android Intent URL to force open in Chrome.
      const intentUrl = currentUrl.replace(/https?:\/\//, 'intent://');
      window.location.href = `${intentUrl}#Intent;scheme=https;package=com.android.chrome;end`;
    }
  }
})();


const GoogleIcon = () => (
    <svg className="w-6 h-6 mr-3" viewBox="0 0 48 48">
        {/* SVG paths remain the same */}
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

  const isDisallowedUserAgent = () => {
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIos = userAgent.includes('iphone') || userAgent.includes('ipad');
    const isAndroid = userAgent.includes('android');

    if (isIos) {
        const isNaverIOS = userAgent.includes('naver(inapp;');
        const isGenericIOSWebView = !userAgent.includes('safari') && !userAgent.includes('crios');
        return isNaverIOS || isGenericIOSWebView;
    }

    if (isAndroid) {
        const isNaverAndroid = userAgent.includes('naver');
        const isGenericAndroidWebView = userAgent.includes('wv');
        return isNaverAndroid || isGenericAndroidWebView;
    }
    
    return false;
  };

  const handleGoogleSignIn = async () => {
    if (isDisallowedUserAgent()) {
      setShowBrowserErrorModal(true);
      return;
    }

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
        setError("An unknown error occurred. Please try again.");
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

          <div className="w-full max-w-4xl mt-16">
              <h2 className="text-3xl font-bold text-center mb-8 text-gray-200 dark:text-gray-200">
                  Unlock Your Fluency with Our Powerful Features
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {FEATURES.map((feature, index) => (
                      <FeatureCard 
                          key={index} 
                          title={feature.title} 
                          description={feature.description} 
                          icon={feature.icon} 
                      />
                  ))}
              </div>
          </div>
      </div>

      {showBrowserErrorModal && (
        <ErrorModal
          title="Unsupported Browser"
          message={
            <p>
              It looks like you're using an in-app browser that isn't supported for Google Sign-In. 
              Please open this page in your phone's main browser (Chrome or Safari) to continue.
            </p>
          }
          onClose={() => setShowBrowserErrorModal(false)}
        />
      )}
    </>
  );
};

export default LoginScreen;