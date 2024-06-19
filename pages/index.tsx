import { useRef, useState, useEffect, useMemo } from 'react';
import Popup from '@/components/popup'; 
import usePopup from '@/hooks/usePopup';
import Link from 'next/link';
import Layout from '@/components/layout';
import styles from '@/styles/Home.module.css';
import { Message } from '@/types/chat';
import Image from 'next/image';
import { Fragment } from 'react';
import ReactMarkdown from 'react-markdown';
import gfm from 'remark-gfm';
import LoadingDots from '@/components/ui/LoadingDots';
import { Document } from 'langchain/document';
import ShareDialog from '@/components/ShareDialog';
import CopyButton from '@/components/CopyButton';
import SourcesList from '@/components/SourcesList';
import CollectionSelector from '@/components/CollectionSelector';
import { useRandomQueries } from '@/hooks/useRandomQueries';
import RandomQueries from '@/components/RandomQueries';
import Cookies from 'js-cookie';
import LikeButton from '@/components/LikeButton';
import { getOrCreateUUID } from '@/utils/client/uuid';

export default function Home() {
  const [isMaintenanceMode, setIsMaintenanceMode] = useState<boolean>(false); 
  const [collection, setCollection] = useState<string | undefined>('master_swami'); 
  const [collectionChanged, setCollectionChanged] = useState<boolean>(false);
  const [query, setQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [messageState, setMessageState] = useState<{
    messages: Message[];
    pending?: string;
    history: [string, string][];
    pendingSourceDocs?: Document[];
  }>({
    messages: [
      {
        message: 'Hi GuruBuddy! What would you like to learn about from the Ananda Library?',
        type: 'apiMessage',
      },
    ],
    history: [],
  });
  const [shareSuccess, setShareSuccess] = useState<Record<string, boolean>>({});
  const [likeStatuses, setLikeStatuses] = useState<Record<string, boolean>>({});
  const { messages, history } = messageState;

  const messageListRef = useRef<HTMLDivElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  // popup message for new users
  const { showPopup, closePopup, popupMessage } = 
    usePopup('1.02', 
    "Others can see questions you ask and answers given. " + 
     "Please click 'Start Private Session' below the text entry box if you would prefer we not log or publish your session."
    );

  const handleCollectionChange = (newCollection: string) => {
    if (newCollection !== collection) {
      setCollectionChanged(true); 
    }
    setCollection(newCollection);
    Cookies.set('selectedCollection', newCollection, { expires: 365 });
  };
  
  const collectionQueries = useMemo(() => ({
    whole_library: [
      "Give me three tips on improving meditation habits",
      "Can you tell me something about sanatan dharma?",
      "Was Moses a liberated master?",
      "How do i grow my connection to god?",
      "tips on dealing with a challenging coworker?",
      "Give 10 attitudes essential for discipleship",
      "Staying in the Spine: topic broken down into 4 parts",
      "Outline for a 1-day course on the purpose of life"
      ],
    master_swami: [
      "How does Swami say to prepare for hard times?",
      "Write an article on understanding very tough karma, mentioning things from Swamiji and Master",
      "Find me a prayer for Radiant Health and Well Being",
      "Inspiring Yogananda quotes",
      "What are some tips for dealing with insomnia?",
      "If God is doing everything through us, how does free will fit in?",
      "Explain the line in the festival of light that says, 'pain is the fruit of self love, whereas joy is the fruit of love for God.'",
        ],
  }), []);

  // Determine the queries for the current collection or use an empty array as a fallback
  const queriesForCollection = collection ? collectionQueries[collection as keyof typeof collectionQueries] || [] : [];

  // Always call useRandomQueries with the determined queries
  const randomQueries = useRandomQueries(queriesForCollection, 3);
  
  const queryRef = useRef<string>('');

  const handleLikeCountChange = (answerId: string, liked: boolean) => {
    setLikeStatuses(prevStatuses => ({
      ...prevStatuses,
      [answerId]: liked,
    }));
  };

  // private session stuff
  const [privateSession, setPrivateSession] = useState<boolean>(false);
  const handlePrivateSessionChange = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (privateSession) {
      // If already in a private session, reload the page
      window.location.reload();
    } else {
      // Start a private session
      setPrivateSession(true);
    }
  };
  const [votes, setVotes] = useState<Record<string, number>>({});
  const handleVote = async (docId: string, isUpvote: boolean) => {
    if (!docId) {
      console.error('Vote error: Missing document ID');
      return;
    }
    
    const currentVote = votes[docId] || 0;
    let vote: number;
  
    if ((isUpvote && currentVote === 1) || (!isUpvote && currentVote === -1)) {
      // If the current vote is the same as the new vote, it's a reversal
      vote = 0;
    } else {
      // Set the new vote
      vote = isUpvote ? 1 : -1;
    }
  
    // Update the local state to reflect the new vote
    setVotes((prevVotes) => {
      const updatedVotes = { ...prevVotes, [docId]: vote };
      return updatedVotes;
    });

    try {
      const response = await fetch('/api/vote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ docId, vote }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Vote error:', error);
    }
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
    setShareSuccess(prev => ({ ...prev, [messageId]: true }));
    setShowShareDialog(false); 
  };

  const handleCloseSuccessMessage = (messageId: string) => {
    setShareSuccess(prev => ({ ...prev, [messageId]: false }));
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
  
    setError(null);
  
    const question = queryRef.current.trim();

    if (!question) {
      alert('Please input a question');
      return;
    }
  
    setMessageState((state) => ({
      ...state,
      messages: [
        ...state.messages,
        {
          type: 'userMessage',
          message: question,
        },
      ],
    }));

    setLoading(true);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          collection,
          question,
          history,
          privateSession: privateSession,
        }),
      });
      const data = await response.json();

      if (data.error) {
        setError(data.error);
        console.log('ERROR: data error: ' + data.error);
      } else {
        setMessageState((state) => ({
          ...state,
          messages: [
            ...state.messages,
            {
              type: 'apiMessage',
              message: data.text,
              sourceDocs: data.sourceDocuments,
              docId: data.docId,
              collection: collection,
            },
          ],
          history: [...state.history, [question, data.text]],
        }));
        // Scroll to the top of the latest message
        setTimeout(() => {
          // Focus the text area after the message has been updated.
          // Check if the device is not mobile (e.g., width greater than 768px for iPad)
          if (window.innerWidth > 768) {
            textAreaRef.current?.focus();
          }
  
          // Set a slight delay to ensure focus change has completed
          setTimeout(() => {
            // Scroll to the latest message
            messageListRef.current?.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }, 10);
        });
      }
      if (textAreaRef.current) {
        textAreaRef.current.value = '';  // Clear the textarea
      }  

      setLoading(false);
    } catch (error) {
      setLoading(false);
      setError('An error occurred while fetching the data. Please try again.');
      console.log('error', error);
    }
  }

  const handleClick = (query: string) => {
    queryRef.current = query;
    if (textAreaRef.current) {
      textAreaRef.current.value = query;
    }
  };
    
  //prevent empty submissions
  const handleEnter = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (queryRef.current.trim()) {
        handleSubmit(e as unknown as React.FormEvent<HTMLFormElement>);
      }
    }
  };

  // Render the component only after the collection has been determined
  if (collection === undefined) {
    return <LoadingDots color="#000" />; 
  }  

  if (isMaintenanceMode) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-screen">
          <h1 className="text-3xl font-bold">
            This page is currently down for maintenance until approx. 12:30pm PT. 
          </h1>
          <p className="mt-4">
            You can still view the <Link href="/all" className="text-blue-500">All&nbsp;Answers</Link> page.
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <>
      {showPopup && <Popup message={popupMessage} onClose={closePopup} />}
      <Layout>
        <div className="w-3/4 mx-auto flex flex-col">
          <main className="flex flex-col justify-between items-center p-4">
            <div className={styles.cloud}>
              <div ref={messageListRef} className={styles.messagelist}>
                {messages.map((message, index) => {
                  let icon;
                  let className;
                  if (message.type === 'apiMessage') {
                    icon = (
                      <Image
                        key={index}
                        src="/bot-image.png"
                        alt="AI"
                        width="40"
                        height="40"
                        className={styles.boticon}
                        priority
                      />
                    );
                    className = styles.apimessage;
                  } else {
                    icon = (
                      <Image
                        key={index}
                        src="/usericon.png"
                        alt="Me"
                        width="30"
                        height="30"
                        className={styles.usericon}
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
                      {message.type === 'apiMessage' && index > 0 && <hr />}
                      <div key={`chatMessage-${index}`} className={className}>
                        {icon}
                        <div className="markdownanswer">
                          {message.sourceDocs && (
                            <SourcesList 
                              sources={message.sourceDocs} 
                              useAccordion={false} 
                              collectionName={collectionChanged ? message.collection : undefined}
                            />
                          )}
                          <ReactMarkdown remarkPlugins={[gfm]} linkTarget="_blank"> 
                            {message.message.replace(/\n/g, '  \n').replace(/\n\n/g, '\n\n')}
                          </ReactMarkdown>
                        </div>
                      </div>
                      <div className="text-left" style={{ backgroundColor: '#f9fafb' }}>
                          <div className="text-left ml-[75px]">
                          {message.docId && (
                            <div className="flex space-x-2">
                              <CopyButton markdown={message.message} />
                              <LikeButton
                                answerId={message.docId as string}
                                initialLiked={likeStatuses[message.docId] || false}
                                likeCount={0}
                                onLikeCountChange={(answerId, newLikeCount) => handleLikeCountChange(answerId, newLikeCount > 0)}
                                showLikeCount={false} 
                                />
                              <button
                                onClick={() => handleVote(message.docId as string, false)}
                                className={`${styles.voteButton} ${votes[message.docId] === -1 ? styles.voteButtonDownActive : ''} hover:bg-gray-200`}
                                title="Downvote for system training"
                              >
                                <span className="material-icons text-black">
                                  {votes[message.docId] === -1 ? 'thumb_down' : 'thumb_down_off_alt'}
                                </span>
                              </button>
                              {/* {!privateSession && (
                                <button
                                  onClick={() => handleShareClick(message.message, message.docId as string)}
                                  className="shareButton hover:bg-gray-200"
                                  title="Share"
                                >
                                  <span className="material-icons"> share </span>
                                </button>
                              )} */}
                              {shareSuccess[message.docId] && (
                                <div className={styles.successMessage} style={{ position: 'relative', paddingLeft: '20px' }}>
                                  <p>Answer shared. <Link legacyBehavior href="/shared" passHref><a style={{ color: 'blue', textDecoration: 'underline' }}>See it here.</a></Link></p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </Fragment>
                  );
                })}
              </div>
            </div>
            <div className={styles.center}>
              {/* <div className={styles.cloudform}> */}
              <div className="flex flex-col md:flex-row items-stretch space-y-4 md:space-y-0 md:space-x-4">
                <form onSubmit={handleSubmit}>
                  <div className="flex items-center space-x-2">
                    <textarea
                      disabled={loading}
                      onKeyDown={handleEnter}
                      onChange={(e) => queryRef.current = e.target.value}
                      ref={textAreaRef}
                      autoFocus={false}
                      rows={1}
                      maxLength={3000}
                      id="userInput"
                      name="userInput"
                      placeholder={
                        loading
                          ? 'Waiting for response...'
                          : 'How can I think of God more?'
                      }
                      className={styles.textarea}
                    />
                    <button
                      type="submit"
                      disabled={loading}
                      className={styles.generatebutton}
                    >
                      {loading ? (
                        <div className={styles.loadingwheel}>
                          <LoadingDots color="#000" />
                        </div>
                      ) : (
                        // Send icon SVG in input field
                        <svg
                          viewBox="0 0 20 20"
                          className={styles.svgicon}
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"></path>
                        </svg>
                      )}
                    </button>     
                  </div>       
                  {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
                      <strong className="font-bold">An error occurred: </strong>
                      <span className="block sm:inline">{error}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-start mt-1">
                    <div className="flex justify-between items-start mt-1">
                      <div className="w-1/2">
                        <RandomQueries queries={randomQueries} onQueryClick={handleClick} isLoading={loading} />
                      </div>
                      <div className="flex flex-col items-end w-1/2">
                        <CollectionSelector onCollectionChange={handleCollectionChange} currentCollection={collection} />
                        <button
                          type="button"
                          onClick={handlePrivateSessionChange}
                          className={`${styles.privateButton} ${privateSession ? styles.buttonActive : ''}`}
                        >
                          {privateSession ? 'Reload Page to End Private Session' : 'Start Private Session'}
                        </button>
                      </div>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </main>
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
