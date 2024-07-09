import React, { useState, useEffect } from 'react';
import { logEvent } from '@/utils/client/analytics';

interface RandomQueriesProps {
  queries: string[];
  onQueryClick: (query: string) => void;
  isLoading: boolean;
  shuffleQueries: () => void;
}

const RandomQueries: React.FC<RandomQueriesProps> = ({ queries, onQueryClick, isLoading, shuffleQueries }) => {
  const [displayCount, setDisplayCount] = useState(3);

  useEffect(() => {
    setDisplayCount(window.innerWidth >= 768 ? 3 : 1);

    const handleResize = () => {
      setDisplayCount(window.innerWidth >= 768 ? 3 : 1);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []); 

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
      <div className="bg-gray-100 p-4 rounded-lg w-[90%] sm:w-[35vw] min-w-[280px] max-w-[400px]">
        <div className="flex justify-between items-center mb-3">
          <p className="font-semibold">{displayCount > 1 ? 'Suggested Queries:' : 'Suggested Query:'}</p>
          <button
            onClick={handleShuffleQueries}
            className="inline-flex justify-center items-center transform transition-transform duration-500 hover:rotate-180 flex-shrink-0 ml-2"
            aria-label="Refresh queries"
            disabled={isLoading} 
          >
            <span className="material-icons text-blue-600 hover:text-blue-800">autorenew</span>
          </button>
        </div>
        <ul className="list-none w-full">
          {queries.slice(0, displayCount).map((query, index) => (
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
      </div>
    </div>
  );
};

export default RandomQueries;