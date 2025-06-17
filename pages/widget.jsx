import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import styles from '@/styles/Widget.module.css'; // Create this CSS module
import LoadingDots from '@/components/ui/LoadingDots'; // Re-use if available and suitable

// This page will directly implement the widget UI.
// It's structured like a self-contained component.

export default function WidgetPage() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [messages, setMessages] = useState([
    {
      id: 'init',
      type: 'apiMessage',
      message: "Hello! I'm a public product assistant. Ask me about our products!",
    },
  ]);

  const messageListRef = useRef(null);
  const textAreaRef = useRef(null);

  useEffect(() => {
    textAreaRef.current?.focus();
  }, []);

  useEffect(() => {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [messages]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!query.trim()) {
      alert('Please input a question.');
      return;
    }

    const question = query.trim();
    const userMessage = {
      id: `user-${Date.now()}`,
      type: 'userMessage',
      message: question,
    };
    setMessages(prevMessages => [...prevMessages, userMessage]);
    setLoading(true);
    setQuery('');

    try {
      const response = await fetch('/api/public-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }), // No history sent for simplicity in public widget
      });
      const data = await response.json();

      if (data.error) {
        setError(data.error);
        const errorMessage = {
          id: `api-error-${Date.now()}`,
          type: 'apiMessage',
          message: `Sorry, an error occurred: ${data.error}`,
        };
        setMessages(prevMessages => [...prevMessages, errorMessage]);
      } else {
        const apiMessage = {
          id: `api-${Date.now()}`,
          type: 'apiMessage',
          message: data.text, // Assuming 'text' is the response field
        };
        setMessages(prevMessages => [...prevMessages, apiMessage]);
      }
    } catch (err) {
      setError('An error occurred while fetching data. Please try again.');
      const errorMessage = {
        id: `fetch-error-${Date.now()}`,
        type: 'apiMessage',
        message: 'Sorry, I couldn\'t connect to the server. Please try again later.',
      };
      setMessages(prevMessages => [...prevMessages, errorMessage]);
      console.error(err);
    } finally {
      setLoading(false);
      textAreaRef.current?.focus();
    }
  }

  const handleEnter = (e) => {
    if (e.key === 'Enter' && query && !e.shiftKey) {
      handleSubmit(e);
    }
  };

  return (
    <div className={styles.widgetContainer}>
      <div className={styles.header}>
        <h2>Public Product Assistant</h2>
      </div>
      <div ref={messageListRef} className={styles.messageList}>
        {messages.map((message) => {
          const isUser = message.type === 'userMessage';
          return (
            <div
              key={message.id}
              className={`${styles.message} ${isUser ? styles.userMessage : styles.apiMessage}`}
            >
              <div className={styles.markdownAnswer}>
                <ReactMarkdown linkTarget="_blank">{message.message}</ReactMarkdown>
              </div>
            </div>
          );
        })}
        {loading && (
          <div className={`${styles.message} ${styles.apiMessage}`}>
            <LoadingDots color="#666" />
          </div>
        )}
      </div>
      <div className={styles.inputFormContainer}>
        <form onSubmit={handleSubmit} className={styles.inputForm}>
          <textarea
            disabled={loading}
            onKeyDown={handleEnter}
            ref={textAreaRef}
            autoFocus
            rows={2}
            maxLength={512}
            id="userInput"
            name="userInput"
            placeholder={loading ? 'Waiting for response...' : 'Type your question...'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={styles.textarea}
          />
          <button type="submit" disabled={loading} className={styles.sendButton}>
            {loading ? '...' : 'Send'}
          </button>
        </form>
        {error && <p className={styles.errorText}>{error}</p>}
      </div>
       {/* Basic footer, can be removed or styled */}
      <footer className={styles.footer}>
        <p>Powered by AI</p>
      </footer>
    </div>
  );
}
