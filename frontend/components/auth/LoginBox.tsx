'use client';

import { useState } from 'react';
import { BskyAgent } from '@atproto/api';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

// Error messages to display to the user
const ERROR_MESSAGES = {
    INVALID_CREDENTIALS: 'Invalid username or password. Please try again.',
    CONNECTION_ERROR: 'Could not connect to Bluesky. Please check your internet connection and try again.',
    UNKNOWN_ERROR: 'An unexpected error occurred. Please try again later.',
};

// Privacy notice text
const PRIVACY_NOTICE = `
This app only uses your Bluesky credentials to authenticate directly with the Bluesky API.
Your password is never stored by this application.
We only store your DID (Decentralized Identifier) and handle to enable messaging functionality.
All messages are end-to-end encrypted and cannot be read by our servers.
Your encryption keys are generated locally and stored only on your device.
`;


export default function LoginBox() {
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // Create a new Bluesky agent
            const agent = new BskyAgent({
                service: 'https://bsky.social',
            });

            // Attempt to log in with the provided credentials
            const result = await agent.login({
                identifier,
                password,
            });

            // If login is successful, save the session data
            if (result.success) {
                // Store session data in localStorage (consider more secure options for production)
                localStorage.setItem('bsky_session', JSON.stringify(agent.session));

                // Make a request to our own backend to establish user
                try {
                    const response = await fetch('http://localhost:3001/auth/login', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            did: agent.session?.did,
                            handle: agent.session?.handle,
                            // Don't send access token to our backend for security
                            // We'll use the DID as the identifier
                        }),
                        credentials: 'include',
                    });

                    if (!response.ok) {
                        throw new Error('Failed to register with messaging server');
                    }
                } catch (err) {
                    console.error('Error registering with messaging server:', err);
                    // We can still proceed even if our backend registration fails
                    // The user will just not have access to private messages yet
                }

                // Redirect to the messages page
                router.push('/messages');
            } else {
                setError(ERROR_MESSAGES.INVALID_CREDENTIALS);
            }
        } catch (err) {
            console.error('Login error:', err);

            if (err instanceof Error) {
                if (err.message.includes('network') || err.message.includes('connect')) {
                    setError(ERROR_MESSAGES.CONNECTION_ERROR);
                } else if (err.message.includes('Authentication') || err.message.includes('credentials')) {
                    setError(ERROR_MESSAGES.INVALID_CREDENTIALS);
                } else {
                    setError(ERROR_MESSAGES.UNKNOWN_ERROR);
                }
            } else {
                setError(ERROR_MESSAGES.UNKNOWN_ERROR);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-md p-8 space-y-8 bg-white dark:bg-gray-800 rounded-xl shadow-md">
            <div className="text-center">
                <Image
                    src="/bluesky-logo.svg"
                    alt="Bluesky Messenger"
                    width={64}
                    height={64}
                    className="mx-auto"
                    priority
                />
                <h2 className="mt-6 text-3xl font-bold text-gray-900 dark:text-white">
                    Private Messaging for Bluesky
                </h2>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    Sign in directly with your Bluesky account
                </p>
            </div>

            {error && (
                <div className="p-4 text-sm text-red-800 bg-red-100 dark:bg-red-900/30 dark:text-red-200 rounded-lg">
                    {error}
                </div>
            )}

            <form className="mt-8 space-y-6" onSubmit={handleLogin}>
                <div className="space-y-4">
                    <div>
                        <label htmlFor="identifier" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Username or Email
                        </label>
                        <input
                            id="identifier"
                            name="identifier"
                            type="text"
                            required
                            value={identifier}
                            onChange={(e) => setIdentifier(e.target.value)}
                            className="w-full px-3 py-2 mt-1 text-gray-900 placeholder-gray-500 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:border-gray-600"
                            placeholder="username.bsky.social"
                        />
                    </div>

                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Password
                        </label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-3 py-2 mt-1 text-gray-900 placeholder-gray-500 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:border-gray-600"
                            placeholder="••••••••"
                        />
                    </div>
                </div>

                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                    <h4 className="font-bold mb-1">Privacy Notice:</h4>
                    <p>{PRIVACY_NOTICE}</p>
                </div>

                <div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <span className="flex items-center">
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Signing in...
                            </span>
                        ) : (
                            'Sign in'
                        )}
                    </button>
                </div>
            </form>

            <div className="text-center mt-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    Don't have a Bluesky account?{' '}
                    <a
                        href="https://bsky.app/signup"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
                    >
                        Sign up on Bluesky
                    </a>
                </p>
            </div>
        </div>
    );
}