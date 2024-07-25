import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import Layout from '@/components/layout';
import Head from 'next/head';

// Dynamically import the ReCAPTCHA component
// const ReCAPTCHA = dynamic(() => import('react-google-recaptcha'), { ssr: false });

const Contact: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  // const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // if (!recaptchaToken) {
    //   alert('Please complete the reCAPTCHA.');
    //   return;
    // }
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, email, message /*, recaptchaToken */ }),
    });
    if (res.ok) {
      alert('Message sent! We will get back to you soon.');
      setName('');
      setEmail('');
      setMessage('');
      // setRecaptchaToken(null);
    } else {
      alert('Failed to send message.');
    }
  };

  return (
    <Layout>
      <Head>
        <title>Contact Us</title>
        {/* <script src="https://www.google.com/recaptcha/api.js" async defer></script> */}
      </Head>
      <div className="container mx-auto p-4">
        <h1 className="text-2xl mb-4">Contact Us</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex space-x-4">
            <div className="w-1/2">
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm"
                required
              />
            </div>
            <div className="w-1/2">
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm h-48"
              required
            />
          </div>
          {/* <ReCAPTCHA
            sitekey="::YOUR_RECAPTCHA_SITE_KEY::"
            onChange={(token) => setRecaptchaToken(token)}
          /> */}
          <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded-md">Send</button>
        </form>
      </div>
    </Layout>
  );
};
export default Contact;