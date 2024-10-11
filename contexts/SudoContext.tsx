import React, { createContext, useState, useEffect, useContext } from 'react';

interface SudoContextType {
  isSudoUser: boolean;
  errorMessage: string | null;
  checkSudoStatus: () => Promise<void>;
}

const SudoContext = createContext<SudoContextType | undefined>(undefined);

export const SudoProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isSudoUser, setIsSudoUser] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const checkSudoStatus = async () => {
    try {
      const response = await fetch('/api/sudoCookie', {
        method: 'GET',
        credentials: 'include',
      });
      const data = await response.json();
      setIsSudoUser(data.sudoCookieValue);
      if (data.ipMismatch) {
        setErrorMessage('Your IP has changed. Please re-authenticate.');
      } else {
        setErrorMessage(null);
      }
    } catch (error) {
      console.error('Error checking sudo status:', error);
      setIsSudoUser(false);
      setErrorMessage('Error checking sudo status');
    }
  };

  useEffect(() => {
    checkSudoStatus();
  }, []);

  return (
    <SudoContext.Provider value={{ isSudoUser, errorMessage, checkSudoStatus }}>
      {children}
    </SudoContext.Provider>
  );
};

export const useSudo = () => {
  const context = useContext(SudoContext);
  if (context === undefined) {
    throw new Error('useSudo must be used within a SudoProvider');
  }
  return context;
};
