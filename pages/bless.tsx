import { useState } from 'react';
import Link from 'next/link';
import { useSudo } from '@/contexts/SudoContext';
import validator from 'validator';

const SudoPage: React.FC = () => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { isSudoUser, checkSudoStatus } = useSudo();

  const validatePassword = (password: string) => {
    if (!validator.isLength(password, { min: 8, max: 100 })) {
      return 'Password must be between 8 and 100 characters';
    }
    return null;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const validationError = validatePassword(password);
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      const response = await fetch('/api/sudoCookie', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'An error occurred');
      }
      checkSudoStatus();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred');
    }
  };

  const handleRemoveBlessed = async () => {
    try {
      const response = await fetch('/api/sudoCookie', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        throw new Error('Failed to remove blessed status');
      }
      checkSudoStatus();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred');
    }
  };

  return (
    <div className="flex flex-col justify-center items-center h-screen">
      <p className="text-lg text-gray-600 mb-4">
        {isSudoUser ? 'You are Blessed!' : 'You are not blessed'}
      </p>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      <form onSubmit={handleSubmit} className="mb-4">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter password"
          className="border p-2 mb-2"
          minLength={8}
          maxLength={100}
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
