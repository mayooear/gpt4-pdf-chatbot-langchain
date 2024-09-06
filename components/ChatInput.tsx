import React, { useState, useEffect } from 'react';
import styles from '@/styles/Home.module.css';
import LoadingDots from '@/components/ui/LoadingDots';
import RandomQueries from '@/components/RandomQueries';
import CollectionSelector from '@/components/CollectionSelector';
import { SiteConfig } from '@/types/siteConfig';
import {
  getEnableSuggestedQueries,
  getEnableMediaTypeSelection,
  getEnableAuthorSelection,
} from '@/utils/client/siteConfig';
import { useLocalStorage } from '@/hooks/useLocalStorage';

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
  textAreaRef: React.RefObject<HTMLTextAreaElement>;
  mediaTypes: { text: boolean; audio: boolean; youtube: boolean };
  handleMediaTypeChange: (type: 'text' | 'audio' | 'youtube') => void;
  siteConfig: SiteConfig | null;
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
  textAreaRef,
  mediaTypes,
  handleMediaTypeChange,
  siteConfig,
}) => {
  const [localQuery, setLocalQuery] = useState<string>('');
  const [hasInteracted, setHasInteracted] = useState<boolean>(false);
  const [isFirstQuery, setIsFirstQuery] = useState<boolean>(true);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [showOptions, setShowOptions] = useState(false);
  const [visitCount, setVisitCount] = useLocalStorage('visitCount', 0);
  const [suggestionsExpanded, setSuggestionsExpanded] = useState(false);

  useEffect(() => {
    setVisitCount((prevCount: number) => prevCount + 1);
    setSuggestionsExpanded(visitCount < 3);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!loading && hasInteracted) {
      setLocalQuery('');
      if (textAreaRef.current) {
        textAreaRef.current.style.height = 'auto';
      }
    }
  }, [loading, hasInteracted, textAreaRef]);

  useEffect(() => {
    const handleResize = () => {
      const newIsMobile = window.innerWidth < 768;
      setIsMobile(newIsMobile);
      if (!newIsMobile) {
        setShowOptions(true);
      }
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
  useEffect(() => {
    setVisitCount((prevCount: number) => prevCount + 1);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setHasInteracted(true);
    handleSubmit(e, localQuery);
  };

  const onEnter = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    setHasInteracted(true);
    handleEnter(e, localQuery);
  };

  const showSuggestedQueries = getEnableSuggestedQueries(siteConfig);
  const showMediaTypeSelection = getEnableMediaTypeSelection(siteConfig);
  const showAuthorSelection = getEnableAuthorSelection(siteConfig);

  const toggleSuggestions = (e: React.MouseEvent) => {
    e.preventDefault();
    setSuggestionsExpanded(!suggestionsExpanded);
  };

  return (
    <div className={`${styles.center} w-full mt-4 px-2 md:px-0`}>
      <div className="w-full">
        <form onSubmit={onSubmit}>
          <div className="flex items-center space-x-2 mb-4">
            <textarea
              disabled={loading}
              onKeyDown={onEnter}
              onChange={(e) => {
                setLocalQuery(e.target.value);
                setHasInteracted(true);
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
                  : hasInteracted
                    ? ''
                    : 'How can I think of God more?'
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

          {isMobile && (
            <div className="mb-4">
              <button
                type="button"
                onClick={() => setShowOptions(!showOptions)}
                className="text-blue-500 hover:underline mb-2"
              >
                {showOptions ? 'Hide options' : 'Show options'}
              </button>
            </div>
          )}

          {(!isMobile || showOptions) && (
            <div className="flex flex-wrap gap-2 mb-2">
              {showMediaTypeSelection && (
                <>
                  <button
                    type="button"
                    onClick={() => handleMediaTypeChange('text')}
                    className={`px-2 py-1 text-xs sm:text-sm rounded ${
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
                    className={`px-2 py-1 text-xs sm:text-sm rounded ${
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
                    className={`px-2 py-1 text-xs sm:text-sm rounded ${
                      mediaTypes.youtube
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    Video
                  </button>
                </>
              )}
              {showAuthorSelection && (
                <div className="flex-grow sm:flex-grow-0 sm:min-w-[160px]">
                  <CollectionSelector
                    onCollectionChange={handleCollectionChange}
                    currentCollection={collection}
                  />
                </div>
              )}
              {!privateSession && (
                <button
                  type="button"
                  onClick={handlePrivateSessionChange}
                  className="px-2 py-1 text-xs sm:text-sm rounded bg-purple-100 text-purple-800 whitespace-nowrap"
                >
                  <span className="material-icons text-sm mr-1 align-middle">
                    lock
                  </span>
                  <span className="align-middle">Start Private Session</span>
                </button>
              )}
            </div>
          )}

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
              <strong className="font-bold">An error occurred: </strong>
              <span className="block sm:inline">{error}</span>
            </div>
          )}
        </form>

        {showSuggestedQueries && (
          <div className="w-full mb-4">
            {suggestionsExpanded && (
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
            )}
            <button
              type="button"
              onClick={toggleSuggestions}
              className="text-blue-500 hover:underline mb-2"
            >
              {suggestionsExpanded ? 'Hide suggestions' : 'Show suggestions'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
