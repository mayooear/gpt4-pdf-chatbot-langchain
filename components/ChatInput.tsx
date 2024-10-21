// This component renders a chat input interface with various options and controls
// It handles user input, submission, and displays suggested queries and media type options

import React, { useState, useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';
import validator from 'validator';
import styles from '@/styles/Home.module.css';
import RandomQueries from '@/components/RandomQueries';
import CollectionSelector from '@/components/CollectionSelector';
import { SiteConfig } from '@/types/siteConfig';
import {
  getEnableSuggestedQueries,
  getEnableMediaTypeSelection,
  getEnableAuthorSelection,
  getChatPlaceholder,
  getEnabledMediaTypes,
} from '@/utils/client/siteConfig';
import { logEvent } from '@/utils/client/analytics';

// Define the props interface for the ChatInput component
interface ChatInputProps {
  loading: boolean;
  handleSubmit: (e: React.FormEvent, query: string) => void;
  handleStop: () => void;
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
  setError: (error: string | null) => void;
  randomQueries: string[];
  shuffleQueries: () => void;
  textAreaRef: React.RefObject<HTMLTextAreaElement>;
  mediaTypes: { text: boolean; audio: boolean; youtube: boolean };
  handleMediaTypeChange: (type: 'text' | 'audio' | 'youtube') => void;
  siteConfig: SiteConfig | null;
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  setShouldAutoScroll: (should: boolean) => void;
  setQuery: (query: string) => void;
  isNearBottom: boolean;
  setIsNearBottom: React.Dispatch<React.SetStateAction<boolean>>;
  isLoadingQueries: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  loading,
  handleSubmit,
  handleStop,
  handleEnter,
  handleClick,
  handleCollectionChange,
  handlePrivateSessionChange,
  collection,
  privateSession,
  error,
  setError,
  randomQueries,
  shuffleQueries,
  textAreaRef,
  mediaTypes,
  handleMediaTypeChange,
  siteConfig,
  input,
  handleInputChange,
  setQuery,
  setIsNearBottom,
  isLoadingQueries,
}) => {
  // State variables for managing component behavior
  const [, setLocalQuery] = useState<string>('');
  const [hasInteracted, setHasInteracted] = useState<boolean>(false);
  const [isFirstQuery, setIsFirstQuery] = useState<boolean>(true);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [showOptions, setShowOptions] = useState(false);
  const [suggestionsExpanded, setSuggestionsExpanded] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Effect to set initial suggestions expanded state based on visit count
  useEffect(() => {
    const visitCount = parseInt(localStorage.getItem('visitCount') || '0');
    setSuggestionsExpanded(visitCount < 10);
  }, [setSuggestionsExpanded]);

  // Effect to reset input after submission
  useEffect(() => {
    if (!loading && hasInteracted) {
      setLocalQuery('');
      if (textAreaRef.current) {
        textAreaRef.current.style.height = 'auto';
      }
    }
  }, [loading, hasInteracted, textAreaRef]);

  // Effect to handle mobile responsiveness
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

  // Effect to reset input and update first query state
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

  // Function to focus on the input field
  const focusInput = () => {
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 0);
  };

  // Function to sanitize user input
  const sanitizeInput = (input: string) => {
    return DOMPurify.sanitize(input);
  };

  // Function to validate user input
  const validateInput = (input: string) => {
    if (validator.isEmpty(input)) {
      return 'Input cannot be empty';
    }
    if (!validator.isLength(input, { min: 1, max: 4000 })) {
      return 'Input must be between 1 and 4000 characters';
    }
    return null;
  };

  // Function to handle form submission
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) {
      handleStop();
      logEvent('stop_query', 'Engagement', '');
    } else {
      const sanitizedInput = sanitizeInput(input);
      const validationError = validateInput(sanitizedInput);
      if (validationError) {
        setError(validationError);
        return;
      }
      setIsNearBottom(true);
      handleSubmit(e, sanitizedInput);
      setQuery('');
      focusInput();
      logEvent('submit_query', 'Engagement', sanitizedInput);
    }
  };

  // Function to handle Enter key press
  const onEnter = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      if (!loading) {
        e.preventDefault();
        const sanitizedInput = sanitizeInput(input);
        const validationError = validateInput(sanitizedInput);
        if (validationError) {
          setError(validationError);
          return;
        }
        logEvent('submit_query_enter', 'Engagement', sanitizedInput);
        setHasInteracted(true);
        setIsNearBottom(true);
        handleEnter(e, sanitizedInput);
        setQuery('');
        focusInput();
      }
    }
  };

  // Get configuration options from siteConfig
  const showSuggestedQueries = getEnableSuggestedQueries(siteConfig);
  const showMediaTypeSelection = getEnableMediaTypeSelection(siteConfig);
  const showAuthorSelection = getEnableAuthorSelection(siteConfig);
  const enabledMediaTypes = getEnabledMediaTypes(siteConfig);

  // Function to toggle suggestions visibility
  const toggleSuggestions = (e: React.MouseEvent) => {
    e.preventDefault();
    setSuggestionsExpanded(!suggestionsExpanded);
  };

  // Function to handle clicking on a suggested query
  const onQueryClick = (q: string) => {
    setLocalQuery(q);
    setIsNearBottom(true);
    handleClick(q);
  };

  const placeholderText = getChatPlaceholder(siteConfig) || 'Ask a question...';

  // Render the chat input interface
  return (
    <div className={`${styles.center} w-full mt-4 px-2 md:px-0`}>
      <div className="w-full">
        <form onSubmit={onSubmit}>
          {/* Input textarea and submit button */}
          <div className="flex items-center space-x-2 mb-4">
            <textarea
              onKeyDown={onEnter}
              onChange={handleInputChange}
              value={input}
              ref={inputRef}
              autoFocus={false}
              rows={1}
              maxLength={4000}
              id="userInput"
              name="userInput"
              placeholder={hasInteracted ? '' : placeholderText}
              className="flex-grow p-2 border border-gray-300 rounded-md resize-none focus:outline-none"
            />
            <button
              type="submit"
              className="bg-blue-500 text-white p-2 rounded-full flex-shrink-0 w-10 h-10 flex items-center justify-center"
            >
              {loading ? (
                <span className="material-icons text-2xl leading-none">
                  stop
                </span>
              ) : (
                <span className="material-icons text-xl leading-none">
                  send
                </span>
              )}
            </button>
          </div>

          {/* Mobile options toggle */}
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

          {/* Options section (media type, collection selector, private session) */}
          {(!isMobile || showOptions) && (
            <div className="flex flex-wrap gap-2 mb-2">
              {showMediaTypeSelection && (
                <>
                  {enabledMediaTypes.includes('text') && (
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
                  )}
                  {enabledMediaTypes.includes('audio') && (
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
                  )}
                  {enabledMediaTypes.includes('youtube') && (
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
                  )}
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
              {!privateSession && siteConfig?.allowPrivateSessions && (
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

          {/* Error display */}
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
              <strong className="font-bold">An error occurred: </strong>
              <span className="block sm:inline">{error}</span>
            </div>
          )}
        </form>

        {/* Suggested queries section */}
        {!isLoadingQueries &&
          showSuggestedQueries &&
          randomQueries.length > 0 && (
            <div className="w-full mb-4">
              {suggestionsExpanded && (
                <>
                  <RandomQueries
                    queries={randomQueries}
                    onQueryClick={onQueryClick}
                    isLoading={loading}
                    shuffleQueries={shuffleQueries}
                    isMobile={isMobile}
                  />
                </>
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
