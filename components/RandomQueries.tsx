import React from 'react';

interface RandomQueriesProps {
  queries: string[];
  onQueryClick: (query: string) => void;
}

const RandomQueries: React.FC<RandomQueriesProps> = ({ queries, onQueryClick }) => {
  return (
    <div className="text-left w-full px-0">
      <div className="bg-gray-100 p-4 rounded-lg w-full">
        <p className="font-semibold mb-3">Try a Suggested Query:</p>
        <ul className="list-none">
          {queries.map((query, index) => (
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
