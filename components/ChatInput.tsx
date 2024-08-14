import React, { useRef, useState, useEffect } from 'react';
import styles from '@/styles/Home.module.css';
import LoadingDots from '@/components/ui/LoadingDots';
import RandomQueries from '@/components/RandomQueries';
import CollectionSelector from '@/components/CollectionSelector';

interface ChatInputProps {
  loading: boolean;
  handleSubmit: (e: React.FormEvent, query: string) => void;
  handleEnter: (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    query: string,
  ) => void;
  handleClick: (query: string) => void;
  handleCollectionChange: (newCollection: string) => void;
  handlePrivateSessionChange: (
    event: React.MouseEvent<HTMLButtonElement>,
  ) => void;
  collection: string;
  privateSession: boolean;
  error: string | null;
  randomQueries: string[];
  shuffleQueries: () => void;
  clearQuery: () => void;
  messageListRef: React.RefObject<HTMLDivElement>;
  textAreaRef: React.RefObject<HTMLTextAreaElement>;
  mediaTypes: { text: boolean; audio: boolean; youtube: boolean };
  handleMediaTypeChange: (type: 'text' | 'audio' | 'youtube') => void;
  isControlsMenuOpen: boolean;
  setIsControlsMenuOpen: (isOpen: boolean) => void;
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
  isControlsMenuOpen,
  setIsControlsMenuOpen,
}) => {
  const [localQuery, setLocalQuery] = useState<string>('');
  const [isFirstQuery, setIsFirstQuery] = useState<boolean>(true);
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    handleResize(); // Set initial value
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    if (!loading) {
      setLocalQuery('');
      if (textAreaRef.current) {
        textAreaRef.current.style.height = 'auto';
      }
      if (isFirstQuery) {
        setIsFirstQuery(false);
      }
    }
  }, [loading, isFirstQuery, textAreaRef]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSubmit(e, localQuery);
  };

  const onEnter = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    handleEnter(e, localQuery);
  };

  return (
    <div className={`${styles.center} w-full mt-4 px-2 md:px-0`}>
      <div className="w-full">
        <form onSubmit={onSubmit}>
          <div className="flex items-center space-x-2">
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
              className="flex-grow p-2 border border-gray-300 rounded-md resize-none focus:outline-none"
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-500 text-white p-2 rounded-full flex-shrink-0 w-10 h-10 flex items-center justify-center"
            >
              {loading ? (
                <LoadingDots color="#fff" style="small" />
              ) : (
                <span className="material-icons text-xl leading-none">
                  send
                </span>
              )}
            </button>
          </div>
          <button
            type="button"
            onClick={() => setIsControlsMenuOpen(!isControlsMenuOpen)}
            className="w-full text-left text-sm text-blue-600 mt-2 sm:hidden"
          >
            {isControlsMenuOpen ? 'Hide options' : 'Show options'}
          </button>
          <div className="mt-2 flex flex-col sm:flex-row sm:justify-between sm:items-start space-y-2 sm:space-y-0">
            <div className="w-full sm:w-1/2 sm:pr-2 order-2 sm:order-1">
              <RandomQueries
                queries={randomQueries}
                onQueryClick={(q) => {
                  setLocalQuery(q);
                  handleClick(q);
                }}
                isLoading={loading}
                shuffleQueries={shuffleQueries}
                isMobile={isMobile}
              />
            </div>
            {(isControlsMenuOpen || !isMobile) && (
              <div className="w-full sm:w-1/2 sm:pl-2 order-1 sm:order-2">
                <div className="flex flex-col sm:items-end">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end space-y-2 sm:space-y-0 sm:space-x-4 w-full">
                    <div className="flex space-x-2">
                      <button
                        type="button"
                        onClick={() => handleMediaTypeChange('text')}
                        className={`px-2 py-1 text-xs sm:text-sm rounded w-1/2 sm:w-auto ${
                          mediaTypes.text
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-200 text-gray-700'
                        }`}
                      >
                        Writings
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMediaTypeChange('audio')}
                        className={`px-2 py-1 text-xs sm:text-sm rounded w-1/2 sm:w-auto ${
                          mediaTypes.audio
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-200 text-gray-700'
                        }`}
                      >
                        Audio
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMediaTypeChange('youtube')}
                        className={`px-2 py-1 text-xs sm:text-sm rounded w-1/2 sm:w-auto ${
                          mediaTypes.youtube
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-200 text-gray-700'
                        }`}
                      >
                        Video
                      </button>
                    </div>
                    <div className="sm:w-auto sm:min-w-[160px]">
                      <CollectionSelector
                        onCollectionChange={handleCollectionChange}
                        currentCollection={collection}
                      />
                    </div>
                  </div>
                  {!privateSession && (
                    <button
                      type="button"
                      onClick={handlePrivateSessionChange}
                      className="mt-2 px-2 py-1 text-xs sm:text-sm rounded w-1/2 sm:w-auto bg-purple-100 text-purple-800"
                    >
                      <span className="material-icons text-sm mr-1 align-middle">
                        lock
                      </span>
                      <span className="align-middle">
                        Start Private Session
                      </span>
                    </button>
                  )}
                </div>
              </div>
            )}
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
