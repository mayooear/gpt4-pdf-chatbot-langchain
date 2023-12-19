import { useRef, useState, useEffect } from 'react';
import Layout from '@/components/layout';
import styles from '@/styles/Home.module.css';
import { Message } from '@/types/chat';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import LoadingDots from '@/components/ui/LoadingDots';
import { Document } from 'langchain/document';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

export default function Home() {
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

  const { messages, history } = messageState;

  const messageListRef = useRef<HTMLDivElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const queries = [
    "Give me three tips on improving meditation habits",
    "How does Swami say to prepare for hard times?",
    "Write an article on understanding very tough karma, mentioning things from Swamiji and Master",
    "What did Yogananda say about the influence of television?",
    "Tell me in detail about the quote 'And what do you think made me a master?'",
    "What are some key lessons from essence of the Bhagavad Gita?",
    "Can you tell me something about sanatan dharma?",
    "Outline of how the chakras are part of meditation",
    "How do i grow my connection to god?",
    "tips on dealing with a challenging coworker?",
    "write an article about compassion towards family at holiday events",
    "Is there a painless way to transcend ego, and if so, what is that way?"
  ];

  const getRandomQueries = () => {
    const shuffled = queries.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 3);
  };

  // Initialize randomQueries with an empty array
  const [randomQueries, setRandomQueries] = useState<string[]>([]);

  const queryRef = useRef<string>('');

  // This effect will only run on the client after the component has mounted
  useEffect(() => {
    // Now setting the random queries in the useEffect to ensure it's only done client-side
    setRandomQueries(getRandomQueries());

    // Focus the text area only on the client side after the component has mounted
    textAreaRef.current?.focus();
  }, []);

  useEffect(() => {
    textAreaRef.current?.focus();
  }, []);

  useEffect(() => {
    console.log("after update: loading = " + loading);
  }, [loading]);
  
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
          question,
          history,
        }),
      });
      const data = await response.json();
      console.log('data', data);

      if (data.error) {
        setError(data.error);
      } else {
        setMessageState((state) => ({
          ...state,
          messages: [
            ...state.messages,
            {
              type: 'apiMessage',
              message: data.text,
              sourceDocs: data.sourceDocuments,
            },
          ],
          history: [...state.history, [question, data.text]],
        }));
        // Scroll to the top of the latest message
        setTimeout(() => {
          messageListRef.current?.lastElementChild?.scrollIntoView({ block: 'start', behavior: 'smooth' });
        }, 0);
      }
      if (textAreaRef.current) {
        textAreaRef.current.value = '';  // Clear the textarea
      }  
      console.log('messageState', messageState);

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
  
    // Introduce a slight delay
    setTimeout(() => {
      handleSubmit({ preventDefault: () => {} } as React.FormEvent<HTMLFormElement>);
    }, 0);
  };
    
  //prevent empty submissions
  const handleEnter = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (queryRef.current.trim()) {
        handleSubmit(e as unknown as React.FormEvent<HTMLFormElement>);
      }
    }
  };

  return (
    <>
      <Layout>
        <div className="mx-auto flex flex-col gap-4">
          <h1 className="text-2xl font-bold leading-[1.1] tracking-tighter text-center">
            Chat With the Ananda Librarian!
          </h1>
          <div className="flex flex-col items-center">
            {randomQueries.map((query, index) => (
              <button
                key={index}
                className="text-blue-500 hover:underline mb-2"
                onClick={() => handleClick(query)}
              >
                {query}
              </button>
            ))}
          </div>
          <main className={styles.main}>
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
                    <>
                      <div key={`chatMessage-${index}`} className={className}>
                        {icon}
                        <div className={styles.markdownanswer}>
                          <ReactMarkdown linkTarget="_blank">
                            {message.message}
                          </ReactMarkdown>
                        </div>
                      </div>
                      {message.sourceDocs && (
                        <div
                          className="p-5"
                          key={`sourceDocsAccordion-${index}`}
                        >
                          <Accordion
                            type="single"
                            collapsible
                            className="flex-col"
                          >
                            {message.sourceDocs.map((doc, index) => (
                              <div key={`messageSourceDocs-${index}`}>
                                <AccordionItem value={`item-${index}`}>
                                  <AccordionTrigger>
                                    <h3>Source {index + 1}</h3>
                                  </AccordionTrigger>
                                  <AccordionContent>
                                    <ReactMarkdown linkTarget="_blank">
                                      {doc.pageContent}
                                    </ReactMarkdown>
                                    <p className="mt-2">
                                      <b>Source:</b> {doc.metadata.source.startsWith('http') ? (
                                        <a href={doc.metadata.source} target="_blank" rel="noopener noreferrer">
                                          {doc.metadata.source}
                                        </a>
                                    ) : (
                                        doc.metadata.source
                                    )}
                                    </p>
                                  </AccordionContent>
                                </AccordionItem>
                              </div>
                            ))}
                          </Accordion>
                        </div>
                      )}
                    </>
                  );
                })}
              </div>
            </div>
            <div className={styles.center}>
              <div className={styles.cloudform}>
                <form onSubmit={handleSubmit}>
                  <textarea
                    disabled={loading}
                    onKeyDown={handleEnter}
                    onChange={(e) => queryRef.current = e.target.value}
                    ref={textAreaRef}
                    autoFocus={false}
                    rows={1}
                    maxLength={512}
                    id="userInput"
                    name="userInput"
                    placeholder={
                      loading
                        ? 'Waiting for response...'
                        : 'How do I remember God more frequently?'
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
                </form>
              </div>
            </div>
            {error && (
              <div className="border border-red-400 rounded-md p-4">
                <p className="text-red-500">{error}</p>
              </div>
            )}
          </main>
        </div>
        <footer className="m-auto p-4">
          <a href="mailto:mowliv@gmail.com" target="_blank" rel="noopener noreferrer">Send feedback</a> | <a href="https://www.notion.so/anandafamily/AI-Chatbot-for-Ananda-Library-2854018444104a4cad80bf05eb4f23cb?pvs=4" target="_blank" rel="noopener noreferrer">Project info (Ananda Wiki)</a> 
          <br></br>Powered by LangChainAI and gpt4-pdf-chatbot-langchain open source projects.
        </footer>
      </Layout>
    </>
  );
}
