import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import gfm from 'remark-gfm';
import Cookies from 'js-cookie';
import styles from '@/styles/Home.module.css';

interface ShareDialogProps {
    markdownAnswer: string;
    answerId: string;
    onClose: () => void;
    onShareSuccess: () => void; 
}
    
const ShareDialog: React.FC<ShareDialogProps> = ({ markdownAnswer, answerId, onClose, onShareSuccess }) => {
  const [firstName, setFirstName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');
  const [comments, setComments] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Prefill the first and last name from cookies when the component mounts
    const savedFirstName = Cookies.get('firstName');
    const savedLastName = Cookies.get('lastName');
    if (savedFirstName) setFirstName(savedFirstName);
    if (savedLastName) setLastName(savedLastName);
  }, []);

  const handleSubmit = async () => {
    if (!firstName || !lastName) {
      setError('First name and last name are required.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      // Replace with your actual API call
      await fetch('/api/share', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName,
          lastName,
          comments,
          answerId,
        }),
      });

      // Handle success response
      onShareSuccess();
      onClose(); // Close the dialog

      // Save the first and last name to cookies
      Cookies.set('firstName', firstName, { expires: 365 });
      Cookies.set('lastName', lastName, { expires: 365 });

    } catch (e) {
      setError('An error occurred while sharing the answer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Function to close the ShareDialog when the backdrop is clicked
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
        onClose(); // Call the onClose prop function to close the dialog
    }
  };
    
  return (
    <div className={styles.shareDialogBackdrop} onClick={handleBackdropClick}>
      <div className={styles.shareDialog} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeButton} onClick={onClose}>&times;</button>
        <h2 className={styles.shareDialogTitle}>Share Answer with Gurubhais</h2>
        {error && <div className={styles.errorMessage}>{error}</div>}
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <input
            type="text"
            placeholder="First Name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            disabled={isSubmitting}
            style={{ width: '49%' }}
          />
          <input
            type="text"
            placeholder="Last Name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            disabled={isSubmitting}
            style={{ width: '49%' }}
          />
        </div>
        <textarea
          placeholder="Your comments (optional)"
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          disabled={isSubmitting}
        />
        <div className="markdownanswer">
            <ReactMarkdown remarkPlugins={[gfm]} linkTarget="_blank"> 
              {`${markdownAnswer.split(" ").slice(0, 50).join(" ")}... **See more**`}
            </ReactMarkdown>
        </div>
        <button className={styles.shareButton} onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Sharing...' : 'Share Answer'}
        </button>

      </div>
    </div>
  );
};

export default ShareDialog;
