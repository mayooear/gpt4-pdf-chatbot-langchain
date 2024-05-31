import { useEffect, useState } from 'react';
import Cookies from 'js-cookie';
import { GetServerSideProps, GetServerSidePropsContext } from 'next';

interface SudoPageProps {
  pageName: string;
}

const SudoPage: React.FC<SudoPageProps> = ({ pageName }) => {
  const [password, setPassword] = useState('');
  const [sudoStatus, setSudoStatus] = useState('');

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
  };
    
  useEffect(() => {
    const getSudoCookie = async () => {
      const response = await fetch('/api/sudoCookie', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      return data.sudoCookieValue;
    };
  
    getSudoCookie().then(sudoCookie => {
      if (!sudoCookie) {
        setSudoStatus('You are not blessed');
      } else {
        setSudoStatus('You are Blessed!');
      }
    });
  }, []);
  
  return (
    <div className="flex flex-col justify-center items-center h-screen">
      <p className="text-lg text-gray-600 mb-4">
        {sudoStatus}
      </p>
      <form onSubmit={handleSubmit} className="mb-4">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter password"
        />
        <button type="submit">Submit</button>
      </form>
      <a href="/" className="text-blue-500 hover:underline mb-4">Go to Home</a>
      <a href="#" onClick={handleRemoveBlessed} className="text-blue-500 hover:underline">Remove Blessed Cookie</a>
    </div>
  );
};

export default SudoPage;