import React, { useState, useCallback, useRef, useEffect } from 'react';
import { SiteConfig } from '@/types/siteConfig';
import { ChatInput } from '@/components/ChatInput';
import MessageItem from '@/components/MessageItem';
import { ExtendedAIMessage } from '@/types/ExtendedAIMessage';
import { StreamingResponseData } from '@/types/StreamingResponseData';
import { Document } from 'langchain/document';
import { DocMetadata } from '@/types/DocMetadata';

interface ModelComparisonChatProps {
  siteConfig: SiteConfig | null;
}

const ModelComparisonChat: React.FC<ModelComparisonChatProps> = ({
  siteConfig,
}) => {
  const [modelA, setModelA] = useState(
    () => localStorage.getItem('modelA') || 'gpt-4o',
  );
  const [modelB, setModelB] = useState(
    () => localStorage.getItem('modelB') || 'gpt-3.5-turbo',
  );
  const [temperatureA, setTemperatureA] = useState(0);
  const [temperatureB, setTemperatureB] = useState(0);
  const [messagesA, setMessagesA] = useState<ExtendedAIMessage[]>([]);
  const [messagesB, setMessagesB] = useState<ExtendedAIMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelError, setModelError] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const [mediaTypes, setMediaTypes] = useState({
    text: true,
    audio: true,
    youtube: true,
  });
  const [collection, setCollection] = useState('master_swami');

  useEffect(() => {
    localStorage.setItem('modelA', modelA);
    localStorage.setItem('modelB', modelB);

    if (modelA === modelB && temperatureA === temperatureB) {
      setModelError(
        'Both models and temperatures are the same. Please select different models or temperatures for comparison.',
      );
    } else {
      setModelError(null);
    }
  }, [modelA, modelB, temperatureA, temperatureB]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent, query: string) => {
      e.preventDefault();
      if (modelA === modelB && temperatureA === temperatureB) {
        setError(
          'Cannot compare identical models with the same temperature. Please select different models or temperatures.',
        );
        return;
      }
      setLoading(true);
      setError(null);

      // Add user message immediately
      const userMessage: ExtendedAIMessage = {
        type: 'userMessage',
        message: query,
      };
      setMessagesA((prev) => [...prev, userMessage]);
      setMessagesB((prev) => [...prev, userMessage]);

      try {
        const response = await fetch('/api/model-comparison', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query,
            modelA,
            modelB,
            temperatureA,
            temperatureB,
            mediaTypes,
            collection,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to fetch comparison results');
        }

        const data = await response.json();
        const responseA: StreamingResponseData = data.responseA;
        const responseB: StreamingResponseData = data.responseB;

        setMessagesA((prev) => [
          ...prev,
          {
            type: 'apiMessage',
            message: responseA.token || '',
            sourceDocs: responseA.sourceDocs as
              | Document<DocMetadata>[]
              | undefined,
          },
        ]);
        setMessagesB((prev) => [
          ...prev,
          {
            type: 'apiMessage',
            message: responseB.token || '',
            sourceDocs: responseB.sourceDocs as
              | Document<DocMetadata>[]
              | undefined,
          },
        ]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
        setInput(''); // Clear input after response is received
      }
    },
    [modelA, modelB, temperatureA, temperatureB, mediaTypes, collection],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const handleMediaTypeChange = (type: 'text' | 'audio' | 'youtube') => {
    setMediaTypes((prev) => ({ ...prev, [type]: !prev[type] }));
  };

  const handleCollectionChange = (newCollection: string) => {
    setCollection(newCollection);
  };

  const modelOptions = [
    { value: 'gpt-4o', label: 'GPT-4 Optimized' },
    { value: 'gpt-4o-mini', label: 'GPT-4 Optimized Mini' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    { value: 'gpt-4', label: 'GPT-4' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col md:flex-row gap-4 mb-4">
        {['A', 'B'].map((modelKey) => (
          <div key={modelKey} className="flex-1">
            <h2 className="text-xl font-semibold mb-2">
              Model {modelKey}: {modelKey === 'A' ? modelA : modelB}
            </h2>
            <div className="flex flex-col gap-2">
              <select
                value={modelKey === 'A' ? modelA : modelB}
                onChange={(e) =>
                  modelKey === 'A'
                    ? setModelA(e.target.value)
                    : setModelB(e.target.value)
                }
                className="w-full p-2 border rounded"
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
                />
                <span className="text-sm">
                  {modelKey === 'A' ? temperatureA : temperatureB}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
      {modelError && (
        <div className="text-red-500 text-sm mb-4">{modelError}</div>
      )}
      <div className="flex flex-col md:flex-row gap-4">
        {['A', 'B'].map((modelKey) => (
          <div key={modelKey} className="flex-1">
            <div className="border rounded p-4 min-h-[300px] relative">
              {(modelKey === 'A' ? messagesA : messagesB).map(
                (message, index) => (
                  <MessageItem
                    key={index}
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
                    linkCopied={null}
                    votes={{}}
                    siteConfig={siteConfig}
                    handleLikeCountChange={() => {}}
                    handleCopyLink={() => {}}
                    handleVote={() => {}}
                    lastMessageRef={null}
                    messageKey={`model${modelKey}-${index}`}
                    voteError={null}
                    privateSession={false}
                    allowAllAnswersPage={false}
                    showSourcesBelow={true}
                  />
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
      <div className="mt-4">
        <ChatInput
          loading={loading}
          handleSubmit={handleSubmit}
          handleEnter={(e, query) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e, query);
            }
          }}
          handleClick={() => {}}
          handleCollectionChange={handleCollectionChange}
          collection={collection}
          error={error}
          setError={setError}
          randomQueries={[]}
          shuffleQueries={() => {}}
          textAreaRef={textAreaRef}
          mediaTypes={mediaTypes}
          handleMediaTypeChange={handleMediaTypeChange}
          siteConfig={siteConfig}
          input={input}
          handleInputChange={handleInputChange}
          setQuery={setInput}
          setShouldAutoScroll={() => {}}
          handleStop={() => {}}
          isNearBottom={true}
          setIsNearBottom={() => {}}
          isLoadingQueries={false}
          privateSession={false}
          handlePrivateSessionChange={() => {}}
          showPrivateSessionOptions={false}
        />
      </div>
    </div>
  );
};

export default ModelComparisonChat;
