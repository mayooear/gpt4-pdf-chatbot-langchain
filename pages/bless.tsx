import { useState } from 'react';
import Link from 'next/link';
import { useSudo } from '@/contexts/SudoContext';

const SudoPage: React.FC = () => {
  const [password, setPassword] = useState('');
  const { isSudoUser, checkSudoStatus } = useSudo();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const response = await fetch('/api/sudoCookie', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password }),
    });
    await response.json();
    checkSudoStatus();
  };

  const handleRemoveBlessed = async () => {
    await fetch('/api/sudoCookie', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    checkSudoStatus();
  };

  return (
    <div className="flex flex-col justify-center items-center h-screen">
      <p className="text-lg text-gray-600 mb-4">
        {isSudoUser ? 'You are Blessed!' : 'You are not blessed'}
      </p>
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
