import { SiteConfig } from '@/types/siteConfig';
import React, { useState } from 'react';
import Layout from '@/components/layout';
import Link from 'next/link';
import validator from 'validator';

interface ContactProps {
  siteConfig: SiteConfig | null;
}

const Contact = ({ siteConfig }: ContactProps) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateInputs = () => {
    if (!validator.isLength(name, { min: 1, max: 100 })) {
      setError('Name must be between 1 and 100 characters');
      return false;
    }
    if (!validator.isEmail(email)) {
      setError('Invalid email address');
      return false;
    }
    if (!validator.isLength(message, { min: 1, max: 1000 })) {
      setError('Message must be between 1 and 1000 characters');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateInputs()) {
      return;
    }

    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, email, message }),
    });
    if (res.ok) {
      setIsSubmitted(true);
    } else {
      const data = await res.json();
      setError(data.message || 'Failed to send message.');
    }
  };

  return (
    <Layout siteConfig={siteConfig}>
      <div className="container mx-auto p-4">
        <h1 className="text-2xl mb-4">Contact Us</h1>
        {error && (
          <div
            className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4"
            role="alert"
          >
            <span className="block sm:inline">{error}</span>
          </div>
        )}
        <form
          onSubmit={handleSubmit}
          className={`space-y-4 ${isSubmitted ? 'opacity-50 pointer-events-none' : ''}`}
        >
          <div className="flex space-x-4">
            <div className="w-1/2">
              <label className="block text-sm font-medium text-gray-700">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm"
                required
                disabled={isSubmitted}
                maxLength={100}
              />
            </div>
            <div className="w-1/2">
              <label className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm"
                required
                disabled={isSubmitted}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm h-48"
              required
              disabled={isSubmitted}
              maxLength={1000}
            />
          </div>
          <button
            type="submit"
            className="bg-blue-500 text-white px-4 py-2 rounded-md"
            disabled={isSubmitted}
          >
            Send
          </button>
        </form>
        {isSubmitted && (
          <div className="mt-8 text-center">
            <h2 className="text-xl font-semibold text-green-600 mb-4">
              Thanks, message sent!
            </h2>
            <Link
              href="/"
              className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition-colors"
            >
              Go to Homepage
            </Link>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Contact;
