import React, { useState } from 'react';
import LoadingSpinner from './LoadingSpinner';

interface AgeVerificationModalProps {
  onVerified: (dob: string) => void;
  onUnderage: () => void;
}

const AgeVerificationModal: React.FC<AgeVerificationModalProps> = ({ onVerified, onUnderage }) => {
  const [birthDate, setBirthDate] = useState({ month: '', day: '', year: '' });
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (/^\d*$/.test(value)) {
      setBirthDate(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsVerifying(true);

    const { year, month, day } = birthDate;
    if (!year || !month || !day) {
      setError("Please fill out all fields.");
      setIsVerifying(false);
      return;
    }

    const yearNum = parseInt(year, 10);
    const monthNum = parseInt(month, 10);
    const dayNum = parseInt(day, 10);

    if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31 || yearNum < 1900 || year.length !== 4) {
        setError("Please enter a valid date (e.g., MM/DD/YYYY).");
        setIsVerifying(false);
        return;
    }

    setTimeout(() => {
        const today = new Date();
        const dob = new Date(yearNum, monthNum - 1, dayNum);
        
        let age = today.getFullYear() - dob.getFullYear();
        const m = today.getMonth() - dob.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
            age--;
        }

        if (age >= 18) {
            const formattedDob = `${year.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            onVerified(formattedDob);
        } else {
            onUnderage();
        }
        setIsVerifying(false);
    }, 500);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex justify-center items-center z-[100] p-4" role="dialog" aria-modal="true">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-sm text-center p-8 animate-fade-in-down">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Age Verification</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Please enter your date of birth to continue. You must be 18 or older to use this service.
        </p>
        
        <form onSubmit={handleSubmit}>
          <div className="flex justify-center gap-2 mb-4">
            <input
              type="text"
              name="month"
              value={birthDate.month}
              onChange={handleChange}
              placeholder="MM"
              maxLength={2}
              className="w-16 p-2 text-center text-lg border dark:border-gray-600 rounded-md bg-gray-100 dark:bg-gray-700"
              aria-label="Month of birth"
            />
            <input
              type="text"
              name="day"
              value={birthDate.day}
              onChange={handleChange}
              placeholder="DD"
              maxLength={2}
              className="w-16 p-2 text-center text-lg border dark:border-gray-600 rounded-md bg-gray-100 dark:bg-gray-700"
              aria-label="Day of birth"
            />
            <input
              type="text"
              name="year"
              value={birthDate.year}
              onChange={handleChange}
              placeholder="YYYY"
              maxLength={4}
              className="w-24 p-2 text-center text-lg border dark:border-gray-600 rounded-md bg-gray-100 dark:bg-gray-700"
              aria-label="Year of birth"
            />
          </div>
          
          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
          
          <button 
            type="submit" 
            className="w-full px-6 py-3 bg-blue-500 text-white font-bold rounded-lg hover:bg-blue-600 transition-colors text-lg disabled:opacity-50"
            disabled={isVerifying}
          >
            {isVerifying ? <LoadingSpinner size="sm" /> : "Verify Age"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AgeVerificationModal;