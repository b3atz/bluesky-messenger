// Updated LoginBox.tsx component with debug logging and session validation

'use client';

import { useState, useEffect } from 'react';
import { BskyAgent } from '@atproto/api';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import styles from './LoginBox.module.css';

// Enhanced error messages
const ERROR_MESSAGES = {
    INVALID_CREDENTIALS: 'Invalid username or password. Please try again.',
    CONNECTION_ERROR: 'Could not connect to Bluesky API. Please check your internet connection.',
    SERVER_ERROR: 'Bluesky API server error. Please try again later.',
    RATE_LIMIT: 'Too many login attempts. Please try again later.',
    UNKNOWN_ERROR: 'An unexpected error occurred. Please check the console for details.',
    AUTH_NOT_SUPPORTED: 'Demo Mode: Authentication is simulated. No actual Bluesky connection.',
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
    const { login, isAuthenticated, user, loading } = useAuth();
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showPrivacy, setShowPrivacy] = useState(false);
    const [debugInfo, setDebugInfo] = useState<string>('');
    const [demoMode, setDemoMode] = useState(false);
    const router = useRouter();

    // Add debug logging
    const logDebug = (message: string) => {
        console.log(message);
        setDebugInfo(prev => `${new Date().toISOString().substring(11, 19)} - ${message}\n${prev}`);
    };

    // Check if user is already authenticated
    useEffect(() => {
        // Check if already authenticated and redirect if so
        if (isAuthenticated && user) {
            logDebug(`Already authenticated as ${user.handle}, redirecting to messages`);
            router.push('/messages');
        } else {
            logDebug('Not authenticated or no user data');

            // Check for existing session in localStorage as a fallback
            try {
                const existingSession = localStorage.getItem('bsky_session');
                if (existingSession) {
                    const sessionData = JSON.parse(existingSession);
                    if (sessionData?.did && sessionData?.handle) {
                        logDebug(`Found session in localStorage for ${sessionData.handle}, attempting to use it`);
                    }
                } else {
                    logDebug('No existing session found in localStorage');
                }
            } catch (e) {
                logDebug(`Error checking localStorage: ${e instanceof Error ? e.message : 'Unknown error'}`);
            }
        }
    }, [isAuthenticated, user, router]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        logDebug(`Attempting login for ${identifier}...`);

        try {
            if (demoMode) {
                logDebug('Using demo mode login');
                handleDemoLogin();
                return;
            }

            // Try to login using the auth context
            const success = await login(identifier, password);

            if (success) {
                logDebug('Login successful! Redirecting to messages page');

                // Add animation class before redirect
                document.querySelector(`.${styles.loginContainer}`)?.classList.add(styles.exitAnimation);

                // Delay redirect to show animation
                setTimeout(() => {
                    // Redirect to the messages page
                    router.push('/hub');
                }, 500);
            } else {
                logDebug('Login failed - check credentials');
                setError(ERROR_MESSAGES.INVALID_CREDENTIALS);
            }
        } catch (err) {
            console.error('Login error:', err);
            logDebug(`Login error: ${err instanceof Error ? err.message : 'Unknown error'}`);

            let errorMessage = ERROR_MESSAGES.UNKNOWN_ERROR;

            if (err instanceof Error) {
                if (err.message.includes('network') || err.message.includes('connect') || err.message.includes('ECONNREFUSED')) {
                    errorMessage = ERROR_MESSAGES.CONNECTION_ERROR;
                } else if (err.message.includes('Authentication') || err.message.includes('credentials')) {
                    errorMessage = ERROR_MESSAGES.INVALID_CREDENTIALS;
                } else if (err.message.includes('429') || err.message.includes('rate limit')) {
                    errorMessage = ERROR_MESSAGES.RATE_LIMIT;
                } else if (err.message.includes('500') || err.message.includes('server error')) {
                    errorMessage = ERROR_MESSAGES.SERVER_ERROR;
                }
            }

            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDemoLogin = () => {
        setIsLoading(true);
        setError(null);
        logDebug('Demo Mode: Creating simulated session...');

        // Create a simulated session
        setTimeout(() => {
            // Create mock session data
            const mockSession = {
                did: 'did:plc:demo1234567890',
                handle: identifier || 'demo.user.bsky.social',
                email: 'demo@example.com',
                accessJwt: 'mock_jwt_token',
                refreshJwt: 'mock_refresh_token',
            };

            // Store mock session
            localStorage.setItem('bsky_session', JSON.stringify(mockSession));

            logDebug('Demo session created, redirecting to messages');

            // Add animation class before redirect
            document.querySelector(`.${styles.loginContainer}`)?.classList.add(styles.exitAnimation);

            // Redirect after animation
            setTimeout(() => {
                router.push('/messages');
            }, 500);

            setIsLoading(false);
        }, 1500);
    };

    return (
        <div className={styles.pageContainer}>
            <div className={styles.backgroundDecoration}></div>
            <div className={styles.loginContainer}>
                <div className={styles.logoContainer}>
                    <div className={styles.logo}>
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                            stroke="currentColor"
                            className={styles.logoIcon}
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
                            />
                        </svg>
                    </div>
                    <h2 className={styles.title}>Private Messaging for Bluesky</h2>
                    <p className={styles.subtitle}>Sign in directly with your Bluesky account</p>
                </div>

                {error && (
                    <div className={styles.errorMessage}>
                        {error}
                    </div>
                )}

                {/* Debug info */}
                {/*
                {debugInfo && (
                    <div className={styles.debugInfo || 'bg-gray-800 text-xs text-gray-300 p-1 max-h-20 overflow-auto font-mono'}>
                        <details>
                            <summary className="cursor-pointer p-1 bg-gray-700">Debug Log</summary>
                            <pre className="p-1 whitespace-pre-wrap">{debugInfo}</pre>
                        </details>
                    </div>
                )}
                */}

                <form className={styles.form} onSubmit={handleLogin}>
                    <div className={styles.inputGroup}>
                        <label htmlFor="identifier" className={styles.label}>
                            Username or Email
                        </label>
                        <input
                            id="identifier"
                            name="identifier"
                            type="text"
                            required
                            value={identifier}
                            onChange={(e) => setIdentifier(e.target.value)}
                            className={styles.input}
                            placeholder="username.bsky.social"
                        />
                    </div>

                    <div className={styles.inputGroup}>
                        <label htmlFor="password" className={styles.label}>
                            Password
                        </label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className={styles.input}
                            placeholder="••••••••"
                        />
                    </div>

                    <div className={styles.privacyContainer}>
                        <button
                            type="button"
                            className={styles.privacyToggle}
                            onClick={() => setShowPrivacy(!showPrivacy)}
                        >
                            {showPrivacy ? 'Hide Privacy Notice' : 'Show Privacy Notice'}
                        </button>

                        <div className={`${styles.privacyContent} ${showPrivacy ? styles.expanded : ''}`}>
                            <h4 className={styles.privacyTitle}>Privacy Notice:</h4>
                            <p className={styles.privacyText}>{PRIVACY_NOTICE}</p>
                        </div>
                    </div>

                    <div className={styles.buttonGroup}>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className={styles.submitButton}
                        >
                            {isLoading ? (
                                <span className={styles.loadingContainer}>
                                    <svg className={styles.loadingSpinner} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className={styles.loadingCircle} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className={styles.loadingPath} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Signing in...
                                </span>
                            ) : (
                                'Sign in'
                            )}
                        </button>
                    </div>
                </form>

                <div className={styles.signupContainer}>
                    <p className={styles.signupText}>
                        Don't have a Bluesky account?{' '}
                        <a
                            href="https://bsky.app/signup"
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.signupLink}
                        >
                            Sign up on Bluesky
                        </a>
                    </p>
                </div>
            </div>
        </div>
    );
}