import { SiteConfig } from '@/types/siteConfig';
import React, { useState } from 'react';
import Layout from '@/components/layout';
import Link from 'next/link';

interface ContactProps {
  siteConfig: SiteConfig | null;
}

const Contact = ({ siteConfig }: ContactProps) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      alert('Failed to send message.');
    }
  };

  return (
    <Layout siteConfig={siteConfig}>
      <div className="container mx-auto p-4">
        <h1 className="text-2xl mb-4">Contact Us</h1>
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
