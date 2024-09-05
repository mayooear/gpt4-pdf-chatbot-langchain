import { useEffect, useState, useCallback } from 'react';
import { isSudo } from '../utils/client/cookieUtils';
import Link from 'next/link';

const SudoPage: React.FC = () => {
  const [password, setPassword] = useState('');
  const [sudoStatus, setSudoStatus] = useState('');

  const checkSudoStatus = useCallback(async () => {
    const cookies = document.cookie;
    const isSudoUser = await isSudo(cookies);
    setSudoStatus(isSudoUser ? 'You are Blessed!' : 'You are not blessed');
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const response = await fetch('/api/sudoCookie', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password }),
    });
    const data = await response.json();
    setSudoStatus(data.message);
    checkSudoStatus();
  };

  const handleRemoveBlessed = async () => {
    const response = await fetch('/api/sudoCookie', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const data = await response.json();
    setSudoStatus(data.message);
    checkSudoStatus();
  };

  useEffect(() => {
    checkSudoStatus();
  }, [checkSudoStatus]);

  return (
    <div className="flex flex-col justify-center items-center h-screen">
      <p className="text-lg text-gray-600 mb-4">{sudoStatus}</p>
      <form onSubmit={handleSubmit} className="mb-4">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter password"
          className="border p-2 mb-2"
        />
        <button type="submit" className="bg-blue-500 text-white p-2">
          Submit
        </button>
      </form>
      <Link href="/" className="text-blue-500 hover:underline mb-4">
        Go to Home
      </Link>
      <a
        href="#"
        onClick={handleRemoveBlessed}
        className="text-blue-500 hover:underline"
      >
        Remove Blessed Cookie
      </a>
    </div>
  );
};

export default SudoPage;
