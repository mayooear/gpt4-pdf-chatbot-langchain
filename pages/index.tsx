// React and Next.js imports
import { useRef, useState, useEffect, useMemo, Fragment } from 'react';
import { GetServerSideProps } from 'next';
import Link from 'next/link';
import Image from 'next/image';

// Component imports
import Layout from '@/components/layout';
import Popup from '@/components/popup';
import LoadingDots from '@/components/ui/LoadingDots';
import ShareDialog from '@/components/ShareDialog';
import CopyButton from '@/components/CopyButton';
import SourcesList from '@/components/SourcesList';
import LikeButton from '@/components/LikeButton';
import LikePrompt from '@/components/LikePrompt';
import { ChatInput } from '@/components/ChatInput';

// Hook imports
import usePopup from '@/hooks/usePopup';
import { useRandomQueries } from '@/hooks/useRandomQueries';
import { useChat } from '@/hooks/useChat';

// Utility imports
import { logEvent } from '@/utils/client/analytics';
import { getCollectionQueries } from '@/utils/client/collectionQueries';
import { handleVote as handleVoteUtil } from '@/utils/client/voteHandler';
import { loadSiteConfig } from '@/utils/server/loadSiteConfig';
import { SiteConfig } from '@/types/siteConfig';
import {
  getCollectionsConfig,
  getEnableMediaTypeSelection,
  getEnableAuthorSelection,
} from '@/utils/client/siteConfig';

// Third-party library imports
import ReactMarkdown from 'react-markdown';
import gfm from 'remark-gfm';
import Cookies from 'js-cookie';

// Styles
import styles from '@/styles/Home.module.css';

export default function Home({
  siteConfig,
  error,
}: {
  siteConfig: SiteConfig | null;
  error?: string;
}) {
  const [isMaintenanceMode, setIsMaintenanceMode] = useState<boolean>(false);
  const [collection, setCollection] = useState<string>(() => {
    if (getEnableAuthorSelection(siteConfig)) {
      const collections = getCollectionsConfig(siteConfig);
      return Object.keys(collections)[0] || '';
    }
    return '';
  });
  const [collectionChanged, setCollectionChanged] = useState<boolean>(false);
  const [query, setQuery] = useState<string>('');
  const [shareSuccess, setShareSuccess] = useState<Record<string, boolean>>({});
  const [likeStatuses, setLikeStatuses] = useState<Record<string, boolean>>({});
  const [privateSession, setPrivateSession] = useState<boolean>(false);
  const [mediaTypes, setMediaTypes] = useState<{
    text: boolean;
    audio: boolean;
    youtube: boolean;
  }>({ text: true, audio: true, youtube: true });
  const {
    messageState,
    loading,
    error: chatError,
    handleSubmit,
  } = useChat(collection, [], privateSession, mediaTypes, siteConfig);
  const { messages, history } = messageState;
  const [showLikePrompt, setShowLikePrompt] = useState<boolean>(false);
  const [linkCopied, setLinkCopied] = useState<string | null>(null);
  const [answerCount, setAnswerCount] = useState(0);
  const [isControlsMenuOpen, setIsControlsMenuOpen] = useState<boolean>(false);

  const lastMessageRef = useRef<HTMLDivElement>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const handleMediaTypeChange = (type: 'text' | 'audio' | 'youtube') => {
    if (getEnableMediaTypeSelection(siteConfig)) {
      setMediaTypes((prev) => ({ ...prev, [type]: !prev[type] }));
    }
  };

  // popup message for new users
  const { showPopup, closePopup, popupMessage } = usePopup(
    '1.02',
    'Others can see questions you ask and answers given. ' +
      "Please click 'Start Private Session' below the text entry box if you would prefer we not log or publish your session.",
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

  const handleClick = (query: string) => {
    setQuery(query);
  };

  useEffect(() => {
    let isMounted = true;
    async function fetchQueries() {
      const queries = await getCollectionQueries();
      if (isMounted) {
        setCollectionQueries(queries);
      }
    }
    fetchQueries();
    return () => {
      isMounted = false;
    };
  }, []); // Empty dependency array

  // Determine the queries for the current collection or use an empty array as a fallback
  const queriesForCollection = useMemo(() => {
    return collection
      ? collectionQueries[collection as keyof typeof collectionQueries] || []
      : [];
  }, [collection, collectionQueries]);

  // Use the memoized queries
  const { randomQueries, shuffleQueries } = useRandomQueries(
    queriesForCollection,
    3,
  );
  const queryRef = useRef<string>('');

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

  // Share dialog
  // As of 5/30/24 this is disabled. The button has been removed, but all the code is still here in case we want to
  // revive the share page later
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [currentMarkdownAnswer, setCurrentMarkdownAnswer] = useState('');
  const [currentAnswerId, setCurrentAnswerId] = useState('');
  const handleShareClick = (markdownAnswer: string, answerId: string) => {
    setCurrentMarkdownAnswer(markdownAnswer);
    setCurrentAnswerId(answerId);
    setShowShareDialog(true);
  };

  const handleShareSuccess = (messageId: string) => {
    setShareSuccess((prev) => ({ ...prev, [messageId]: true }));
    setShowShareDialog(false);
  };

  const handleCloseSuccessMessage = (messageId: string) => {
    setShareSuccess((prev) => ({ ...prev, [messageId]: false }));
  };

  useEffect(() => {
    // Retrieve and set the collection from the cookie
    const savedCollection = Cookies.get('selectedCollection') || 'master_swami';
    setCollection(savedCollection);

    // Focus the text area only on the client side after the component has mounted.
    // Check if the device is not mobile (e.g., width greater than 768px for iPad)
    if (window.innerWidth > 768) {
      textAreaRef.current?.focus();
    }
  }, []);

  const handleEnter = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    query: string,
  ) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (query.trim()) {
        handleSubmit(e as unknown as React.FormEvent, query);
      }
    }
  };

  const clearQuery = () => {
    setQuery('');
  };

  // Add this effect to scroll when messages change
  useEffect(() => {
    if (lastMessageRef.current && messageListRef.current) {
      const lastMessage = lastMessageRef.current;
      const messageList = messageListRef.current;
      const rect = lastMessage.getBoundingClientRect();

      const scrollTop = messageList.scrollTop;
      const clientHeight = messageList.clientHeight;

      if (rect.top > clientHeight - 100) {
        messageList.scrollTo({
          top: scrollTop + rect.top - clientHeight + 100,
          behavior: 'smooth',
        });
      } else {
        // For mobile, scroll a bit more smoothly
        const isMobile = window.innerWidth <= 768;
        if (isMobile) {
          messageList.scrollTo({
            top: scrollTop + rect.top - clientHeight + 50,
            behavior: 'smooth',
          });
        } else {
          lastMessage.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
      }
    }
  }, [messages]);

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (!siteConfig) {
    return <div>Loading...</div>;
  }

  if (isMaintenanceMode) {
    return (
      <Layout>
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
      {showPopup && <Popup message={popupMessage} onClose={closePopup} />}
      <Layout>
        <LikePrompt show={showLikePrompt} />
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
          <div className="flex-grow overflow-hidden">
            <div ref={messageListRef} className="h-full overflow-y-auto">
              {messages.map((message, index) => {
                let icon;
                let className;
                if (message.type === 'apiMessage') {
                  icon = (
                    <Image
                      src="/bot-image.png"
                      alt="AI"
                      width={40}
                      height={40}
                      className="rounded-sm"
                      priority
                    />
                  );
                  className = 'bg-gray-50';
                } else {
                  icon = (
                    <Image
                      src="/usericon.png"
                      alt="Me"
                      width={30}
                      height={30}
                      className="rounded-sm"
                      priority
                    />
                  );
                  // The latest message sent by the user will be animated while waiting for a response
                  className =
                    loading && index === messages.length - 1
                      ? styles.usermessagewaiting
                      : styles.usermessage;
                }
                return (
                  <Fragment key={`message-${index}`}>
                    {message.type === 'apiMessage' && index > 0 && (
                      <hr className="border-t border-gray-200 mb-0" />
                    )}
                    <div
                      key={`chatMessage-${index}`}
                      className={`${className} p-2 px-3`}
                      ref={
                        index === messages.length - 1 ? lastMessageRef : null
                      }
                    >
                      <div className="flex items-start">
                        <div className="flex-shrink-0 mr-2">{icon}</div>
                        <div className="flex-grow">
                          <div className="max-w-none">
                            {message.sourceDocs && (
                              <div className="mb-2">
                                <SourcesList
                                  sources={message.sourceDocs}
                                  collectionName={
                                    collectionChanged
                                      ? message.collection
                                      : undefined
                                  }
                                />
                              </div>
                            )}
                            <ReactMarkdown
                              remarkPlugins={[gfm]}
                              linkTarget="_blank"
                              className="mt-1"
                            >
                              {message.message
                                .replace(/\n/g, '  \n')
                                .replace(/\n\n/g, '\n\n')}
                            </ReactMarkdown>
                          </div>
                          {/* Action icons container */}
                          <div className="mt-2 flex items-center space-x-2">
                            {message.type === 'apiMessage' && index !== 0 && (
                              <>
                                <CopyButton
                                  markdown={message.message}
                                  answerId={message.docId ?? ''}
                                  sources={message.sourceDocs}
                                  question={messages[index - 1].message}
                                />
                              </>
                            )}
                            {!privateSession &&
                              message.type === 'apiMessage' &&
                              message.docId && (
                                <>
                                  <button
                                    onClick={() =>
                                      handleCopyLink(message.docId ?? '')
                                    }
                                    className="text-black-600 hover:underline flex items-center"
                                    title="Copy link to clipboard"
                                  >
                                    <span className="material-icons">
                                      {linkCopied === message.docId
                                        ? 'check'
                                        : 'link'}
                                    </span>
                                  </button>
                                  <LikeButton
                                    answerId={message.docId ?? ''}
                                    initialLiked={
                                      likeStatuses[message.docId ?? ''] || false
                                    }
                                    likeCount={0}
                                    onLikeCountChange={(
                                      answerId,
                                      newLikeCount,
                                    ) =>
                                      handleLikeCountChange(
                                        answerId,
                                        newLikeCount > 0,
                                      )
                                    }
                                    showLikeCount={false}
                                  />
                                  <button
                                    onClick={() =>
                                      handleVote(message.docId ?? '', false)
                                    }
                                    className={`${styles.voteButton} ${
                                      votes[message.docId ?? ''] === -1
                                        ? styles.voteButtonDownActive
                                        : ''
                                    } hover:bg-gray-200 flex items-center`}
                                    title="Downvote (private) for system training"
                                  >
                                    <span className="material-icons text-black">
                                      {votes[message.docId ?? ''] === -1
                                        ? 'thumb_down'
                                        : 'thumb_down_off_alt'}
                                    </span>
                                  </button>
                                </>
                              )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </Fragment>
                );
              })}
            </div>
          </div>
          <div className="mt-4 px-2 md:px-0">
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
              privateSession={privateSession}
              clearQuery={clearQuery}
              messageListRef={messageListRef}
              textAreaRef={textAreaRef}
              mediaTypes={mediaTypes}
              handleMediaTypeChange={handleMediaTypeChange}
              isControlsMenuOpen={isControlsMenuOpen}
              setIsControlsMenuOpen={setIsControlsMenuOpen}
              siteConfig={siteConfig}
            />
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
        {showShareDialog && (
          <div className={styles.shareDialogBackdrop}>
            <ShareDialog
              markdownAnswer={currentMarkdownAnswer}
              answerId={currentAnswerId}
              onClose={() => setShowShareDialog(false)}
              onShareSuccess={() => handleShareSuccess(currentAnswerId)}
            />
          </div>
        )}
      </Layout>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const siteId = process.env.SITE_ID || 'default';

  try {
    const siteConfig = await loadSiteConfig(siteId);

    if (!siteConfig) {
      throw new Error(`Configuration not found for site ID: ${siteId}`);
    }

    return {
      props: {
        siteConfig,
      },
    };
  } catch (error) {
    console.error('Error loading site config:', error);
    return {
      props: {
        siteConfig: null,
        error:
          'Failed to load site configuration. Please notify an administrator.',
      },
    };
  }
};
