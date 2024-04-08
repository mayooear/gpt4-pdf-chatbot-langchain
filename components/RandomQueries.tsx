import React, { useState, useEffect } from 'react';

interface RandomQueriesProps {
  queries: string[];
  onQueryClick: (query: string) => void;
}

const RandomQueries: React.FC<RandomQueriesProps> = ({ queries, onQueryClick }) => {
  const [displayCount, setDisplayCount] = useState(3);

  useEffect(() => {
    setDisplayCount(window.innerWidth >= 768 ? 3 : 1);

    const handleResize = () => {
      setDisplayCount(window.innerWidth >= 768 ? 3 : 1);
    };

    window.addEventListener('resize', handleResize);

    // Cleanup function to remove the event listener
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="text-left w-full px-0">
      <div className="bg-gray-100 p-4 rounded-lg w-full">
        <p className={`font-semibold mb-3`}>{displayCount > 1 ? 'Suggested Queries:' : 'Suggested Query:'}</p>
        <ul className="list-none">
          {queries.slice(0, displayCount).map((query, index) => (
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
