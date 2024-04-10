import React, { useState, useEffect } from 'react';

interface RandomQueriesProps {
  queries: string[];
  onQueryClick: (query: string) => void;
}

const RandomQueries: React.FC<RandomQueriesProps> = ({ queries, onQueryClick }) => {
  const [displayCount, setDisplayCount] = useState(3);
  const [displayedQueries, setDisplayedQueries] = useState<string[]>([]);

  useEffect(() => {
    setDisplayCount(window.innerWidth >= 768 ? 3 : 1);
    shuffleAndSetQueries();

    const handleResize = () => {
      setDisplayCount(window.innerWidth >= 768 ? 3 : 1);
    };

    window.addEventListener('resize', handleResize);

    // Cleanup function to remove the event listener
    return () => window.removeEventListener('resize', handleResize);
  }, [queries]); 

  useEffect(() => {
    shuffleAndSetQueries();
  }, [displayCount]);

  const shuffleAndSetQueries = () => {
    const shuffled = [...queries].sort(() => 0.5 - Math.random());
    setDisplayedQueries(shuffled.slice(0, displayCount));
  };

  return (
    <div className="text-left w-full px-0">
      <div className="bg-gray-100 p-4 rounded-lg w-full">
        <div className="flex justify-between items-center">
          <p className={`font-semibold mb-3`}>{displayCount > 1 ? 'Suggested Queries:' : 'Suggested Query:'}</p>
          <button
            onClick={(e) => {
              e.preventDefault(); 
              shuffleAndSetQueries();
            }}
            className="inline-flex justify-center items-center transform transition-transform duration-500 hover:rotate-180"
            aria-label="Refresh queries"
            style={{ display: 'inline-flex', justifyContent: 'center', alignItems: 'center', transformOrigin: 'center center' }} // More specific inline styles
          >
            <span className="material-icons text-blue-600 hover:text-blue-800" style={{ display: 'inline-block', transformOrigin: 'center' }}>autorenew</span>
          </button>
        </div>
        <ul className="list-none">
          {displayedQueries.map((query, index) => (
            <li key={index} className="mb-2">
              <button
                className="text-blue-600 hover:text-blue-800 hover:underline focus:outline-none focus:underline w-full text-left"
                onClick={() => onQueryClick(query)}
                aria-label={`Sample query: ${query}`}
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
