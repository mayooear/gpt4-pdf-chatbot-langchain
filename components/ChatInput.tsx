import React, { useRef, useState, useEffect } from 'react';
import styles from '@/styles/Home.module.css';
import LoadingDots from '@/components/ui/LoadingDots';
import RandomQueries from '@/components/RandomQueries';
import CollectionSelector from '@/components/CollectionSelector';

interface ChatInputProps {
  loading: boolean;
  handleSubmit: (e: React.FormEvent, query: string) => void;
  handleEnter: (e: React.KeyboardEvent<HTMLTextAreaElement>, query: string) => void;
  handleClick: (query: string) => void;
  handleCollectionChange: (newCollection: string) => void;
  handlePrivateSessionChange: (event: React.MouseEvent<HTMLButtonElement>) => void;
  collection: string;
  privateSession: boolean;
  error: string | null;
  randomQueries: string[];
  shuffleQueries: () => void;
  clearQuery: () => void;
  messageListRef: React.RefObject<HTMLDivElement>;
  textAreaRef: React.RefObject<HTMLTextAreaElement>;
  mediaTypes: { text: boolean; audio: boolean };
  handleMediaTypeChange: (type: 'text' | 'audio') => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  loading,
  handleSubmit,
  handleEnter,
  handleClick,
  handleCollectionChange,
  handlePrivateSessionChange,
  collection,
  privateSession,
  error,
  randomQueries,
  shuffleQueries,
  clearQuery,
  textAreaRef,
  messageListRef,
  mediaTypes,
  handleMediaTypeChange,
}) => {
  const [localQuery, setLocalQuery] = useState<string>('');
  const [isFirstQuery, setIsFirstQuery] = useState<boolean>(true);

  useEffect(() => {
    if (!loading) {
      setLocalQuery('');
      if (isFirstQuery) {
        setIsFirstQuery(false);
      }
    }
  }, [loading, isFirstQuery]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSubmit(e, localQuery);
  };

  const onEnter = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    handleEnter(e, localQuery);
  };

  return (
    <div className={`${styles.center} w-full`}>
      <div className="w-full">
        <form onSubmit={onSubmit}>
          <div className="flex items-center space-x-2 w-full">
            <textarea
              disabled={loading}
              onKeyDown={onEnter}
              onChange={(e) => {
                setLocalQuery(e.target.value);
                if (textAreaRef.current) {
                  textAreaRef.current.style.height = 'auto';
                  textAreaRef.current.style.height = `${e.target.scrollHeight}px`;
                }
              }}
              value={localQuery}
              ref={textAreaRef}
              autoFocus={false}
              rows={1}
              maxLength={3000}
              id="userInput"
              name="userInput"
              placeholder={
                loading
                  ? 'Waiting for response...'
                  : isFirstQuery
                  ? 'How can I think of God more?'
                  : ''
              }
              className={`${styles.textarea} w-full`}
              style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}
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
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mt-1 space-y-2 sm:space-y-0">
            <div className="w-full sm:w-1/2 sm:pr-2 order-2 sm:order-1">
              <RandomQueries
                queries={randomQueries}
                onQueryClick={(q) => {
                  setLocalQuery(q);
                  handleClick(q);
                }}
                isLoading={loading}
                shuffleQueries={shuffleQueries}
              />
            </div>

            <div className="w-full sm:w-1/2 sm:pl-2 order-1 sm:order-2">
              <div className="flex flex-col sm:items-end">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end space-y-2 sm:space-y-0 sm:space-x-4 w-full">
                  <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                    <button
                      type="button"
                      onClick={() => handleMediaTypeChange('text')}
                      className={`px-2.5 py-1.5 text-sm rounded w-full sm:w-auto ${
                        mediaTypes.text ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      Written
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMediaTypeChange('audio')}
                      className={`px-2.5 py-1.5 text-sm rounded w-full sm:w-auto ${
                        mediaTypes.audio ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      Spoken
                    </button>
                  </div>
                  <div className="sm:w-auto sm:min-w-[160px]">
                    <CollectionSelector onCollectionChange={handleCollectionChange} currentCollection={collection} />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handlePrivateSessionChange}
                  className={`${styles.privateButton} ${privateSession ? styles.buttonActive : ''} w-full sm:w-auto mt-2 sm:mt-1`}
                >
                  {privateSession ? 'Reload Page to End Private Session' : 'Start Private Session'}
                </button>
              </div>
            </div>
          </div>
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
              <strong className="font-bold">An error occurred: </strong>
              <span className="block sm:inline">{error}</span>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};