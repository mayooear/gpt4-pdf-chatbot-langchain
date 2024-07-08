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
import { useRouter } from 'next/router';
import { initGA, logEvent } from '@/utils/client/analytics';
import React from 'react';
import Link from 'next/link';

const AllAnswers = () => {
  const router = useRouter();
  const { sortBy: urlSortBy } = router.query;
  const [sortBy, setSortBy] = useState<string>('mostRecent');
  const [isSortByInitialized, setIsSortByInitialized] = useState(false);

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
  const [contentLoadedByScroll, setContentLoadedByScroll] = useState(false); 
  const [linkCopied, setLinkCopied] = useState<string | null>(null);

  // State to track if there are more items to load
  const [hasMore, setHasMore] = useState(true);

  // State to track if the data has been loaded at least once
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  // State to control the delayed spinner visibility
  const [showDelayedSpinner, setShowDelayedSpinner] = useState(false);

  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());

  const expandQuestion = (answerId: string, event: React.MouseEvent) => {
    event.preventDefault();
    setExpandedQuestions(prev => new Set(prev).add(answerId));
  };

  useEffect(() => {
    initGA();
  }, []);

  const fetchAnswers = useCallback(async () => {
    setIsLoading(true);
    setError(null); 
    setShowErrorPopup(false); 

    let newAnswers: Answer[] = [];
    try {
      const answersResponse = await fetch(`/api/answers?page=${page}&limit=10&sortBy=${sortBy}`, {
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
  }, [page, sortBy]);

  useEffect(() => {
    if (page === 0 || Object.keys(answers).length > 0) {
      if (isSortByInitialized) {
        fetchAnswers();
      }
    }
  }, [page, fetchAnswers, sortBy, isSortByInitialized]);

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
    // Reset answers and page when sortBy changes
    setAnswers({});
    setPage(0);
    setHasMore(true);
  }, [sortBy]);

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
      setContentLoadedByScroll(true);
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
    if (newContentLoaded && contentLoadedByScroll) { 
      window.scrollTo({
        top: document.documentElement.scrollTop + 100, // Scroll down slightly
        behavior: 'smooth',
      });
      setNewContentLoaded(false);
      setContentLoadedByScroll(false);
    }
  }, [newContentLoaded, contentLoadedByScroll]);

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

    logEvent('like_answer', 'Engagement', answerId);
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
        logEvent('delete_answer', 'Admin', answerId);
      } catch (error) {
        console.error('Error deleting answer:', error);
        alert('Failed to delete answer. Please try again.');
      }
    }
  };

  const handleSortChange = (newSortBy: string) => {
    setAnswers({});
    setPage(0);
    setHasMore(true);
    setSortBy(newSortBy);
    logEvent('change_sort', 'UI', newSortBy);
  };

  useEffect(() => {
    if (router.isReady && urlSortBy && typeof urlSortBy === 'string' && urlSortBy !== sortBy) {
      setSortBy(urlSortBy);
    } else {
      setIsSortByInitialized(true);
    }
  }, [router.isReady, urlSortBy]);

  useEffect(() => {
    if (router.isReady && isSortByInitialized) {
      const currentSortBy = router.query.sortBy as string | undefined;
      if (sortBy === 'mostRecent' && currentSortBy !== undefined) {
        router.push('/answers', undefined, { shallow: true });
      } else if (sortBy !== 'mostRecent' && currentSortBy !== sortBy) {
        router.push(`/answers?sortBy=${sortBy}`, undefined, { shallow: true });
      }
    }
  }, [sortBy, router.isReady, isSortByInitialized]);

  const renderTruncatedQuestion = (question: string, maxLength: number) => {
    const truncated = question.slice(0, maxLength);
    return truncated.split('\n').map((line, i, arr) => (
      <React.Fragment key={i}>
        {line}
        {i < arr.length - 1 && <br />}
      </React.Fragment>
    ));
  };

  const handleCopyLink = (answerId: string) => {
    const url = `${window.location.origin}/answers/${answerId}`;
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(answerId);
      setTimeout(() => setLinkCopied(null), 2000);
      logEvent('copy_link', 'Engagement', `Answer ID: ${answerId}`);
    });
  };

  return (
    <Layout>
      <div className="flex justify-between items-center mb-4">
        <div></div>
        <div className="flex items-center mt-0.5">
          <label htmlFor="sortBy" className="mr-2 text-gray-700">Sort by:</label>
          <select
            id="sortBy"
            className="border border-gray-300 rounded p-1"
            onChange={(e) => handleSortChange(e.target.value)}
            value={sortBy}
          >
            <option value="mostRecent">Most Recent</option>
            <option value="mostPopular">Most Popular</option>
          </select>
        </div>
      </div>
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
                    <div className="ml-4 flex-grow">
                      <Link href={`/answers/${answer.id}`} legacyBehavior>
                        <a className="text-black-600 hover:underline cursor-pointer">
                          <b>
                            {expandedQuestions.has(answer.id) ? (
                              answer.question.split('\n').map((line, i) => (
                                <React.Fragment key={i}>
                                  {line}
                                  {i < answer.question.split('\n').length - 1 && <br />}
                                </React.Fragment>
                              ))
                            ) : (
                              <>
                                {renderTruncatedQuestion(answer.question, 200)}
                                {answer.question.length > 200 && '...'}
                              </>
                            )}
                          </b>
                        </a>
                      </Link>
                      {answer.question.length > 200 && !expandedQuestions.has(answer.id) && (
                                               <button 
                          onClick={(e) => expandQuestion(answer.id, e)}
                          className="text-black hover:underline ml-2"
                        >
                          <b>See More</b>
                        </button>
                      )}
                      <span className="ml-4 text-sm">
                        {formatDistanceToNow(new Date(answer.timestamp._seconds * 1000), { addSuffix: true }) + ' '}
                        <span className="ml-4">
                          {answer.collection ? collectionsConfig[answer.collection as keyof typeof collectionsConfig].replace(/ /g, "\u00a0") : 'Unknown\u00a0Collection'}
                        </span>            
                      </span>
                    </div>
                  </div>
                  <div className="bg-gray-100 p-2.5 rounded">
                    <div className="markdownanswer">
                      <TruncatedMarkdown markdown={answer.answer} maxCharacters={600} />
                      {answer.sources && (
                        <SourcesList sources={answer.sources} useAccordion={false} />
                      )}
                      <div className="flex items-center">
                        <CopyButton
                          markdown={answer.answer}
                          answerId={answer.id}
                        />
                        <button
                          onClick={() => handleCopyLink(answer.id)}
                          className="ml-4 text-black-600 hover:underline flex items-center"
                          title="Copy link to clipboard"
                        >
                          <span className="material-icons">
                            {linkCopied === answer.id ? 'check' : 'link'}
                          </span>
                        </button>
                        <div className="ml-4">
                          <LikeButton
                            key={`${answer.id}-${likeStatuses[answer.id]}`}
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
