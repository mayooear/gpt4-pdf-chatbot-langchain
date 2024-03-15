import Layout from '@/components/layout';
import { useEffect, useState } from 'react';
import { useInView } from 'react-intersection-observer';
import ReactMarkdown from 'react-markdown';
import gfm from 'remark-gfm';
import { formatDistanceToNow } from 'date-fns';
import { Share } from 'next/font/google';

interface Share {
  id: string;
  firstName: string;
  lastName: string;
  comments?: string;
  answerId: string;
  createdAt: number; // Unix timestamp format
}

interface Answer {
  id: string;
  question: string;
  answer: string;
  sources: string;
  ip: string;
  history: any[]; // more specific here would be better
  timestamp: Timestamp; 
}

interface Timestamp {
  _seconds: number;
  _nanoseconds: number;
}

const SharedAnswers = () => {
  const [shares, setShares] = useState<Share[]>([]);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [page, setPage] = useState(0);
  const { ref, inView } = useInView();
  const [isLoading, setIsLoading] = useState(false);

  // State to track if there are more items to load
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    const fetchSharesAndAnswers = async () => {
      // Prevent fetching if already loading
      if (isLoading) return; 
      setIsLoading(true); 

      // Fetch shares from Firestore
      const sharesResponse = await fetch(`/api/share?page=${page}&limit=10`, {
        method: 'GET',
      });
      const newShares = await sharesResponse.json();
      console.log(`Number of new shares: ${newShares.length}`);
      newShares.forEach((share: Share) => console.log(`createdAt: ${new Date((share.createdAt as any)._seconds * 1000)}, answerId: ${share.answerId}`));
      
      if (newShares.length === 0) {
        setHasMore(false);
        setIsLoading(false); 
        return; 
      }
    
      // Fetch related answers in a batch
      const answerIds = newShares.map((share: Share) => share.answerId).join(',');
      let answersBatch: Answer[];
      try {
        console.log("fetch answers for Ids:", answerIds);
        const answerResponse = await fetch(`/api/chat?answerIds=${answerIds}`);
        answersBatch = await answerResponse.json();
        console.log(answersBatch);
      } catch (error) {
        console.error('Failed to parse answers batch:', error);
      }

      // Update state with new shares and answers
      setShares(prevShares => {
        const existingIds = new Set(prevShares.map(share => share.id));
        const newUniqueShares = newShares.filter((share: Share) => !existingIds.has(share.id));
        return [...prevShares, ...newUniqueShares].sort((a, b) => {
          const dateA = new Date(a.createdAt.seconds * 1000);
          const dateB = new Date(b.createdAt.seconds * 1000);
          return dateB.getTime() - dateA.getTime();
        });
      });

      setAnswers(prevAnswers => {
        // Create a new object combining previous answers and new ones
        const updatedAnswers = { ...prevAnswers };
        answersBatch.forEach((answer: Answer) => {
          updatedAnswers[answer.id] = answer;
        });
        return updatedAnswers;
      });

      // Check if there are less than 10, which means we've reached the end
      if (newShares.length < 10) {
        setHasMore(false);
      } else {
        // Increment page only if new shares are added
        setPage(prevPage => prevPage + 1);
      }

      setIsLoading(false);
    };

    if (hasMore && !isLoading) {
      fetchSharesAndAnswers();
    }

  }, [page, hasMore, isLoading]);

  // Intersection observer effect
  useEffect(() => {
    if (inView && hasMore && !isLoading) {
      setPage(prevPage => prevPage + 1);
    }
  }, [inView, hasMore, isLoading]);

  return (
    <Layout>
        <div>
        {shares.map((share, index) => (
            <div key={index} className="bg-white p-2.5 m-2.5">
                <div className="flex items-center">
                    <span className="material-icons">person</span>
                    <p className="ml-4">
                        {`${share.firstName} ${share.lastName}`}
                        <span className="ml-4">
                            {formatDistanceToNow(new Date((share.createdAt as any)._seconds * 1000), { addSuffix: true })}
                        </span>
                    </p>
                </div>
                {share.comments && <p className="mt-1 mb-2.5">{share.comments}</p>}
                <div className="bg-gray-100 p-2.5 rounded">
                  {answers[share.answerId] ? (
                    <div className="markdownanswer">
                      <ReactMarkdown remarkPlugins={[gfm]}>
                        {answers[share.answerId].answer}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p>Loading answer...</p>
                  )}
                </div>
            </div>
        ))}
        {/* Intersection Observer Element */}
        {hasMore && <div ref={ref} style={{ height: 1 }} />}
      </div>
    </Layout>
  );
};

export default SharedAnswers;
