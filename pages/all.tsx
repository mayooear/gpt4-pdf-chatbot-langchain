import Layout from '@/components/layout';
import CopyButton from '@/components/CopyButton';
import LikeButton from '@/components/LikeButton';
import SourcesList from '@/components/SourcesList';
import TruncatedMarkdown from '@/components/TruncatedMarkdown';
import { useEffect, useState, useCallback } from 'react';
import { useInView } from 'react-intersection-observer';
import { formatDistanceToNow } from 'date-fns';
import { Answer } from '@/types/answer';
import { checkUserLikes, getLikeCounts } from '@/services/likeService';
import { isSudo } from '@/utils/cookieUtils';
import { collectionsConfig } from '@/utils/collectionsConfig';
import { getOrCreateUUID } from '@/utils/uuid';

const AllAnswers = () => {
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [page, setPage] = useState(0);
  const { ref, inView } = useInView();
  const [isLoading, setIsLoading] = useState(false);
  const [likeStatuses, setLikeStatuses] = useState<Record<string, boolean>>({});
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [isSudoUser, setIsSudoUser] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newContentLoaded, setNewContentLoaded] = useState(false);

  // State to track if there are more items to load
  const [hasMore, setHasMore] = useState(true);

  // State to track if the data has been loaded at least once
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  // State to control the delayed spinner visibility
  const [showDelayedSpinner, setShowDelayedSpinner] = useState(false);

     const fetchAnswers = useCallback(async () => {
     if (isLoading) return;
     setIsLoading(true);
     setError(null); // Reset error state before fetching

     let newAnswers: Answer[] = [];
     try {
       const answersResponse = await fetch(`/api/logs?page=${page}&limit=10`, {
         method: 'GET',
       });
       if (!answersResponse.ok) {
         throw new Error(`HTTP error! status: ${answersResponse.status}`);
       }
       newAnswers = await answersResponse.json();
     } catch (error: any) {
       console.error("Failed to fetch answers:", error);
       if (error.message.includes('429')) {
         setError('Quota exceeded. Please try again later.');
       } else {
         setError('Failed to fetch answers. Please try again.');
       }
     } finally {
       setIsLoading(false);
       setInitialLoadComplete(true);
     }

     if (newAnswers.length === 0) {
       setHasMore(false);
     } else {
       setAnswers(prevAnswers => {
         const updatedAnswers = { ...prevAnswers };
         newAnswers.forEach((answer: Answer) => {
           updatedAnswers[answer.id] = answer;
         });
         return updatedAnswers;
       });

       // Fetch like counts for the new answers
       if (process.env.PUBLIC_LIKE_BUTTON_ENABLED === 'true') {
        const answerIds = newAnswers.map(answer => answer.id);
        getLikeCounts(answerIds).then(counts => {
          setLikeCounts(prevCounts => ({ ...prevCounts, ...counts }));
        }).catch(error => {
          console.error('Error fetching like counts:', error);
        });
      }
     }
   }, [page, isLoading]);

  useEffect(() => {
    if (hasMore && !isLoading) {
      fetchAnswers();
    }
  }, [page, hasMore, isLoading, fetchAnswers]);

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

  // Intersection observer effect
  useEffect(() => {
    if (inView && hasMore && !isLoading) {
      setPage(prevPage => prevPage + 1);
    }
  }, [inView, hasMore, isLoading]);

  useEffect(() => {
    const checkSudoStatus = async () => {
      const sudoStatus = await isSudo();
      setIsSudoUser(sudoStatus);
    };
    checkSudoStatus();
  }, []);

  // these two are for visual indication when new content loaded by infinite scroll
  useEffect(() => {
    if (inView && hasMore && !isLoading) {
      setPage(prevPage => prevPage + 1);
      setNewContentLoaded(true);
    }
  }, [inView, hasMore, isLoading]);
  useEffect(() => {
    if (newContentLoaded) {
      window.scrollTo({
        top: document.documentElement.scrollTop + 100, // Scroll down slightly
        behavior: 'smooth',
      });
      setNewContentLoaded(false);
    }
  }, [newContentLoaded]);

  useEffect(() => {
    if (process.env.PUBLIC_LIKE_BUTTON_ENABLED === 'true') {
      const fetchLikeStatuses = async (answerIds: string[]) => {
        const uuid = getOrCreateUUID();
        const statuses = await checkUserLikes(answerIds, uuid);
        setLikeStatuses(prevStatuses => ({ ...prevStatuses, ...statuses }));
      };
  
      if (Object.keys(answers).length > 0) {
        fetchLikeStatuses(Object.keys(answers));
      }
    }
  }, [answers]);

  useEffect(() => {
    if (process.env.PUBLIC_LIKE_BUTTON_ENABLED === 'true') {
      const fetchLikeCounts = async (answerIds: string[]) => {
        const counts = await getLikeCounts(answerIds);
        setLikeCounts(prevCounts => ({ ...prevCounts, ...counts }));
      };
  
      if (Object.keys(answers).length > 0) {
        fetchLikeCounts(Object.keys(answers));
      }
    }
  }, [answers]);
  
  return (
    <Layout>
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {isLoading && !initialLoadComplete ? (
          <div className="flex justify-center items-center h-screen">
            <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-blue-600"></div>
            <p className="text-lg text-gray-600 ml-4">Loading...</p>
          </div>
        ) : error ? (
          <div className="flex justify-center items-center h-screen">
            <p className="text-lg text-red-600">{error}</p>
          </div>
        ) : (
          <div>
            <div>
              {Object.values(answers).map((answer, index) => (
                <div key={answer.id} className="bg-white p-2.5 m-2.5">
                  <div className="flex items-center">
                    <span className="material-icons">question_answer</span>
                    <p className="ml-4">
                      <b>Question:</b> {answer.question}
                      <span className="ml-4">
                        {formatDistanceToNow(new Date(answer.timestamp._seconds * 1000), { addSuffix: true }) + ' '}
                        {answer.vote === -1 && (
                          <span className="items-center ml-2 text-red-600">
                            <span className="material-icons">thumb_down</span>
                          </span>
                        )}
                        <span className="ml-4">{answer.collection ? collectionsConfig[answer.collection as keyof typeof collectionsConfig].replace(/ /g, "\u00a0") : 
                          'Unknown\u00a0Collection'}
                        </span>            
                      </span>
                    </p>
                  </div>
                  <div className="bg-gray-100 p-2.5 rounded">
                    <div className="markdownanswer">
                      <TruncatedMarkdown markdown={answer.answer} maxCharacters={600} />
                      {answer.sources && (
                        <SourcesList sources={answer.sources} useAccordion={true} />
                      )}
                      <div className="flex items-center">
                        <CopyButton markdown={answer.answer} />
                        <div className="ml-4">
                          {isSudoUser && process.env.PUBLIC_LIKE_BUTTON_ENABLED === 'true' && (
                            <LikeButton
                              answerId={answer.id}
                              initialLiked={likeStatuses[answer.id] || false}
                              likeCount={likeCounts[answer.id] || 0}
                            />
                          )}
                        </div>
                        {isSudoUser && <span className="ml-6">IP: ({answer.ip})</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {hasMore && <div ref={ref} style={{ height: 1 }} />}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AllAnswers;
