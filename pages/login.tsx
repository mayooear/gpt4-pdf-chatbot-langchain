import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { SiteConfig } from '@/types/siteConfig';
import { getSiteName, getTagline } from '@/utils/client/siteConfig';
import Image from 'next/image';

interface LoginProps {
  siteConfig: SiteConfig | null;
}

export default function Login({ siteConfig }: LoginProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const { redirect } = router.query;

  useEffect(() => {
    if (redirect) {
      console.log('Redirect query parameter:', redirect);
    }
  }, [redirect]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Submitting login with redirect:', redirect);
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password, redirect }),
    });

    if (res.ok) {
      const data = await res.json();
      console.log('Login successful, redirecting to:', data.redirect);
      router.push(data.redirect || '/');
    } else if (res.status === 429) {
      alert('Too many login attempts. Please try again later.');
    } else {
      alert('Incorrect password');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      {siteConfig?.loginImage && (
        <div className="flex flex-col items-center mb-6 w-full max-w-md">
          <Image
            src={`/${siteConfig.loginImage}`}
            alt="Login Image"
            width={250}
            height={250}
            className="w-full h-auto object-contain"
          />
        </div>
      )}
      <form
        onSubmit={handleSubmit}
        className="p-6 bg-white rounded shadow-md max-w-md w-full"
      >
        <h1 className="mb-4 text-2xl">Welcome to {getSiteName(siteConfig)}!</h1>
        <p className="mb-4">{getTagline(siteConfig)}</p>
        <div className="relative mb-4">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="p-2 border border-gray-300 rounded w-full"
            placeholder="Enter Password"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 p-2 text-gray-600"
          >
            {showPassword ? '🙈' : '👁️'}
          </button>
        </div>
        <button type="submit" className="p-2 bg-blue-500 text-white rounded">
          Log In
        </button>
      </form>
      {siteConfig?.siteId === 'ananda' && (
        <p className="mt-4 text-center">
          You can get the password from&nbsp;
          <a
            href="https://www.anandalibrary.org/content/ai-chatbot-intro/"
            className="text-blue-500 underline"
          >
            this page in the Ananda Library
          </a>
        </p>
      )}
      {siteConfig?.siteId === 'jairam' && (
        <p className="mt-4 text-center">
          For access, please contact the Free Joe Hunt team.
        </p>
      )}
      <p className="mt-4">
        <a
          href="https://github.com/anandaworldwide/ananda-library-chatbot"
          className="text-blue-400 hover:underline mx-2"
        >
          Open Source Project
        </a>
      </p>
    </div>
  );
}
