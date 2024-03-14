import { useState, useEffect } from 'react';
import Cookies from 'js-cookie';

const usePopup = (version: string, message: string) => {
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState(message);

  useEffect(() => {
    const seenMessageVersion = Cookies.get('seenMessageVersion');
    if (seenMessageVersion !== version) {
      setShowPopup(true);
    }
  }, [version]);

  const closePopup = () => {
    Cookies.set('seenMessageVersion', version, {
      expires: 365,
      sameSite: 'Lax',
      secure: true
    });
    setShowPopup(false);
  };

  return { showPopup, closePopup, popupMessage };
};

export default usePopup;
