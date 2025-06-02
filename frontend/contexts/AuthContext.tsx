// frontend/contexts/AuthContext.tsx - Updated for Heroku deployment
'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { BskyAgent, AtpSessionData, AtpSessionEvent } from '@atproto/api';

// Define the interface for a user
interface User {
  did: string;
  handle: string;
}

// Define the type for our authentication context
interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  agent: BskyAgent | null;
  login: (identifier: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  loading: boolean;
  error: string | null;
}

// Props for the AuthProvider component
interface AuthProviderProps {
  children: ReactNode;
}

// Get API URL - in production, use same origin as frontend
const getApiUrl = (): string => {
  if (typeof window !== 'undefined') {
    // In browser, use current origin for API calls
    return window.location.origin;
  }

  // Server-side fallback
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
};

// Create the context with a default value
const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  user: null,
  agent: null,
  login: async () => false,
  logout: async () => { },
  loading: true,
  error: null,
});

// Provider component that wraps app and makes auth available to any child component
export function AuthProvider({ children }: AuthProviderProps): JSX.Element {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(null);
  const [agent, setAgent] = useState<BskyAgent | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState<boolean>(false);

  // Add log function for debugging
  const logAuth = (message: string, data?: any) => {
    console.log(`[Auth] ${message}`, data || '');
  };

  // Helper function to register with backend - sends full session data including tokens
  const registerWithBackend = async (sessionData: AtpSessionData): Promise<boolean> => {
    try {
      const apiUrl = getApiUrl();
      logAuth(`Attempting backend registration at ${apiUrl}`, {
        did: sessionData.did,
        handle: sessionData.handle,
        hasTokens: !!(sessionData.accessJwt && sessionData.refreshJwt)
      });

      const response = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          did: sessionData.did,
          handle: sessionData.handle,
          accessJwt: sessionData.accessJwt,
          refreshJwt: sessionData.refreshJwt,
          email: sessionData.email || undefined,
          active: true
        }),
        credentials: 'include',
      });

      if (response.ok) {
        const result = await response.json();
        logAuth('Backend registration successful', result);

        // Wait for cookie to be properly set  
        logAuth('Waiting for backend session to be established...');
        await new Promise(resolve => setTimeout(resolve, 1200));

        // Verify the session was created with AT Protocol capabilities
        const verifyResponse = await fetch(`${apiUrl}/auth/debug`, {
          credentials: 'include'
        });

        if (verifyResponse.ok) {
          const verifyData = await verifyResponse.json();
          logAuth('Backend session verification', verifyData);

          if (verifyData.authenticated && verifyData.hasTokens) {
            logAuth('✅ Backend session is ready with AT Protocol tokens');
            return true;
          } else if (verifyData.authenticated) {
            logAuth('⚠️ Backend session authenticated but no AT Protocol tokens');
            return true;
          } else {
            logAuth('❌ Backend session not authenticated after registration');
            return false;
          }
        } else {
          logAuth('❌ Backend session verification failed');
          return false;
        }
      } else {
        const errorText = await response.text();
        logAuth(`Backend registration failed: ${response.status}`, errorText);
        return false;
      }
    } catch (err) {
      logAuth(`Backend registration error:`, err);
      return false;
    }
  };

  // Initialize auth state from stored session on component mount
  useEffect(() => {
    const initializeAuth = async (): Promise<void> => {
      logAuth('Initializing auth context');
      try {
        // Check for stored session
        const storedSession = localStorage.getItem('bsky_session');

        if (!storedSession) {
          logAuth('No stored session found');
          setLoading(false);
          setInitialized(true);
          return;
        }

        logAuth('Found stored session, attempting to resume');
        const sessionData = JSON.parse(storedSession) as AtpSessionData;

        // Create a new agent
        const newAgent = new BskyAgent({
          service: 'https://bsky.social',
          persistSession: (evt: AtpSessionEvent, session?: AtpSessionData) => {
            if (evt === 'create' || evt === 'update') {
              if (session) {
                logAuth(`Persisting session for ${session.handle}`);
                localStorage.setItem('bsky_session', JSON.stringify(session));
              }
            } else if (['expired', 'delete', 'create-failed'].includes(evt)) {
              logAuth(`Session event: ${evt}, clearing session`);
              localStorage.removeItem('bsky_session');
              setIsAuthenticated(false);
              setUser(null);
            }
          },
        });

        try {
          // Resume session
          logAuth('Resuming session with stored credentials');
          await newAgent.resumeSession(sessionData);

          // Check if session is valid by making a simple request
          logAuth('Verifying session validity');
          const { success } = await newAgent.getProfile({ actor: sessionData.did });

          if (success) {
            logAuth(`Session valid for ${sessionData.handle}`);

            // Register with backend using full session data
            const backendSuccess = await registerWithBackend(sessionData);

            if (backendSuccess) {
              logAuth('Existing session registered with backend successfully');
            } else {
              logAuth('Backend registration failed but continuing with frontend-only session');
            }

            setAgent(newAgent);
            setUser({
              did: sessionData.did,
              handle: sessionData.handle,
            });
            setIsAuthenticated(true);
          } else {
            logAuth('Session verification failed');
            localStorage.removeItem('bsky_session');
          }
        } catch (sessionError) {
          logAuth(`Error resuming session:`, sessionError);
          localStorage.removeItem('bsky_session');
        }
      } catch (err) {
        console.error('Error initializing auth:', err);
        logAuth(`Error initializing auth:`, err);
        localStorage.removeItem('bsky_session');
        setError('Session expired. Please login again.');
      } finally {
        setLoading(false);
        setInitialized(true);
        logAuth('Auth initialization completed');
      }
    };

    if (!initialized) {
      initializeAuth();
    }
  }, [initialized]);

  // Login function
  const login = async (identifier: string, password: string): Promise<boolean> => {
    logAuth(`Login attempt for ${identifier}`);
    setLoading(true);
    setError(null);

    try {
      // Create a new agent if one doesn't exist
      const newAgent = agent || new BskyAgent({
        service: 'https://bsky.social',
        persistSession: (evt: AtpSessionEvent, session?: AtpSessionData) => {
          if (evt === 'create' || evt === 'update') {
            if (session) {
              logAuth(`Persisting session for ${session.handle}`);
              localStorage.setItem('bsky_session', JSON.stringify(session));
            }
          } else if (['expired', 'delete', 'create-failed'].includes(evt)) {
            logAuth(`Session event: ${evt}, clearing session`);
            localStorage.removeItem('bsky_session');
            setIsAuthenticated(false);
            setUser(null);
          }
        },
      });

      logAuth('Calling Bluesky API login method');
      const result = await newAgent.login({
        identifier,
        password,
      });

      if (result.success) {
        logAuth(`Login successful for ${newAgent.session?.handle}`);

        // Save session info
        if (newAgent.session) {
          localStorage.setItem('bsky_session', JSON.stringify(newAgent.session));
          logAuth('Session saved to localStorage');
        }

        // Register with backend using full session data
        const backendSuccess = await registerWithBackend(newAgent.session!);

        if (!backendSuccess) {
          logAuth('⚠️ Backend registration failed, but continuing with frontend-only session');
        }

        // Set auth state AFTER backend registration attempt
        setAgent(newAgent);
        setUser({
          did: newAgent.session!.did,
          handle: newAgent.session!.handle,
        });
        setIsAuthenticated(true);

        return true;
      }

      logAuth('Login failed: No success flag in response');
      setError('Login failed. Please check your credentials.');
      return false;
    } catch (err) {
      console.error('Login error:', err);
      logAuth(`Login error:`, err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Logout function
  const logout = async (): Promise<void> => {
    logAuth('Logout requested');
    setLoading(true);

    try {
      if (agent && agent.session) {
        logAuth('Removing session from localStorage');
        localStorage.removeItem('bsky_session');
      }

      // Also log out from our backend
      try {
        const apiUrl = getApiUrl();
        logAuth(`Attempting to logout from backend server at ${apiUrl}`);
        await fetch(`${apiUrl}/auth/logout`, {
          method: 'POST',
          credentials: 'include',
        });
        logAuth('Backend logout successful');
      } catch (err) {
        logAuth(`Error logging out from backend:`, err);
      }

      setAgent(null);
      setUser(null);
      setIsAuthenticated(false);
      logAuth('Logout complete');
    } catch (err) {
      console.error('Logout error:', err);
      logAuth(`Logout error:`, err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred during logout');
    } finally {
      setLoading(false);
    }
  };

  // Create the value object to provide to consumers
  const value = {
    isAuthenticated,
    user,
    agent,
    login,
    logout,
    loading,
    error,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Custom hook for using the auth context
export const useAuth = (): AuthContextType => useContext(AuthContext);