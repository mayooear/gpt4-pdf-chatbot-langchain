import { useMemo, useCallback, useState, useEffect } from 'react';

export const useRandomQueries = (queries: string[], count: number = 3) => {
  const getRandomQueries = useCallback(() => {
    const shuffled = queries.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }, [queries, count]);

  const [randomQueries, setRandomQueries] = useState<string[]>([]);

  useEffect(() => {
    setRandomQueries(getRandomQueries());
  }, [getRandomQueries]);

  return randomQueries;
};
