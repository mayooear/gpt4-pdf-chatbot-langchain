import React from 'react';
import styles from '@/styles/Home.module.css';

interface PopupProps {
  message: string;
  onClose: () => void;
}

const Popup: React.FC<PopupProps> = ({ message, onClose }) => {
  return (
    <div className={styles.popupOverlay}>
      <div className={styles.popupContainer}>
        <div className={styles.popupMessage}>
          <p><strong>Welcome, Gurubhai!</strong></p>
          <br />
          <p>{message}</p>
          <br />
          <button onClick={onClose} className={styles.closeButton}>OK</button>
        </div>
      </div>
    </div>
  );
};

export default Popup;
