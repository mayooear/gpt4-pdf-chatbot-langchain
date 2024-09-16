import { useState, useEffect, useCallback } from 'react';

export const useRandomQueries = (queries: string[], count: number) => {
  const [randomQueries, setRandomQueries] = useState<string[]>([]);

  const shuffleQueries = useCallback(() => {
    if (!queries || queries.length === 0) {
      return [];
    }
    const shuffled = [...queries].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }, [queries, count]);

  useEffect(() => {
    setRandomQueries(shuffleQueries());
  }, [shuffleQueries]);

  return {
    randomQueries,
    shuffleQueries: () => setRandomQueries(shuffleQueries()),
  };
};
