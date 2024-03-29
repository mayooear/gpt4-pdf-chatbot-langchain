import React from 'react';

interface RandomQueriesProps {
  queries: string[];
  onQueryClick: (query: string) => void;
}

const RandomQueries: React.FC<RandomQueriesProps> = ({ queries, onQueryClick }) => {
  return (
    <div className="flex flex-col items-start">
      {queries.map((query, index) => (
        <button
          key={index}
          className="text-blue-500 hover:underline mb-2"
          onClick={() => onQueryClick(query)}
        >
          {query}
        </button>
      ))}
    </div>
  );
};

export default RandomQueries;
