// React and Next.js imports
import { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';

// Component imports
import Layout from '@/components/layout';
import Popup from '@/components/popup';
import LikePrompt from '@/components/LikePrompt';
import { ChatInput } from '@/components/ChatInput';
import MessageItem from '@/components/MessageItem';

// Hook imports
import usePopup from '@/hooks/usePopup';
import { useRandomQueries } from '@/hooks/useRandomQueries';
import { useChat } from '@/hooks/useChat';
import { useMultipleCollections } from '@/hooks/useMultipleCollections';

// Utility imports
import { logEvent } from '@/utils/client/analytics';
import { getCollectionQueries } from '@/utils/client/collectionQueries';
import { handleVote as handleVoteUtil } from '@/utils/client/voteHandler';
import { SiteConfig } from '@/types/siteConfig';
import {
  getCollectionsConfig,
  getEnableMediaTypeSelection,
  getEnableAuthorSelection,
  getEnabledMediaTypes,
} from '@/utils/client/siteConfig';
import { Document } from 'langchain/document';

// Third-party library imports
import Cookies from 'js-cookie';

import { ExtendedAIMessage } from '@/types/ExtendedAIMessage';

export default function Home({
  siteConfig,
}: {
  siteConfig: SiteConfig | null;
}) {
  const [isMaintenanceMode] = useState<boolean>(false);
  const [collection, setCollection] = useState(() => {
    const collections = getCollectionsConfig(siteConfig);
    return Object.keys(collections)[0] || '';
  });
  const [collectionChanged, setCollectionChanged] = useState<boolean>(false);
  const [query, setQuery] = useState<string>('');
  const [likeStatuses, setLikeStatuses] = useState<Record<string, boolean>>({});
  const [privateSession, setPrivateSession] = useState<boolean>(false);
  const [mediaTypes, setMediaTypes] = useState<{
    text: boolean;
    audio: boolean;
    youtube: boolean;
  }>({ text: true, audio: true, youtube: true });
  const {
    messageState,
    setMessageState,
    loading,
    setLoading,
    error: chatError,
    setError,
  } = useChat(collection, privateSession, mediaTypes, siteConfig);
  const { messages } = messageState as {
    messages: ExtendedAIMessage[];
  };
  const [showLikePrompt] = useState<boolean>(false);
  const [linkCopied, setLinkCopied] = useState<string | null>(null);

  const lastMessageRef = useRef<HTMLDivElement>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const bottomOfListRef = useRef<HTMLDivElement>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [isAutoScrolling, setIsAutoScrolling] = useState(false);
  const userHasScrolledUpRef = useRef(false);
  const lastScrollTopRef = useRef(0);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const scrollToBottom = useCallback(() => {
    if (
      bottomOfListRef.current &&
      isNearBottom &&
      !userHasScrolledUpRef.current
    ) {
      setIsAutoScrolling(true);
      bottomOfListRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'end',
      });
      // Reset isAutoScrolling after animation completes
      setTimeout(() => setIsAutoScrolling(false), 1000);
    }
  }, [isNearBottom]);

  useEffect(() => {
    const handleScroll = () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      if (isAutoScrolling) {
        setIsAutoScrolling(false);
      }

      const messageList = messageListRef.current;
      if (messageList) {
        const { scrollTop, scrollHeight, clientHeight } = messageList;

        // Detect if user has scrolled up
        if (scrollTop < lastScrollTopRef.current) {
          userHasScrolledUpRef.current = true;
        }

        // Update last scroll position
        lastScrollTopRef.current = scrollTop;

        // Check if near bottom
        const scrollPosition = scrollHeight - scrollTop - clientHeight;
        const newIsNearBottom = scrollPosition < scrollHeight * 0.1; // 10% from bottom
        setIsNearBottom(newIsNearBottom);

        // Reset userHasScrolledUp if we're at the very bottom
        if (scrollPosition === 0) {
          userHasScrolledUpRef.current = false;
        }
      }

      scrollTimeoutRef.current = setTimeout(() => {
        // This timeout is just to debounce rapid scroll events
      }, 100);
    };

    const messageList = messageListRef.current;
    if (messageList) {
      messageList.addEventListener('scroll', handleScroll);
    }

    return () => {
      if (messageList) {
        messageList.removeEventListener('scroll', handleScroll);
      }
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [isAutoScrolling]);

  // Use this effect to handle auto-scrolling when new messages are added
  useEffect(() => {
    if (loading && isNearBottom && !userHasScrolledUpRef.current) {
      scrollToBottom();
    }
  }, [messages, loading, isNearBottom, scrollToBottom]);

  const handleMediaTypeChange = (type: 'text' | 'audio' | 'youtube') => {
    if (getEnableMediaTypeSelection(siteConfig)) {
      const enabledTypes = getEnabledMediaTypes(siteConfig);
      if (enabledTypes.includes(type)) {
        setMediaTypes((prev) => {
          const newValue = !prev[type];
          logEvent(
            `select_media_type_${type}`,
            'Engagement',
            newValue ? 'on' : 'off',
          );
          return { ...prev, [type]: newValue };
        });
      }
    }
  };

  // popup message for new users
  const { showPopup, closePopup, popupMessage } = usePopup(
    '1.02',
    siteConfig?.allowPrivateSessions
      ? 'Others can see questions you ask and answers given. ' +
          "Please click 'Start Private Session' below the text entry box if you would prefer we not log or publish your session."
      : '',
  );

  const handleCollectionChange = (newCollection: string) => {
    if (getEnableAuthorSelection(siteConfig) && newCollection !== collection) {
      setCollectionChanged(true);
      setCollection(newCollection);
      Cookies.set('selectedCollection', newCollection, { expires: 365 });
      logEvent('change_collection', 'UI', newCollection);
    }
  };

  const [collectionQueries, setCollectionQueries] = useState({});
  const [isLoadingQueries, setIsLoadingQueries] = useState(true);

  const [abortController, setAbortController] =
    useState<AbortController | null>(null);

  const handleStop = useCallback(() => {
    if (abortController) {
      abortController.abort();
      setLoading(false);
      setAbortController(null);
    }
  }, [abortController, setLoading, setAbortController]);

  const handleSubmit = async (e: React.FormEvent, submittedQuery: string) => {
    e.preventDefault();
    if (submittedQuery.trim() === '') return;

    if (loading) {
      handleStop();
      return;
    }

    setIsNearBottom(true);
    setLoading(true);
    setError(null);

    // Add user message to the state
    setMessageState((prevState) => ({
      ...prevState,
      messages: [
        ...prevState.messages,
        { type: 'userMessage', message: submittedQuery } as ExtendedAIMessage,
      ],
      history: [...prevState.history, [submittedQuery, '']],
    }));

    // Clear the input
    setQuery('');

    // Scroll to bottom after adding user message
    setTimeout(scrollToBottom, 0);

    const newAbortController = new AbortController();
    setAbortController(newAbortController);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: submittedQuery,
          history: messageState.history,
          collection,
          privateSession,
          mediaTypes,
        }),
        signal: newAbortController.signal,
      });

      if (!response.ok) {
        setLoading(false);
        const errorData = await response.json();
        setError(errorData.error || response.statusText);
        return;
      }

      const data = response.body;
      if (!data) {
        setLoading(false);
        setError('No data returned from the server');
        return;
      }

      const reader = data.getReader();
      const decoder = new TextDecoder();
      let accumulatedResponse = '';
      let sourceDocs: Document[] | null = null;
      let isDone = false;

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const jsonData = JSON.parse(line.slice(5));

              if (jsonData.token) {
                accumulatedResponse += jsonData.token;
                updateMessageState(accumulatedResponse, sourceDocs);
              } else if (jsonData.sourceDocs) {
                sourceDocs = jsonData.sourceDocs;
              } else if (jsonData.done) {
                isDone = true;
              } else if (jsonData.error) {
                throw new Error(jsonData.error);
              } else if (jsonData.docId) {
                // Update the last message with the docId
                setMessageState((prevState) => {
                  const updatedMessages = [...prevState.messages];
                  const lastMessage =
                    updatedMessages[updatedMessages.length - 1];
                  if (lastMessage.type === 'apiMessage') {
                    updatedMessages[updatedMessages.length - 1] = {
                      ...lastMessage,
                      docId: jsonData.docId,
                    };
                  }
                  return {
                    ...prevState,
                    messages: updatedMessages,
                  };
                });
              }
            } catch (parseError) {
              console.error('Error parsing JSON:', parseError);
            }
          }
        }

        if (isDone) {
          setLoading(false);
        }
      }
    } catch (error) {
      console.error('Error in handleSubmit:', error);
      setError(
        error instanceof Error
          ? error.message
          : 'An error occurred while streaming the response.',
      );
      setLoading(false);
    }
  };

  const updateMessageState = (
    accumulatedResponse: string,
    sourceDocs: Document[] | null,
  ) => {
    setMessageState((prevState) => {
      const updatedMessages = [...prevState.messages];
      const lastMessage = updatedMessages[updatedMessages.length - 1];

      if (lastMessage.type === 'apiMessage') {
        updatedMessages[updatedMessages.length - 1] = {
          ...lastMessage,
          message: accumulatedResponse,
          sourceDocs: sourceDocs,
        };
      } else {
        updatedMessages.push({
          type: 'apiMessage',
          message: accumulatedResponse,
          sourceDocs: sourceDocs,
        } as ExtendedAIMessage);
      }

      return {
        ...prevState,
        messages: updatedMessages,
        history: [
          ...prevState.history.slice(0, -1),
          [
            prevState.history[prevState.history.length - 1][0],
            accumulatedResponse,
          ],
        ],
      };
    });
    scrollToBottom();
  };

  const handleEnter = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    submittedQuery: string,
  ) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      if (!loading) {
        e.preventDefault();
        setIsNearBottom(true);
        handleSubmit(
          new Event('submit') as unknown as React.FormEvent,
          submittedQuery,
        );
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setQuery(e.target.value);
  };

  useEffect(() => {
    let isMounted = true;
    async function fetchQueries() {
      if (siteConfig) {
        setIsLoadingQueries(true);
        const queries = await getCollectionQueries(
          siteConfig.siteId,
          siteConfig.collectionConfig,
        );
        if (isMounted) {
          setCollectionQueries(queries);
          setIsLoadingQueries(false);
        }
      }
    }
    fetchQueries();
    return () => {
      isMounted = false;
    };
  }, [siteConfig]);

  const queriesForCollection = useMemo(() => {
    if (!collectionQueries[collection as keyof typeof collectionQueries]) {
      // If the current collection is not found, use the first available collection
      const firstAvailableCollection = Object.keys(collectionQueries)[0];
      if (firstAvailableCollection) {
        return collectionQueries[
          firstAvailableCollection as keyof typeof collectionQueries
        ];
      }
      return [];
    }

    const queries =
      collectionQueries[collection as keyof typeof collectionQueries];
    return queries;
  }, [collection, collectionQueries]);

  // Use the memoized queries
  const { randomQueries, shuffleQueries } = useRandomQueries(
    queriesForCollection,
    3,
  );

  const handleLikeCountChange = (answerId: string, liked: boolean) => {
    setLikeStatuses((prevStatuses) => ({
      ...prevStatuses,
      [answerId]: liked,
    }));

    logEvent('like_answer', 'Engagement', answerId);
  };

  const handlePrivateSessionChange = (
    event: React.MouseEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault();
    if (privateSession) {
      // If already in a private session, reload the page
      logEvent('end_private_session', 'UI', '');
      window.location.reload();
    } else {
      // Start a private session
      setPrivateSession(true);
      logEvent('start_private_session', 'UI', '');
    }
  };

  const [votes, setVotes] = useState<Record<string, number>>({});

  const handleVote = (docId: string, isUpvote: boolean) => {
    handleVoteUtil(docId, isUpvote, votes, setVotes);
  };

  const handleCopyLink = (answerId: string) => {
    const url = `${window.location.origin}/answers/${answerId}`;
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(answerId);
      setTimeout(() => setLinkCopied(null), 2000);
      logEvent('copy_link', 'Engagement', `Answer ID: ${answerId}`);
    });
  };

  useEffect(() => {
    // Retrieve and set the collection from the cookie
    // TODO: This is a hack for jairam site test
    const savedCollection =
      Cookies.get('selectedCollection') ||
      (process.env.SITE_ID === 'jairam' ? 'whole_library' : 'master_swami');
    setCollection(savedCollection);

    // Focus the text area only on the client side after the component has mounted.
    // Check if the device is not mobile (e.g., width greater than 768px for iPad)
    if (window.innerWidth > 768) {
      textAreaRef.current?.focus();
    }
  }, []);

  const hasMultipleCollections = useMultipleCollections(
    siteConfig || undefined,
  );

  const handleClick = (clickedQuery: string) => {
    setQuery(clickedQuery);
    setIsNearBottom(true);
    handleSubmit(
      new Event('submit') as unknown as React.FormEvent,
      clickedQuery,
    );
  };

  if (isMaintenanceMode) {
    return (
      <Layout siteConfig={siteConfig}>
        <div className="flex flex-col items-center justify-center min-h-screen">
          <h1 className="text-3xl font-bold">
            This page is currently down for maintenance until approx. 1pm PT.
          </h1>
          <p className="mt-4">
            You can still view the{' '}
            <Link href="/answers" className="text-blue-500">
              All&nbsp;Answers
            </Link>{' '}
            page.
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <>
      {showPopup && popupMessage && (
        <Popup
          message={popupMessage}
          onClose={closePopup}
          siteConfig={siteConfig}
        />
      )}
      <Layout siteConfig={siteConfig}>
        <LikePrompt show={showLikePrompt} siteConfig={siteConfig} />
        <div className="flex flex-col h-full">
          {privateSession && (
            <div className="bg-purple-100 text-purple-800 text-center py-2 flex items-center justify-center">
              <span className="material-icons text-2xl mr-2">lock</span>
              You are in a Private Session (
              <button
                onClick={handlePrivateSessionChange}
                className="underline hover:text-purple-900"
              >
                end private session
              </button>
              )
            </div>
          )}
          <div className="flex-grow overflow-hidden answers-container">
            <div ref={messageListRef} className="h-full overflow-y-auto">
              {messages.map((message, index) => (
                <MessageItem
                  key={`chatMessage-${index}`}
                  messageKey={`chatMessage-${index}`}
                  message={message}
                  previousMessage={index > 0 ? messages[index - 1] : undefined}
                  index={index}
                  isLastMessage={index === messages.length - 1}
                  loading={loading}
                  privateSession={privateSession}
                  collectionChanged={collectionChanged}
                  hasMultipleCollections={hasMultipleCollections}
                  likeStatuses={likeStatuses}
                  linkCopied={linkCopied}
                  votes={votes}
                  siteConfig={siteConfig}
                  handleLikeCountChange={handleLikeCountChange}
                  handleCopyLink={handleCopyLink}
                  handleVote={handleVote}
                  lastMessageRef={lastMessageRef}
                />
              ))}
              <div ref={bottomOfListRef} style={{ height: '1px' }} />
            </div>
          </div>
          <div className="mt-4 px-2 md:px-0">
            {isLoadingQueries ? null : (
              <ChatInput
                loading={loading}
                handleSubmit={handleSubmit}
                handleEnter={handleEnter}
                handleClick={handleClick}
                handleCollectionChange={handleCollectionChange}
                handlePrivateSessionChange={handlePrivateSessionChange}
                collection={collection}
                error={chatError}
                randomQueries={randomQueries}
                shuffleQueries={shuffleQueries}
                isLoadingQueries={isLoadingQueries}
                privateSession={privateSession}
                textAreaRef={textAreaRef}
                mediaTypes={mediaTypes}
                handleMediaTypeChange={handleMediaTypeChange}
                siteConfig={siteConfig}
                input={query}
                handleInputChange={handleInputChange}
                setQuery={setQuery}
                setShouldAutoScroll={setIsNearBottom}
                handleStop={handleStop}
                isNearBottom={isNearBottom}
                setIsNearBottom={setIsNearBottom}
              />
            )}
          </div>
          {privateSession && (
            <div className="bg-purple-100 text-purple-800 text-center py-2 flex items-center justify-center">
              <span className="material-icons text-2xl mr-2">lock</span>
              You are in a Private Session (
              <button
                onClick={handlePrivateSessionChange}
                className="underline hover:text-purple-900"
              >
                end private session
              </button>
              )
            </div>
          )}
        </div>
      </Layout>
    </>
  );
}
