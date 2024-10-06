import React, { useState, useEffect } from 'react';
import { SiteConfig } from '@/types/siteConfig';
import { getOrCreateUUID } from '@/utils/client/uuid';

interface NPSSurveyProps {
  siteConfig: SiteConfig;
}

const NPSSurvey: React.FC<NPSSurveyProps> = ({ siteConfig }) => {
  const [showSurvey, setShowSurvey] = useState(false);
  const [showFeedbackIcon, setShowFeedbackIcon] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const surveyFrequency = siteConfig.npsSurveyFrequencyDays;
    const lastCompleted = localStorage.getItem('npsSurveyCompleted');
    const lastDismissed = localStorage.getItem('npsSurveyDismissed');
    const currentTime = Date.now();
    const visitCount = parseInt(localStorage.getItem('visitCount') || '0');

    // note that visitCount is really page load count
    if (surveyFrequency > 0 && visitCount >= 3) {
      const timeSinceCompleted = lastCompleted
        ? currentTime - parseInt(lastCompleted)
        : Infinity;
      const timeSinceDismissed = lastDismissed
        ? currentTime - parseInt(lastDismissed)
        : Infinity;
      const frequencyInMs = surveyFrequency * 24 * 60 * 60 * 1000;

      if (
        timeSinceCompleted >= frequencyInMs &&
        timeSinceDismissed >= frequencyInMs
      ) {
        // Set a timer for 2 minutes in production, 15 seconds in development
        setTimeout(
          () => {
            setShowSurvey(true);
            setShowFeedbackIcon(false);
          },
          process.env.NODE_ENV === 'production' ? 2 * 60 * 1000 : 15 * 1000,
        );
      } else if (lastDismissed && timeSinceDismissed < frequencyInMs) {
        setShowSurvey(false);
        setShowFeedbackIcon(true);
      }
    }
  }, [siteConfig.npsSurveyFrequencyDays]);

  const dismissSurvey = () => {
    setShowSurvey(false);
    setErrorMessage(null);
    setShowFeedbackIcon(true);
    localStorage.setItem('npsSurveyDismissed', Date.now().toString());
  };

  const submitSurvey = async () => {
    if (score !== null) {
      const uuid = getOrCreateUUID();
      const surveyData = {
        uuid,
        score,
        feedback,
        timestamp: new Date().toISOString(),
      };

      try {
        const response = await fetch('/api/submitNpsSurvey', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(surveyData),
        });

        const data = await response.json();

        if (response.ok) {
          localStorage.setItem('npsSurveyCompleted', Date.now().toString());
          localStorage.removeItem('npsSurveyDismissed');
          setShowSurvey(false);
          setErrorMessage(null);
          setShowFeedbackIcon(false);
        } else {
          setErrorMessage(data.message);
        }
      } catch (error) {
        console.error(error);
        setErrorMessage(
          'Error submitting survey: An unexpected error occurred',
        );
      }
    }
  };

  const openSurvey = () => {
    setShowSurvey(true);
    setShowFeedbackIcon(false);
  };

  return (
    <>
      {showSurvey && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">
              How likely are you to recommend our service to a friend or
              colleague?
            </h2>
            <div className="flex justify-between mb-4">
              {[...Array(11)].map((_, i) => (
                <button
                  key={i}
                  className={`px-3 py-1 rounded ${score === i ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
                  onClick={() => setScore(i)}
                >
                  {i}
                </button>
              ))}
            </div>
            <h3 className="text-lg font-semibold mb-2">
              What&apos;s the main reason for the answer you just gave?
            </h3>
            <textarea
              className="w-full p-2 border rounded mb-4"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
            />
            {errorMessage && (
              <div className="text-red-500 mb-4">{errorMessage}</div>
            )}
            <div className="flex justify-end">
              <button
                className="mr-2 px-4 py-2 bg-gray-200 rounded"
                onClick={dismissSurvey}
              >
                Dismiss
              </button>
              <button
                className={`px-4 py-2 rounded ${score !== null ? 'bg-blue-500 text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
                onClick={submitSurvey}
                disabled={score === null}
              >
                Submit
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-4">
              This survey information is collected solely to improve our
              service.
            </p>
          </div>
        </div>
      )}
      {showFeedbackIcon && (
        <button
          onClick={openSurvey}
          className="fixed bottom-4 right-4 bg-blue-500 text-white rounded-full p-3 shadow-lg hover:bg-blue-600 transition-colors duration-200 z-50 group"
          aria-label="Open Feedback Survey"
        >
          <span className="material-icons">ballot</span>
          <span className="absolute bottom-full right-0 mb-2 bg-gray-800 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            Take 1-minute survey
          </span>
        </button>
      )}
    </>
  );
};

export default NPSSurvey;
