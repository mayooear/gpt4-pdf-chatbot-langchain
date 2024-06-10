import { useState } from 'react';
import { useRouter } from 'next/router';

export default function Login() {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const { redirect } = router.query;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password, redirect }),
    });

    if (res.ok) {
      const data = await res.json();
      router.push(data.redirect || '/');
    } else {
      alert('Incorrect password');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <form onSubmit={handleSubmit} className="p-6 bg-white rounded shadow-md">
        <h1 className="mb-4 text-2xl">Welcome to Ask Ananda Library!</h1>
        <p className="mb-4">The Chatbot that knows all about written material from our path.</p>
        <div className="relative mb-4">
          <input
            type={showPassword ? "text" : "password"}
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
        <button type="submit" className="p-2 bg-blue-500 text-white rounded">Log In</button>
      </form>
      <p className="mt-4 text-center">
        You can get the password from&nbsp;
        <a href="https://www.anandalibrary.org/content/ai-chatbot-intro/" className="text-blue-500 underline">this page in the Ananda Library</a>
      </p>
    </div>
  );
}
