import { useState } from 'react';
import { Message } from '@/types/chat';
import { Document } from 'langchain/document';
import Cookies from 'js-cookie';
import { logEvent } from '@/utils/client/analytics';

export const useChat = (collection: string, history: [string, string][], privateSession: boolean, mediaTypes: { text: boolean; audio: boolean }) => {
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

  const handleSubmit = async (e: React.FormEvent, query: string) => {
    e.preventDefault();
    
    setError(null);
  
    if (!query) {
      alert('Please input a question');
      return;
    }
  
    setMessageState((state) => ({
      ...state,
      messages: [
        ...state.messages,
        {
          type: 'userMessage',
          message: query,
        },
      ],
    }));

    logEvent('ask_question', 'Engagement', query);

    setLoading(true);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          collection,
          question: query,
          history,
          privateSession,
          mediaTypes,
        }),
      });
      const data = await response.json();

      if (data.error) {
        setError(data.error);
        console.log('ERROR: data error: ' + data.error);
      } else {
        const transformedSourceDocs = data.sourceDocuments.map((doc: any) => ({
          ...doc,
          metadata: {
            ...doc.metadata,
            title: doc.metadata.title || 'Unknown source'
          }
        }));

        setMessageState((state) => ({
          ...state,
          messages: [
            ...state.messages,
            {
              type: 'apiMessage',
              message: data.text,
              sourceDocs: transformedSourceDocs,
              docId: data.docId,
              collection: collection,
            },
          ],
          history: [...state.history, [query, data.text]],
        }));
      }

      setLoading(false);
    } catch (error) {
      setLoading(false);
      setError('An error occurred while fetching the data. Please try again.');
      console.log('error', error);
    }
  };

  return {
    loading,
    error,
    messageState,
    handleSubmit,
  };
};