import React, { useState, useEffect, useCallback } from 'react';

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

    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, []); 

  return (
    <div className="text-left w-full px-0">
      <div className="bg-gray-100 p-4 rounded-lg w-full">
        <div className="flex justify-between items-center">
          <p className={`font-semibold mb-3`}>{displayCount > 1 ? 'Suggested Queries:' : 'Suggested Query:'}</p>
          <button
            onClick={(e) => {
              e.preventDefault(); 
              shuffleQueries();
            }}
            className="inline-flex justify-center items-center transform transition-transform duration-500 hover:rotate-180"
            aria-label="Refresh queries"
            style={{ display: 'inline-flex', justifyContent: 'center', alignItems: 'center', transformOrigin: 'center center' }}
            disabled={isLoading} 
          >
            <span className="material-icons text-blue-600 hover:text-blue-800" style={{ display: 'inline-block', transformOrigin: 'center' }}>autorenew</span>
          </button>
        </div>
        <ul className="list-none">
          {queries.map((query, index) => (
            <li key={index} className={`mb-2 ${isLoading ? 'text-gray-400' : 'text-blue-600 hover:text-blue-800 hover:underline'}`}>
              <button
                className={`focus:outline-none focus:underline w-full text-left ${isLoading ? 'cursor-not-allowed' : ''}`}
                onClick={() => !isLoading && onQueryClick(query)}
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
