import React from 'react';
import { Link } from 'react-router-dom';

const PrivacyPolicy: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans p-8">
      <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Last updated: September 23, 2025</p>

        <p className="my-4">
          Welcome to Langcampus Exchange. We respect your privacy and are committed to protecting your personal data. This privacy policy will inform you as to how we look after your personal data when you use our application and tell you about your privacy rights and how the law protects you.
        </p>
        
        <h2 className="text-2xl font-semibold mt-6 mb-4">1. Information We Collect</h2>
        <p className="mb-4">
          We collect and process the following data about you:
        </p>
        <ul className="list-disc list-inside mb-4 space-y-2">
          <li>
            <strong>Identity and Contact Data:</strong> When you sign in using Google, we receive your email address, display name, and photo URL as provided by Google's authentication service. We store this along with a unique user ID provided by Firebase Authentication.
          </li>
          <li>
            <strong>Profile Data:</strong> We collect information you voluntarily provide for your user profile, which may include your name, hobbies, and a short bio. This information is used to personalize your experience and help our AI generate relevant language exchange partners.
          </li>
          <li>
            <strong>Usage Data:</strong> We automatically track your usage of certain features within the app. This includes counts of daily partner searches, messages sent, audio plays, lessons viewed, and quizzes taken. This data is used to manage the limits of our free tier.
          </li>
          <li>
            <strong>Chat Data:</strong> If you choose to save a conversation with an AI partner, we store the chat history, including the messages and partner details, in your user profile.
          </li>
          <li>
            <strong>Transaction Data:</strong> We do NOT collect or store your payment card details. All payment processing is handled by our third-party payment processor, Stripe. We receive a customer ID from Stripe which is linked to your account to manage your subscription status.
          </li>
        </ul>

        <h2 className="text-2xl font-semibold mt-6 mb-4">2. How We Use Your Information</h2>
        <p className="mb-4">
          We use the information we collect to:
        </p>
        <ul className="list-disc list-inside mb-4 space-y-2">
            <li>Authenticate and manage your user account.</li>
            <li>Provide, operate, and maintain our application's services.</li>
            <li>Personalize your experience by generating AI partners based on your interests.</li>
            <li>Enforce usage limits on our free tier and grant unlimited access to subscribers.</li>
            <li>Process transactions and manage your subscription through our payment processor, Stripe.</li>
            <li>Communicate with you, either directly or through one of our partners, including for customer service.</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-6 mb-4">3. Third-Party Services</h2>
        <p className="mb-4">
          Our application relies on the following third-party services, which have their own privacy policies:
        </p>
        <ul className="list-disc list-inside mb-4 space-y-2">
          <li><strong>Firebase (by Google):</strong> Used for authentication, database (Firestore), and cloud functions.</li>
          <li><strong>Google Gemini:</strong> Powers our AI chat partners, content generation, and text-to-speech features. Chat history and profile data are sent to the Gemini API to generate responses.</li>
          <li><strong>Stripe:</strong> Our payment processing partner for Langcampus Pro subscriptions. They handle all payment information securely.</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-6 mb-4">4. Data Security</h2>
        <p className="mb-4">
          We use Firebase's robust security features to protect your data. While no electronic storage method is 100% secure, we strive to use commercially acceptable means to protect your Personal Data.
        </p>
        
        <h2 className="text-2xl font-semibold mt-6 mb-4">5. Contact Us</h2>
        <p className="mb-4">
          If you have any questions about this Privacy Policy, please contact us at: stefdgisi@gmail.com.
        </p>

        <div className="mt-8">
          <Link to="/" className="text-blue-500 hover:underline">
            &larr; Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;