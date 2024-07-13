import React, { useState, useEffect } from 'react';
import { logEvent } from '@/utils/client/analytics';

interface RandomQueriesProps {
  queries: string[];
  onQueryClick: (query: string) => void;
  isLoading: boolean;
  shuffleQueries: () => void;
  isMobile: boolean;
}

const RandomQueries: React.FC<RandomQueriesProps> = ({ queries, onQueryClick, isLoading, shuffleQueries, isMobile }) => {
  const [currentQueryIndex, setCurrentQueryIndex] = useState(0);

  const handleQueryClick = (query: string) => {
    if (!isLoading) {
      onQueryClick(query);
      logEvent('select_suggested_query', 'Engagement', query);
    }
  };

  const handleShuffleQueries = (e: React.MouseEvent) => {
    e.preventDefault();
    shuffleQueries();
    logEvent('randomize_suggested_queries', 'UI', '');
  };

  return (
    <div className="text-left w-full px-0">
      <div className="bg-gray-100 p-4 rounded-lg w-full max-w-[400px]">
        <div className="flex justify-between items-center mb-3">
          <p className="font-semibold">Suggested Query:</p>
          <button
            onClick={handleShuffleQueries}
            className="inline-flex justify-center items-center transform transition-transform duration-500 hover:rotate-180 flex-shrink-0 ml-2"
            aria-label="Refresh queries"
            disabled={isLoading}
          >
            <span className="material-icons text-blue-600 hover:text-blue-800">autorenew</span>
          </button>
        </div>
        {isMobile ? (
          <div className="flex items-center">
            <button
              className={`flex-grow text-left break-words ${isLoading ? 'text-gray-400 cursor-not-allowed' : 'text-blue-600 hover:text-blue-800 hover:underline'}`}
              onClick={() => handleQueryClick(queries[currentQueryIndex])}
              disabled={isLoading}
            >
              {queries[currentQueryIndex]}
            </button>
          </div>
        ) : (
          <ul className="list-none w-full">
            {queries.slice(0, 3).map((query, index) => (
              <li key={index} className={`mb-2 ${isLoading ? 'text-gray-400' : 'text-blue-600 hover:text-blue-800 hover:underline'}`}>
                <button
                  className={`focus:outline-none focus:underline w-full text-left break-words ${isLoading ? 'cursor-not-allowed' : ''}`}
                  onClick={() => handleQueryClick(query)}
                  aria-label={`Sample query: ${query}`}
                  disabled={isLoading}
                >
                  {query}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default RandomQueries;