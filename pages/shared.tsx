import Layout from '@/components/layout';
import { useEffect, useState } from 'react';
import { useInView } from 'react-intersection-observer';
import ReactMarkdown from 'react-markdown';
import gfm from 'remark-gfm';
import { formatDistanceToNow } from 'date-fns';
import { Share } from 'next/font/google';
import { Document } from 'langchain/document';
import CopyButton from '@/components/CopyButton';
import LikeButton from '@/components/LikeButton';
import SourcesList from '@/components/SourcesList';
import { checkUserLikes, getLikeCounts } from '@/services/likeService';
import { getOrCreateUUID } from '@/utils/uuid';
import { toast } from 'react-toastify';
import TruncatedMarkdown from '@/components/TruncatedMarkdown';

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
  sources: Document[];
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
  const [likeStatuses, setLikeStatuses] = useState<Record<string, boolean>>({});
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});

  // State to track if there are more items to load
  const [hasMore, setHasMore] = useState(true);

  // State to track if the data has been loaded at least once
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  // State to control the delayed spinner visibility
  const [showDelayedSpinner, setShowDelayedSpinner] = useState(false);

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
      
      if (newShares.length === 0) {
        setHasMore(false);
        setIsLoading(false); 
        return; 
      }
    
      // Fetch related answers in a batch
      const answerIds = newShares.map((share: Share) => share.answerId).join(',');
      let answersBatch: Answer[];
      const answerResponse = await fetch(`/api/chat?answerIds=${answerIds}`);
      if (!answerResponse.ok) {
        answersBatch = [];
        toast.error(`Error fetching answers: ${answerResponse.statusText}`);
      } else {
        try {
          answersBatch = await answerResponse.json();
        } catch (error) {
          answersBatch = [];
          toast.error('Failed to parse answers. Please try again.');
        }
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
          // if (typeof answer.sources === 'string' && answer.sources !== '') {
          //   try {
          //     JSON.parse(answer.sources);
          //   } catch (error) {
          //     // If sources is not valid JSON, clear it out
          //     answer.sources = '';
          //   }
          // }
          updatedAnswers[answer.id] = answer;
        });
        return updatedAnswers;
      });

      // fetch like counts for these answers
      if (answersBatch && answersBatch.length > 0) {
        const answerIds = answersBatch.map(answer => answer.id);
        getLikeCounts(answerIds).then(counts => {
          setLikeCounts(prevCounts => ({ ...prevCounts, ...counts }));
        }).catch(error => {
          console.error('Error fetching like counts:', error);
        });
      }

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

  useEffect(() => {
    // After the first successful data fetch, set initialLoadComplete to true
    if (shares.length > 0 || Object.keys(answers).length > 0) {
      setInitialLoadComplete(true);
    }
  }, [shares, answers]); 

  useEffect(() => {
    // Set a timeout to show the spinner after 1.5 seconds
    const timer = setTimeout(() => {
      if (isLoading) {
        setShowDelayedSpinner(true);
      }
    }, 1500);

    // Clear the timeout if the component unmounts or isLoading changes to false
    return () => clearTimeout(timer);
  }, [isLoading]);

  useEffect(() => {
    const fetchLikeStatuses = async (answerIds: string[]) => {
      // Call a service function that checks if the current user has liked these answers
      // This function should be optimized to minimize DB reads, possibly by checking in batches
      const uuid = getOrCreateUUID();
      const statuses = await checkUserLikes(answerIds, uuid);
      setLikeStatuses(prevStatuses => ({ ...prevStatuses, ...statuses }));
    };

    if (Object.keys(answers).length > 0) {
      fetchLikeStatuses(Object.keys(answers));
    }
  }, [answers]);

  // Intersection observer effect
  useEffect(() => {
    if (inView && hasMore && !isLoading) {
      setPage(prevPage => prevPage + 1);
    }
  }, [inView, hasMore, isLoading]);

  return (
    <Layout>
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {isLoading && !initialLoadComplete && showDelayedSpinner ? (
          <div className="flex justify-center items-center h-screen">
            <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-blue-600"></div>
            <p className="text-lg text-gray-600 ml-4">Loading...</p>
          </div>
        ) : (
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
                      {/* Use the TruncatedMarkdown component for the answer content */}
                      <TruncatedMarkdown markdown={answers[share.answerId].answer} maxCharacters={600} />
                      {/* Render the sources list if available */}
                      {answers[share.answerId].sources && (
                        <SourcesList sources={answers[share.answerId].sources} useAccordion={true} />
                      )}
                      {/* Render the interaction buttons */}
                      <div className="flex items-center">
                        <CopyButton markdown={answers[share.answerId].answer} />
                        <div className="ml">
                          <LikeButton
                            answerId={share.answerId}
                            initialLiked={likeStatuses[share.answerId] || false}
                            likeCount={likeCounts[share.answerId] || 0} // Pass the like count to LikeButton
                          />
                        </div>
                      </div>
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
        )}
      </div>
    </Layout>
  );
};

export default SharedAnswers;
