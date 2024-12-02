import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import { SiteConfig } from '@/types/siteConfig';
import { ChatInput } from '@/components/ChatInput';
import MessageItem from '@/components/MessageItem';
import { ExtendedAIMessage } from '@/types/ExtendedAIMessage';
import { Dialog } from '@headlessui/react';
import { getOrCreateUUID } from '@/utils/client/uuid';
import Link from 'next/link';

export interface SavedState {
  modelA: string;
  modelB: string;
  temperatureA: number;
  temperatureB: number;
  mediaTypes: {
    text: boolean;
    audio: boolean;
    youtube: boolean;
  };
  collection: string;
}

interface ModelComparisonChatProps {
  siteConfig: SiteConfig | null;
  savedState: SavedState;
  onStateChange: (state: SavedState) => void;
}

interface VoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reasons: VoteReasons, comments: string) => void;
}

interface VoteReasons {
  moreAccurate: boolean;
  betterWritten: boolean;
  moreHelpful: boolean;
  betterReasoning: boolean;
  betterSourceUse: boolean;
}

const ModelComparisonChat: React.FC<ModelComparisonChatProps> = ({
  siteConfig,
  savedState,
  onStateChange,
}) => {
  const [modelA, setModelA] = useState(savedState.modelA);
  const [modelB, setModelB] = useState(savedState.modelB);
  const [temperatureA, setTemperatureA] = useState(savedState.temperatureA);
  const [temperatureB, setTemperatureB] = useState(savedState.temperatureB);
  const [messagesA, setMessagesA] = useState<ExtendedAIMessage[]>([]);
  const [messagesB, setMessagesB] = useState<ExtendedAIMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelError, setModelError] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const [mediaTypes, setMediaTypes] = useState(savedState.mediaTypes);
  const [collection, setCollection] = useState(savedState.collection);
  const accumulatedResponseA = useRef('');
  const accumulatedResponseB = useRef('');
  const [copiedMessageA, setCopiedMessageA] = useState<string | null>(null);
  const [copiedMessageB, setCopiedMessageB] = useState<string | null>(null);
  const [conversationStarted, setConversationStarted] = useState(false);
  const [isVoteModalOpen, setIsVoteModalOpen] = useState(false);
  const [selectedWinner, setSelectedWinner] = useState<'A' | 'B' | null>(null);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [isSudoAdmin, setIsSudoAdmin] = useState(false);
  const [showThankYouMessage, setShowThankYouMessage] = useState(false);
  const modelOptions = useMemo(
    () => [
      { value: 'gpt-4o', label: 'GPT-4 Optimized' },
      { value: 'gpt-4o-mini', label: 'GPT-4 Optimized Mini' },
      { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
      { value: 'gpt-4', label: 'GPT-4' },
      { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
    ],
    [],
  );
  const hasRandomized = useRef(false);

  const handleRandomize = useCallback(() => {
    const getRandomModel = () =>
      modelOptions[Math.floor(Math.random() * modelOptions.length)].value;
    const getRandomTemp = () => Number((Math.random() * 1).toFixed(1));

    // Get first random selections
    const firstModel = getRandomModel();
    const firstTemp = getRandomTemp();

    // Get second selections, ensuring at least one is different
    let secondModel = getRandomModel();
    let secondTemp = getRandomTemp();

    // Keep trying until either model or temperature is different
    while (firstModel === secondModel && firstTemp === secondTemp) {
      secondModel = getRandomModel();
      secondTemp = getRandomTemp();
    }

    setModelA(firstModel);
    setModelB(secondModel);
    setTemperatureA(firstTemp);
    setTemperatureB(secondTemp);
  }, [modelOptions]);

  useEffect(() => {
    if (!hasRandomized.current) {
      handleRandomize();
      hasRandomized.current = true;
    }
  }, [handleRandomize]);

  useEffect(() => {
    if (modelA === modelB && temperatureA === temperatureB) {
      setModelError(
        'Both models and temperatures are the same. Please select different models or temperatures for comparison.',
      );
    } else {
      setModelError(null);
    }
  }, [modelA, modelB, temperatureA, temperatureB]);

  useEffect(() => {
    onStateChange({
      modelA,
      modelB,
      temperatureA,
      temperatureB,
      mediaTypes,
      collection,
    });
  }, [
    modelA,
    modelB,
    temperatureA,
    temperatureB,
    mediaTypes,
    collection,
    onStateChange,
  ]);

  useEffect(() => {
    const checkSudoStatus = async () => {
      try {
        const response = await fetch('/api/sudoCookie');
        const data = await response.json();
        setIsSudoAdmin(data.sudoCookieValue);
      } catch (error) {
        console.error('Failed to check sudo status:', error);
        setIsSudoAdmin(false);
      }
    };
    checkSudoStatus();
  }, []);

  const handleReset = () => {
    setConversationStarted(false);
    setMessagesA([]);
    setMessagesB([]);
    setError(null);
    setModelError(null);
    accumulatedResponseA.current = '';
    accumulatedResponseB.current = '';
  };

  const handleSubmit = async (e: React.FormEvent, query: string) => {
    e.preventDefault();
    if (!conversationStarted) {
      setConversationStarted(true);
    }
    if (modelA === modelB && temperatureA === temperatureB) {
      setError(
        'Cannot compare identical models with the same temperature. Please select different models or temperatures.',
      );
      return;
    }
    setLoading(true);
    setError(null);
    accumulatedResponseA.current = '';
    accumulatedResponseB.current = '';

    // Add user message immediately
    const userMessage: ExtendedAIMessage = {
      type: 'userMessage',
      message: query,
    };
    setMessagesA((prev) => [...prev, userMessage]);
    setMessagesB((prev) => [...prev, userMessage]);

    try {
      // Changed to /api/chat endpoint
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: query,
          modelA,
          modelB,
          temperatureA,
          temperatureB,
          mediaTypes,
          collection,
          history: [], // Empty for comparison mode
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('No response body received');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      // Add initial API messages
      setMessagesA((prev) => [...prev, { type: 'apiMessage', message: '' }]);
      setMessagesB((prev) => [...prev, { type: 'apiMessage', message: '' }]);

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(5));
                console.log('Received data:', data); // Debug log

                if (data.error) {
                  setError(data.error);
                  break;
                }

                if (data.token) {
                  if (data.model === 'A') {
                    accumulatedResponseA.current += data.token;
                    setMessagesA((prev) => {
                      const newMessages = [...prev];
                      const lastMessage = newMessages[newMessages.length - 1];
                      if (lastMessage?.type === 'apiMessage') {
                        lastMessage.message = accumulatedResponseA.current;
                      }
                      return newMessages;
                    });
                  } else if (data.model === 'B') {
                    accumulatedResponseB.current += data.token;
                    setMessagesB((prev) => {
                      const newMessages = [...prev];
                      const lastMessage = newMessages[newMessages.length - 1];
                      if (lastMessage?.type === 'apiMessage') {
                        lastMessage.message = accumulatedResponseB.current;
                      }
                      return newMessages;
                    });
                  }
                }

                if (data.done) {
                  setLoading(false);
                }

                if (data.sourceDocs) {
                  if (data.model === 'A') {
                    setMessagesA((prev) => {
                      const newMessages = [...prev];
                      const lastMessage = newMessages[newMessages.length - 1];
                      if (lastMessage?.type === 'apiMessage') {
                        lastMessage.sourceDocs = data.sourceDocs;
                      }
                      return newMessages;
                    });
                  } else if (data.model === 'B') {
                    setMessagesB((prev) => {
                      const newMessages = [...prev];
                      const lastMessage = newMessages[newMessages.length - 1];
                      if (lastMessage?.type === 'apiMessage') {
                        lastMessage.sourceDocs = data.sourceDocs;
                      }
                      return newMessages;
                    });
                  }
                }
              } catch (e) {
                console.error('Error parsing SSE data:', e);
              }
            }
          }
        }
      } catch (e) {
        console.error('Error reading stream:', e);
        throw e;
      }
    } catch (err) {
      console.error('Error in handleSubmit:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
      setInput('');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const handleMediaTypeChange = (type: 'text' | 'audio' | 'youtube') => {
    setMediaTypes((prev: SavedState['mediaTypes']) => ({
      ...prev,
      [type]: !prev[type],
    }));
  };

  const handleCollectionChange = (newCollection: string) => {
    setCollection(newCollection);
  };

  const handleCopyLinkA = (messageKey: string) => {
    setCopiedMessageA(messageKey);
    setTimeout(() => setCopiedMessageA(null), 2000);
  };

  const handleCopyLinkB = (messageKey: string) => {
    setCopiedMessageB(messageKey);
    setTimeout(() => setCopiedMessageB(null), 2000);
  };

  const handleVoteClick = async (winner: 'A' | 'B') => {
    if (!conversationStarted) return;
    setSelectedWinner(winner);
    setIsVoteModalOpen(true);
  };

  const handleVoteSubmit = async (reasons: VoteReasons, comments: string) => {
    if (!selectedWinner) return;

    try {
      const response = await fetch('/api/model-comparison-vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: getOrCreateUUID(),
          winner: selectedWinner,
          modelAConfig: {
            model: modelA,
            temperature: temperatureA,
            response: messagesA[messagesA.length - 1]?.message || '',
          },
          modelBConfig: {
            model: modelB,
            temperature: temperatureB,
            response: messagesB[messagesB.length - 1]?.message || '',
          },
          question: messagesA[messagesA.length - 2]?.message || '', // Get the last user message
          reasons,
          userComments: comments,
          collection,
          mediaTypes,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit vote');
      }

      setIsVoteModalOpen(false);
      setVoteError(null);
      setShowThankYouMessage(true);
    } catch (error) {
      setVoteError(
        error instanceof Error ? error.message : 'Failed to submit vote',
      );
      setTimeout(() => setVoteError(null), 3000);
    }
  };

  const handleExport = async () => {
    try {
      const response = await fetch('/api/model-comparison-export');
      if (response.status === 403) {
        setError('Unauthorized: Sudo access required');
        return;
      }
      if (!response.ok) throw new Error('Export failed');

      const contentDisposition = response.headers.get('Content-Disposition');
      const filename =
        contentDisposition?.split('filename=')[1]?.replace(/"/g, '') ||
        'model-comparison-votes.csv';

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Export failed:', error);
      setError('Failed to export data');
    }
  };

  const chatInputProps = {
    loading,
    handleSubmit,
    handleStop: () => setLoading(false),
    handleEnter: (
      e: React.KeyboardEvent<HTMLTextAreaElement>,
      query: string,
    ) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit(e, query);
      }
    },
    handleClick: (query: string) => {
      const syntheticEvent = {
        preventDefault: () => {},
        // Add other FormEvent properties as needed
      } as React.FormEvent;
      handleSubmit(syntheticEvent, query);
    },
    handleCollectionChange,
    handlePrivateSessionChange: () => {},
    collection,
    privateSession: false,
    error,
    setError,
    randomQueries: [],
    shuffleQueries: () => {},
    textAreaRef,
    mediaTypes,
    handleMediaTypeChange,
    siteConfig,
    input,
    handleInputChange,
    setQuery: setInput,
    setShouldAutoScroll: () => {},
    isNearBottom: true,
    setIsNearBottom: () => {},
    isLoadingQueries: false,
    showPrivateSessionOptions: false,
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <button
          onClick={handleRandomize}
          className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors w-fit disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={conversationStarted}
        >
          Random Models
        </button>
        {conversationStarted && (
          <button
            onClick={() => {
              handleReset();
              handleRandomize();
            }}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors w-fit"
          >
            Reset
          </button>
        )}
      </div>
      <div className="max-h-[600px] overflow-y-auto">
        <div className="flex flex-col md:flex-row gap-4">
          {['A', 'B'].map((modelKey) => (
            <div key={modelKey} className="flex-1">
              <div className="text-xl font-semibold mb-2">Model {modelKey}</div>
              <div className="flex flex-col gap-2">
                <select
                  value={modelKey === 'A' ? modelA : modelB}
                  onChange={(e) =>
                    modelKey === 'A'
                      ? setModelA(e.target.value)
                      : setModelB(e.target.value)
                  }
                  className="w-full p-2 border rounded"
                  disabled={conversationStarted}
                >
                  {modelOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-2">
                  <span className="text-sm">Temperature:</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={modelKey === 'A' ? temperatureA : temperatureB}
                    onChange={(e) =>
                      modelKey === 'A'
                        ? setTemperatureA(parseFloat(e.target.value))
                        : setTemperatureB(parseFloat(e.target.value))
                    }
                    className="flex-grow"
                    disabled={conversationStarted}
                  />
                  <span className="text-sm">
                    {modelKey === 'A' ? temperatureA : temperatureB}
                  </span>
                </div>
              </div>
              <div className="border rounded p-4 mt-4 min-h-[100px] transition-[min-height] duration-300 relative">
                {(modelKey === 'A' ? messagesA : messagesB).map(
                  (message: ExtendedAIMessage, index: number) => (
                    <div key={index} className="relative">
                      <MessageItem
                        message={message}
                        index={index}
                        isLastMessage={
                          index ===
                          (modelKey === 'A' ? messagesA : messagesB).length - 1
                        }
                        loading={loading}
                        collectionChanged={false}
                        hasMultipleCollections={false}
                        likeStatuses={{}}
                        linkCopied={
                          modelKey === 'A' ? copiedMessageA : copiedMessageB
                        }
                        votes={{}}
                        siteConfig={siteConfig}
                        handleLikeCountChange={() => {}}
                        handleCopyLink={
                          modelKey === 'A' ? handleCopyLinkA : handleCopyLinkB
                        }
                        handleVote={() => {}}
                        lastMessageRef={null}
                        messageKey={`model${modelKey}-${index}`}
                        voteError={null}
                        privateSession={false}
                        allowAllAnswersPage={false}
                        showSourcesBelow={false}
                        previousMessage={messagesA[messagesA.length - 2]}
                      />
                      {message.type === 'apiMessage' &&
                        index ===
                          (modelKey === 'A' ? messagesA : messagesB).length -
                            1 &&
                        conversationStarted && (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() =>
                                handleVoteClick(modelKey as 'A' | 'B')
                              }
                              className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                            >
                              <span className="material-icons">thumb_up</span>
                              Vote
                            </button>
                          </div>
                        )}
                    </div>
                  ),
                )}
                {loading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-50">
                    <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      {modelError && (
        <div className="text-red-500 text-sm mb-4">{modelError}</div>
      )}
      <div className="mt-4">
        <ChatInput {...chatInputProps} />
      </div>
      <VoteModal
        isOpen={isVoteModalOpen}
        onClose={() => setIsVoteModalOpen(false)}
        onSubmit={handleVoteSubmit}
      />
      {voteError && (
        <div className="fixed bottom-4 right-4 bg-red-500 text-white px-4 py-2 rounded shadow">
          {voteError}
        </div>
      )}
      {isSudoAdmin && (
        <div className="mt-8 flex justify-center">
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Export Data
          </button>
        </div>
      )}
      {showThankYouMessage && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl text-center">
            <h3 className="text-xl font-semibold mb-4">
              Thanks for your feedback!
            </h3>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => {
                  setShowThankYouMessage(false);
                  handleReset();
                }}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              >
                Compare Another
              </button>
              <Link
                href="/"
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
              >
                Home
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const VoteModal: React.FC<VoteModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [reasons, setReasons] = useState<VoteReasons>({
    moreAccurate: false,
    betterWritten: false,
    moreHelpful: false,
    betterReasoning: false,
    betterSourceUse: false,
  });
  const [comments, setComments] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setReasons({
        moreAccurate: false,
        betterWritten: false,
        moreHelpful: false,
        betterReasoning: false,
        betterSourceUse: false,
      });
      setComments('');
      setValidationError(null);
    }
  }, [isOpen]);

  const handleSubmit = () => {
    const hasCheckedReason = Object.values(reasons).some((value) => value);
    if (!hasCheckedReason && !comments.trim()) {
      setValidationError(
        'Please select at least one reason or provide a comment',
      );
      return;
    }
    setValidationError(null);
    onSubmit(reasons, comments);
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-sm rounded bg-white p-6">
          <Dialog.Title className="text-lg font-medium mb-4">
            Why was this response better?
          </Dialog.Title>
          <div className="space-y-4">
            {Object.entries(reasons).map(([key, value]) => (
              <label key={key} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={value}
                  onChange={(e) =>
                    setReasons((prev) => ({
                      ...prev,
                      [key]: e.target.checked,
                    }))
                  }
                  className="rounded border-gray-300"
                />
                <span className="text-sm">
                  {key
                    .replace(/([A-Z])/g, ' $1')
                    .toLowerCase()
                    .replace(/^\w/, (c) => c.toUpperCase())}
                </span>
              </label>
            ))}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700">
                Additional Comments
              </label>
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-400 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                rows={3}
              />
            </div>
            {validationError && (
              <p className="text-red-500 text-sm">{validationError}</p>
            )}
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Submit
              </button>
            </div>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

export default ModelComparisonChat;
