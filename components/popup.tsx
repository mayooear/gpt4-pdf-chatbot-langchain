import React from 'react';
import styles from '@/styles/Home.module.css';
import { getWelcomePopupHeading } from '@/utils/client/siteConfig';
import { SiteConfig } from '@/types/siteConfig';

interface PopupProps {
  message: string;
  onClose: () => void;
  siteConfig: SiteConfig | null;
}

const Popup: React.FC<PopupProps> = ({ message, onClose, siteConfig }) => {
  const welcomeHeading = getWelcomePopupHeading(siteConfig);

  const handleClose = () => {
    onClose();
    setTimeout(() => {
      const textArea = document.querySelector('textarea');
      if (textArea && window.innerWidth > 768) {
        textArea.focus();
      }
    }, 100);
  };

  return (
    <div className={styles.popupOverlay}>
      <div className={styles.popupContainer}>
        <div className={styles.popupMessage}>
          <p>
            <strong>{welcomeHeading}</strong>
          </p>
          <br />
          <p>{message}</p>
          <br />
          <button onClick={handleClose} className={styles.closeButton}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

export default Popup;
