import Layout from '@/components/layout';
import CopyButton from '@/components/CopyButton';
import LikeButton from '@/components/LikeButton';
import SourcesList from '@/components/SourcesList';
import TruncatedMarkdown from '@/components/TruncatedMarkdown';
import { useEffect, useState, useCallback, useRef } from 'react';
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
import { GetServerSideProps } from 'next';

const AllAnswers = () => {
  const router = useRouter();
  const { sortBy: urlSortBy, page: urlPage } = router.query;
  const [sortBy, setSortBy] = useState<string>('mostRecent');
  const [isSortByInitialized, setIsSortByInitialized] = useState(false);

  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [likeStatuses, setLikeStatuses] = useState<Record<string, boolean>>({});
  const [isSudoUser, setIsSudoUser] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showErrorPopup, setShowErrorPopup] = useState(false);
  const [linkCopied, setLinkCopied] = useState<string | null>(null);

  // State to track if the data has been loaded at least once
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  // State to control the delayed spinner visibility
  const [showDelayedSpinner, setShowDelayedSpinner] = useState(false);

  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());

  const handleExpandQuestion = (answerId: string) => {
    setExpandedQuestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(answerId)) {
        newSet.delete(answerId);
      } else {
        newSet.add(answerId);
      }
      return newSet;
    });
  };

  const [isRestoringScroll, setIsRestoringScroll] = useState(false);

  // Function to save scroll position
  const saveScrollPosition = () => {
    const scrollY = window.scrollY;
    sessionStorage.setItem('answersScrollPosition', scrollY.toString());
    console.log('Saved scroll position:', scrollY);
  };

  // Function to get saved scroll position
  const getSavedScrollPosition = () => {
    const savedPosition = sessionStorage.getItem('answersScrollPosition');
    return savedPosition ? parseInt(savedPosition, 10) : 0;
  };

  // Add this useEffect to save scroll position periodically
  useEffect(() => {
    const intervalId = setInterval(saveScrollPosition, 1000);
  
    return () => clearInterval(intervalId);
  }, []);

  // Modify this useEffect to save scroll position when navigating away
  useEffect(() => {
    const handleBeforeUnload = () => {
      saveScrollPosition();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // Modify this useEffect to handle popstate
  useEffect(() => {
    const handlePopState = () => {
      console.log('Popstate event triggered.');
      setIsRestoringScroll(true);
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  useEffect(() => {
    // Reset answers when sortBy changes
    setAnswers({});
    setTotalPages(1);
    console.log('Resetting answers due to sortBy change');
  }, [sortBy]);

  useEffect(() => {
    if (router.isReady) {
      const pageFromUrl = Number(urlPage) || 1;
      console.log('URL page changed:', pageFromUrl);
      setCurrentPage(pageFromUrl);
    }
  }, [router.isReady, urlPage]);

  useEffect(() => {
    if (router.isReady) {
      const pageFromUrl = Number(urlPage) || 1;
      setCurrentPage(pageFromUrl);
      console.log('Initial load - currentPage:', pageFromUrl, 'urlSortBy:', urlSortBy, 'sortBy:', sortBy);

      if (urlSortBy && typeof urlSortBy === 'string' && urlSortBy !== sortBy) {
        setSortBy(urlSortBy);
        console.log('Setting sortBy from URL:', urlSortBy);
      } else {
        setIsSortByInitialized(true);
        console.log('Setting isSortByInitialized to true');
      }
    }
  }, [router.isReady, urlPage, urlSortBy]);

  useEffect(() => {
    if (router.isReady && sortBy === urlSortBy) {
      setIsSortByInitialized(true);
      console.log('Setting isSortByInitialized to true after sortBy update');
    }
  }, [router.isReady, sortBy, urlSortBy]);

  useEffect(() => {
    if (router.isReady && isSortByInitialized) {
      console.log('Router is ready and sortBy is initialized');
      initGA();
      const pageFromUrl = Number(urlPage) || 1;
      console.log(`Fetching answers. Current page from URL: ${pageFromUrl}`);
      fetchAnswers(pageFromUrl).then(() => {
        console.log('Answers fetched. isRestoringScroll:', isRestoringScroll);
        if (!isRestoringScroll) {
          setIsRestoringScroll(true);
        }
      });
    }
  }, [router.isReady, isSortByInitialized, urlPage, sortBy]);

  useEffect(() => {
    if (isRestoringScroll && !isLoading && initialLoadComplete) {
      const savedPosition = getSavedScrollPosition();
      console.log('Attempting to restore scroll position to:', savedPosition);
      setTimeout(() => {
        window.scrollTo(0, savedPosition);
        console.log('Scroll position restored. Current scroll:', window.scrollY);
        setIsRestoringScroll(false);
        // Clear the saved position after restoring
        sessionStorage.removeItem('answersScrollPosition');
      }, 100); // Small delay to ensure content is rendered
    }
  }, [isRestoringScroll, isLoading, initialLoadComplete]);

  const fetchAnswers = useCallback(async (page: number) => {
    if (!router.isReady) return;

    setIsLoading(true);
    setError(null);
    setShowErrorPopup(false);

    try {
      console.log(`Fetching answers for page: ${page}, sortBy: ${sortBy}`);
      const answersResponse = await fetch(`/api/answers?page=${page}&limit=10&sortBy=${sortBy}`, {
        method: 'GET',
      });
      if (!answersResponse.ok) {
        throw new Error(`HTTP error! status: ${answersResponse.status}`);
      }
      const data = await answersResponse.json();
      console.log('Fetched answers:', data);
      setAnswers(data.answers);
      setTotalPages(data.totalPages);
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
  }, [sortBy, router.isReady]);

  useEffect(() => {
    if (router.isReady && isSortByInitialized) {
      const currentSortBy = router.query.sortBy as string | undefined;
      if (sortBy !== currentSortBy) {
        console.log('Pushing new sortBy to URL:', sortBy);
        router.push(`/answers?page=${currentPage}&sortBy=${sortBy}`, undefined, { shallow: true });
      }
    }
  }, [sortBy, currentPage, router.isReady, isSortByInitialized]);

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
      console.log('Checked sudo status:', sudoStatus);
    };
    checkSudoStatus();
  }, []);

  // fetch user like statuses for this user - what they have liked
  useEffect(() => {
    const fetchLikeStatuses = async (answerIds: string[]) => {
      const uuid = getOrCreateUUID();
      const statuses = await checkUserLikes(answerIds, uuid);
      setLikeStatuses(prevStatuses => ({ ...prevStatuses, ...statuses }));
      console.log('Fetched like statuses:', statuses);
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
    if (newSortBy !== sortBy) {
      setAnswers({});
      setCurrentPage(1);
      setTotalPages(1);
      setSortBy(newSortBy);
      router.push(`/answers?page=1&sortBy=${newSortBy}`, undefined, { shallow: true });
      logEvent('change_sort', 'UI', newSortBy);
    }
  };

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

  const truncateTitle = (title: string, maxLength: number) => {
    return title.length > maxLength ? `${title.slice(0, maxLength)}...` : title;
  };

  const handleRelatedQuestionClick = (relatedQuestionId: string, relatedQuestionTitle: string) => {
    logEvent('click_related_question', 'Engagement', `Related Question ID: ${relatedQuestionId}, Title: ${relatedQuestionTitle}`);
  };

  const handlePageChange = (newPage: number) => {
    console.log('Changing to page:', newPage);
    setCurrentPage(newPage);
    // Clear saved scroll position for manual page changes
    sessionStorage.removeItem('answersScrollPosition');
    console.log('Cleared saved scroll position for page change');
    router.push(`/answers?page=${newPage}&sortBy=${sortBy}`, undefined, { shallow: true });
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
          <div key={`${currentPage}-${sortBy}`}>
            <div>
              {Object.values(answers).map((answer, index) => (
                <div key={answer.id} className="bg-white p-2.5 m-2.5">
                  <div className="flex items-center">
                    <span className="material-icons">question_answer</span>
                    <div className="ml-4 flex-grow">
                      <div className="mb-2">
                        <Link href={`/answers/${answer.id}`} legacyBehavior>
                          <a className="text-black-600 hover:underline cursor-pointer">
                            <b className="block">
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
                            onClick={(e) => {
                              e.preventDefault();
                              handleExpandQuestion(answer.id);
                            }}
                            className="text-black hover:underline ml-2"
                          >
                            <b>See More</b>
                          </button>
                        )}
                      </div>
                      <div className="text-sm text-gray-500">
                        {formatDistanceToNow(new Date(answer.timestamp._seconds * 1000), { addSuffix: true })}
                        <span className="ml-4">
                          {answer.collection ? collectionsConfig[answer.collection as keyof typeof collectionsConfig].replace(/ /g, "\u00a0") : 'Unknown\u00a0Collection'}
                        </span>            
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-100 p-2.5 rounded">
                    <div className="markdownanswer">
                      <TruncatedMarkdown markdown={answer.answer} maxCharacters={600} />
                      {answer.sources && (
                        <SourcesList
                          sources={answer.sources}
                          collectionName={answer.collection}
                        />
                      )}
                      {answer.relatedQuestionsV2 && answer.relatedQuestionsV2.length > 0 && (
                        <div className="bg-gray-200 pt-0.5 pb-3 px-3 rounded-lg mt-2 mb-2">
                          <h3 className="text-lg !font-bold mb-2">Related Questions</h3>
                          <ul className="list-disc pl-2">
                            {answer.relatedQuestionsV2.map((relatedQuestion) => (
                              <li key={relatedQuestion.id} className="ml-0">
                                <a
                                  href={`/answers/${relatedQuestion.id}`}
                                  className="text-blue-600 hover:underline"
                                  onClick={() => handleRelatedQuestionClick(relatedQuestion.id, relatedQuestion.title)}
                                >
                                  {truncateTitle(relatedQuestion.title, 150)}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
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
                            {answer.vote === -1 && (
                              <button
                                className="ml-4 text-red-600"
                                title="Downvote"
                              >
                                <span className="material-icons">thumb_down</span>
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Add pagination controls */}
            <div className="flex justify-center mt-4">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-4 py-2 mr-2 bg-blue-500 text-white rounded disabled:bg-gray-300"
              >
                Previous
              </button>
              <span className="px-4 py-2">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-4 py-2 ml-2 bg-blue-500 text-white rounded disabled:bg-gray-300"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export const getServerSideProps: GetServerSideProps = async (context) => {
  // You can perform initial data fetching here if needed
  return {
    props: {}, // will be passed to the page component as props
  };
};

export default AllAnswers;