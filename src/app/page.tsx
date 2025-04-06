// src/app/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

interface Source {
  name: string;
  tag: string;
  excerpt: string;
  sourcelink?: string;
  chapter_name: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
}

const hard_code_user_names = [
  'John Doe',
  'Jane Smith',
  'Alice Johnson',
  'Bob Brown',
  'Charlie Davis',
  'Diana Evans',
  'Ethan Foster',
  'Fiona Green',
  'George Harris',
  'Hannah Ives'
];


export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]); // Runs every time messages are updated

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    const randomUserName = hard_code_user_names[Math.floor(Math.random() * hard_code_user_names.length)];

    const userMessage: Message = {
      role: 'user',
      content: prompt
    };

    console.log('User message:', userMessage);

    setMessages([userMessage]); // Only show current message
    setLoading(true);
    setError(null);
    setPrompt('');

    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          user_name: randomUserName
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to get a response from backend');
      }

      const data = await res.json();

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.content,
        sources: data.sources
      };

      setMessages([userMessage, assistantMessage]); // Replace old messages with the new pair
    } catch (err: any) {
      console.error('Fetch error:', err.message);
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-200 fixed top-0 left-0 right-0 z-10 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link href="/" onClick={() => setMessages([])} className="text-xl font-bold text-gray-900 hover:underline">
            Tax Copilot
          </Link>
          <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
            <span className="text-gray-600">U</span>
          </div>
        </div>
      </header>

      {/* Chat Messages */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 mt-16 mb-24 overflow-auto">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6" role="alert">
            <strong className="font-bold">Error:</strong> <span className="block sm:inline">{error}</span>
          </div>
        )}
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <p className="text-2xl text-gray-900">
              What do you want to search today?
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {messages.map((message, index) => (
              <div key={index} className="space-y-4">
                < div ref={messagesEndRef} />
                {message.role === 'user' ? (
                  <h2 className="text-3xl font-semibold text-gray-900">
                    {message.content}
                  </h2>
                ) : (
                  <div className="space-y-6">
                    {/* Sources section with official and web sources separated */}
                    {message.sources && (
                      <div className="flex flex-col gap-3">
                        {/* Official sources row */}
                        <div className="flex flex-wrap gap-3">
                          {message.sources
                            .filter(source => source.tag === 'official')
                            .map((source, idx) => (
                              <a
                                key={idx}
                                href={source.sourcelink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group relative cursor-pointer no-underline"
                              >
                                {/* Base tag (always visible) */}
                                <div className="flex items-center rounded-full px-4 py-2 bg-blue-50">
                                  <span className="text-sm text-gray-900">{source.name}</span>
                                  <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-blue-600 text-white">
                                    {source.tag}
                                  </span>
                                </div>

                                {/* Expanded box (visible on hover) */}
                                <div className="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200 absolute top-0 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg p-4 min-w-[300px] z-20">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="font-medium text-gray-900">{source.name}</span>
                                    <span className="px-2 py-0.5 rounded-full text-xs bg-blue-600 text-white">
                                      {source.tag}
                                    </span>
                                  </div>
                                  <p className="text-sm text-gray-600">{source.excerpt}</p>
                                </div>
                              </a>
                            ))}
                        </div>

                        {/* Web sources row */}
                        <div className="flex flex-wrap gap-3">
                          {message.sources
                            .filter(source => source.tag === 'web')
                            .map((source, idx) => (
                              <a
                                key={idx}
                                href={source.sourcelink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group relative cursor-pointer no-underline"
                              >
                                {/* Base tag (always visible) */}
                                <div className="flex items-center rounded-full px-4 py-2 bg-green-50">
                                  <span className="text-sm text-gray-900">{source.name}</span>
                                  <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-green-600 text-white">
                                    {source.tag}
                                  </span>
                                </div>

                                {/* Expanded box (visible on hover) */}
                                <div className="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200 absolute top-0 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg p-4 min-w-[300px] z-20">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="font-medium text-gray-900">{source.name}</span>
                                    <span className="px-2 py-0.5 rounded-full text-xs bg-green-600 text-white">
                                      {source.tag}
                                    </span>
                                  </div>
                                  <p className="text-sm text-gray-600">{source.excerpt}</p>
                                </div>
                              </a>
                            ))}
                        </div>
                      </div>
                    )}
                    {/* <p className="text-gray-900 text-lg">
                      {message.content}
                    </p> */}
                    <p className="text-gray-900 text-lg">
                      {message.content.split("\n").map((line, index) => (
                        <span key={index}>
                          {line}
                          <br />
                        </span>
                      ))}
                    </p>
                  </div>
                )}{loading && (
                  <div className="flex items-center space-x-2 text-gray-600 text-lg">
                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <span>Generating response...</span>
                  </div>
                )}

              </div>
            ))}
          </div>
        )}
      </main>

      {/* Pill-shaped Input Box */}
      <div className="fixed bottom-4 left-0 right-0 px-4">
        <form onSubmit={handleSubmit} className="max-w-7xl mx-auto">
          <div className="relative">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full px-6 py-4 text-gray-900 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 pr-24"
              placeholder="Type your message here..."
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 px-6 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
            >
              Submit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}