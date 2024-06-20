import Layout from '@/components/layout';
import CopyButton from '@/components/CopyButton';
import LikeButton from '@/components/LikeButton';
import SourcesList from '@/components/SourcesList';
import TruncatedMarkdown from '@/components/TruncatedMarkdown';
import { useEffect, useState, useCallback } from 'react';
import { useInView } from 'react-intersection-observer';
import { formatDistanceToNow } from 'date-fns';
import { Answer } from '@/types/answer';
import { checkUserLikes } from '@/services/likeService';
import { isSudo } from '@/utils/client/cookieUtils';
import { collectionsConfig } from '@/utils/client/collectionsConfig';
import { getOrCreateUUID } from '@/utils/client/uuid';

const AllAnswers = () => {
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [page, setPage] = useState(0);
  const { ref, inView } = useInView();
  const [isLoading, setIsLoading] = useState(false);
  const [likeStatuses, setLikeStatuses] = useState<Record<string, boolean>>({});
  const [isSudoUser, setIsSudoUser] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newContentLoaded, setNewContentLoaded] = useState(false);
  const [showErrorPopup, setShowErrorPopup] = useState(false);
  const [canLoadNextPage, setCanLoadNextPage] = useState(true);

  // State to track if there are more items to load
  const [hasMore, setHasMore] = useState(true);

  // State to track if the data has been loaded at least once
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  // State to control the delayed spinner visibility
  const [showDelayedSpinner, setShowDelayedSpinner] = useState(false);

  const fetchAnswers = useCallback(async () => {
    setIsLoading(true);
    setError(null); // Reset error state before fetching
    setShowErrorPopup(false); 

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
      setShowErrorPopup(true); 
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
    }
  }, [page]);

  useEffect(() => {
    fetchAnswers();
  }, [page, fetchAnswers]);

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
    const checkSudoStatus = async () => {
      const cookies = document.cookie;
      const sudoStatus = await isSudo(cookies);
      setIsSudoUser(sudoStatus);
    };
    checkSudoStatus();
  }, []);

  // Intersection observer effect
  useEffect(() => {
    if (inView && hasMore && !isLoading && canLoadNextPage) {
      setPage(prevPage => prevPage + 1);
      setNewContentLoaded(true);
      setCanLoadNextPage(false);

      // Set a delay before allowing the next page to load. This is to avoid it loading
      // two pages at a time.
      setTimeout(() => {
        setCanLoadNextPage(true);
      }, 1000);
    }
  }, [inView, hasMore, isLoading, canLoadNextPage]);

  // visual indication when new content loaded by infinite scroll
  useEffect(() => {
    if (newContentLoaded) {
      window.scrollTo({
        top: document.documentElement.scrollTop + 100, // Scroll down slightly
        behavior: 'smooth',
      });
      setNewContentLoaded(false);
    }
  }, [newContentLoaded]);

  // fetch user like statuses for this user - what they have liked
  // TODO: cache like statuses so not re-pulled during infinite scroll
  useEffect(() => {
    const fetchLikeStatuses = async (answerIds: string[]) => {
      const uuid = getOrCreateUUID();
      const statuses = await checkUserLikes(answerIds, uuid);
      setLikeStatuses(prevStatuses => ({ ...prevStatuses, ...statuses }));
    };

    if (Object.keys(answers).length > 0) {
      fetchLikeStatuses(Object.keys(answers));
    }
  }, [answers]);

  const handleLikeCountChange = (answerId: string, newLikeCount: number) => {
    setAnswers(prevAnswers => ({
      ...prevAnswers,
      [answerId]: {
        ...prevAnswers[answerId],
        likeCount: newLikeCount,
      },
    }));
  };

  const handleDelete = async (answerId: string) => {
    if (confirm('Are you sure you want to delete this answer?')) {
      try {
        const response = await fetch(`/api/answers?answerId=${answerId}`, {
          method: 'DELETE',
        });
        const responseData = await response.json();
        if (!response.ok) {
          throw new Error('Failed to delete answer (' + responseData.message + ')');
        }
        setAnswers(prevAnswers => {
          const updatedAnswers = { ...prevAnswers };
          delete updatedAnswers[answerId];
          return updatedAnswers;
        });
      } catch (error) {
        console.error('Error deleting answer:', error);
        alert('Failed to delete answer. Please try again.');
      }
    }
  };
  
  return (
    <Layout>
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {showErrorPopup && error && (
          <div className="fixed top-4 right-4 bg-red-600 text-white p-4 rounded shadow-lg z-50">
            <p>{error}</p>
            <button onClick={() => setShowErrorPopup(false)} className="mt-2 underline">
              Close
            </button>
          </div>
        )}
        {isLoading && !initialLoadComplete ? (
          <div className="flex justify-center items-center h-screen">
            <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-blue-600"></div>
            <p className="text-lg text-gray-600 ml-4">Loading...</p>
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
                          <LikeButton
                            answerId={answer.id}
                            initialLiked={likeStatuses[answer.id] || false}
                            likeCount={answer.likeCount}
                            onLikeCountChange={handleLikeCountChange}
                          />
                        </div>
                        {isSudoUser && (
                          <>
                            <button onClick={() => handleDelete(answer.id)} className="ml-4 text-red-600">
                              <span className="material-icons">delete</span>
                            </button>
                            <span className="ml-6">IP: ({answer.ip})</span>
                          </>
                        )}
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
