'use client';

import { useState } from 'react';
import { BskyAgent } from '@atproto/api';
import { useRouter } from 'next/navigation';
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
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showPrivacy, setShowPrivacy] = useState(false);
    const [debugInfo, setDebugInfo] = useState<string | null>(null);
    const [demoMode, setDemoMode] = useState(false);
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setDebugInfo(null);

        try {
            // Create a new Bluesky agent
            const agent = new BskyAgent({
                service: 'https://bsky.social',
            });

            console.log('Attempting to connect to Bluesky API...');
            setDebugInfo('Connecting to Bluesky API...');

            // Attempt to log in with the provided credentials
            const result = await agent.login({
                identifier,
                password,
            }).catch(err => {
                console.error('API call error:', err);
                setDebugInfo(`API call error: ${err.message || 'Unknown error'}`);
                throw err;
            });

            // If login is successful, save the session data
            if (result.success) {
                console.log('Login successful, storing session');
                setDebugInfo('Login successful, storing session');

                // Store session data in localStorage
                localStorage.setItem('bsky_session', JSON.stringify(agent.session));

                // Make a request to our own backend to establish user
                try {
                    console.log('Registering with messaging server...');
                    setDebugInfo('Registering with messaging server...');

                    const response = await fetch('http://localhost:3001/auth/login', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            did: agent.session?.did,
                            handle: agent.session?.handle,
                        }),
                        credentials: 'include',
                    });

                    if (!response.ok) {
                        console.warn('Failed to register with messaging server, but continuing');
                        setDebugInfo('Warning: Failed to register with messaging server, but continuing');
                    }
                } catch (err) {
                    console.error('Error registering with messaging server:', err);
                    setDebugInfo(`Warning: Error registering with messaging server: ${err instanceof Error ? err.message : 'Unknown error'}`);
                    // We can continue even if our backend registration fails
                }

                // Add animation class before redirect
                document.querySelector(`.${styles.loginContainer}`)?.classList.add(styles.exitAnimation);

                // Delay redirect to show animation
                setTimeout(() => {
                    // Redirect to the messages page
                    router.push('/messages');
                }, 500);
            } else {
                console.error('Login failed, no success flag in response');
                setDebugInfo('Login failed, no success flag in response');
                setError(ERROR_MESSAGES.INVALID_CREDENTIALS);
            }
        } catch (err) {
            console.error('Login error:', err);

            let errorMessage = ERROR_MESSAGES.UNKNOWN_ERROR;
            let debugMsg = err instanceof Error ? err.message : 'Unknown error';

            if (err instanceof Error) {
                setDebugInfo(`Error details: ${err.message}`);

                if (err.message.includes('network') || err.message.includes('connect') || err.message.includes('ECONNREFUSED')) {
                    errorMessage = ERROR_MESSAGES.CONNECTION_ERROR;
                    debugMsg = 'Network connection error. Check if backend server is running.';
                } else if (err.message.includes('Authentication') || err.message.includes('credentials')) {
                    errorMessage = ERROR_MESSAGES.INVALID_CREDENTIALS;
                    debugMsg = 'Authentication failed - invalid credentials';
                } else if (err.message.includes('429') || err.message.includes('rate limit')) {
                    errorMessage = ERROR_MESSAGES.RATE_LIMIT;
                    debugMsg = 'Rate limit exceeded';
                } else if (err.message.includes('500') || err.message.includes('server error')) {
                    errorMessage = ERROR_MESSAGES.SERVER_ERROR;
                    debugMsg = 'Bluesky API server error';
                }
            }

            setDebugInfo(debugMsg);
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleDemoLogin = () => {
        setLoading(true);
        setError(null);
        setDebugInfo('Demo Mode: Creating simulated session...');

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

            // Add animation class before redirect
            document.querySelector(`.${styles.loginContainer}`)?.classList.add(styles.exitAnimation);

            // Redirect after animation
            setTimeout(() => {
                router.push('/messages');
            }, 500);

            setLoading(false);
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

                {debugInfo && (
                    <div className={styles.debugInfo}>
                        <details>
                            <summary>Debug Info</summary>
                            <pre>{debugInfo}</pre>
                        </details>
                    </div>
                )}

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
                            disabled={loading}
                            className={styles.submitButton}
                        >
                            {loading ? (
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

                        <button
                            type="button"
                            onClick={handleDemoLogin}
                            className={styles.demoButton}
                            disabled={loading}
                        >
                            Demo Mode
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