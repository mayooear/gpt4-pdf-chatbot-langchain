import { useRef, useState, useEffect } from 'react';
import Layout from '@/components/layout';
import styles from '@/styles/Home.module.css';
import { Message, MessageType } from '@/types/chat';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import LoadingDots from '@/components/ui/LoadingDots';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

import { Answer, Chat, Ressource } from 'polyfact';

export const QA_PROMPT = `You are a helpful AI assistant. Use the following pieces of context to answer the question at the end.
If you don't know the answer, just say you don't know. DO NOT try to make up an answer.
If the question is not related to the context, politely respond that you are tuned to only answer questions that are related to the context.
{context}
Question: {question}
Helpful answer in markdown:`;

export default function Home() {
  const [query, setQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [messageState, setMessageState] = useState<{
    messages: Message[];
    history: [string, string][];
  }>({
    messages: [
      {
        message: 'Hi, what would you like to learn about this document?',
        type: 'apiMessage',
      },
    ],
    history: [],
  });

  const { messages, history } = messageState;

  const messageStateRef = useRef(messageState);

  useEffect(() => {
    messageStateRef.current = messageState;
    messageListRef.current?.scrollTo(0, messageListRef.current.scrollHeight);
  }, [messageState]);

  const messageListRef = useRef<HTMLDivElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const chat = useRef<Chat>(
    new Chat({ systemPrompt: QA_PROMPT }, { token: '<Your token>' }),
  );

  useEffect(() => {
    textAreaRef.current?.focus();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!query) return alert('Please input a question');

    addMessage('userMessage', query.trim());
    setLoading(true);
    setQuery('');

    try {
      const answer = chat.current.sendMessageStreamWithInfos(query.trim(), {
        memoryId: '<your memory id>',
      });
      answer.on('data', handleData);
      answer.on('infos', (infos) => handleInfos(infos, query.trim()));
      answer.on('end', () => setLoading(false));
    } catch (error) {
      setLoading(false);
      setError('An error occurred. Please try again.');
      console.log('error', error);
    }
  }

  function addMessage(
    type: MessageType,
    message: string,
    sourceDocs: Ressource[] = [],
  ) {
    setMessageState((state) => ({
      ...state,
      messages: [...state.messages, { type, message, sourceDocs }],
    }));
  }

  function handleData(data: any) {
    const currentMessages = [...messageStateRef.current.messages];
    const lastMsg = currentMessages[currentMessages.length - 1];

    if (lastMsg?.type === 'userMessage') {
      currentMessages.push({
        type: 'apiMessage',
        message: data.toString(),
        sourceDocs: [],
      });
    } else if (lastMsg?.type === 'apiMessage') {
      lastMsg.message += data.toString();
    }

    setMessageState({ ...messageStateRef.current, messages: currentMessages });
  }

  function handleInfos(infos: Answer, question: string) {
    setMessageState((state) => {
      const messages = [...state.messages];
      const lastMsg = messages[messages.length - 1];
      if (lastMsg) lastMsg.sourceDocs = infos?.ressources || [];
      return {
        ...state,
        messages,
        history: [...state.history, [question, infos.result]],
      };
    });
    messageListRef.current?.scrollTo(0, messageListRef.current.scrollHeight);
  }

  const handleEnter = (e: any) => {
    if (e.key === 'Enter' && query) {
      handleSubmit(e);
    } else if (e.key == 'Enter') {
      e.preventDefault();
    }
  };

  return (
    <>
      <Layout>
        <div className="mx-auto flex flex-col gap-4">
          <h1 className="text-2xl font-bold leading-[1.1] tracking-tighter text-center">
            Chat With Your Docs
          </h1>
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
                            {message.sourceDocs.map((doc, index) => {
                              const parsed = JSON.parse(doc.content);
                              return (
                                <div key={`messageSourceDocs-${doc.id}`}>
                                  <AccordionItem value={`item-${index}`}>
                                    <AccordionTrigger>
                                      <h4>
                                        <b>Source:</b> {parsed.filename} / page{' '}
                                        {parsed.page}
                                      </h4>
                                    </AccordionTrigger>
                                    <AccordionContent>
                                      <ReactMarkdown linkTarget="_blank">
                                        {parsed.content}
                                      </ReactMarkdown>
                                    </AccordionContent>
                                  </AccordionItem>
                                </div>
                              );
                            })}
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
                    ref={textAreaRef}
                    autoFocus={false}
                    rows={1}
                    maxLength={512}
                    id="userInput"
                    name="userInput"
                    placeholder={
                      loading
                        ? 'Waiting for response...'
                        : 'What is this legal case about?'
                    }
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
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
          <a href="https://twitter.com/mayowaoshin">
            Powered by LangChainAI. Demo built by Mayo (Twitter: @mayowaoshin).
          </a>
        </footer>
      </Layout>
    </>
  );
}
