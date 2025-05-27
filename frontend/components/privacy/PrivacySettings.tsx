'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { BskyAgent, AtpSessionData, AtpSessionEvent } from '@atproto/api';

// Define the type for our authentication context
interface AuthContextType {
  isAuthenticated: boolean;
  user: {
    did: string;
    handle: string;
  } | null;
  agent: BskyAgent | null;
  login: (identifier: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  loading: boolean;
  error: string | null;
}

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
export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<{ did: string; handle: string } | null>(null);
  const [agent, setAgent] = useState<BskyAgent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize auth state from stored session on component mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const storedSession = localStorage.getItem('bsky_session');

        if (!storedSession) {
          setLoading(false);
          return;
        }

        const sessionData = JSON.parse(storedSession) as AtpSessionData;
        const newAgent = new BskyAgent({
          service: 'https://bsky.social',
          persistSession: (evt: AtpSessionEvent, session?: AtpSessionData) => {
            if (evt === 'create' || evt === 'update') {
              if (session) {
                localStorage.setItem('bsky_session', JSON.stringify(session));
              }
            } else if (evt === 'expired' || evt === 'delete' || evt === 'create-failed') {
              localStorage.removeItem('bsky_session');
              setIsAuthenticated(false);
              setUser(null);
            }
          },
        });

        // Resume session
        await newAgent.resumeSession(sessionData);

        // Check if session is valid
        const { success } = await newAgent.getProfile({ actor: sessionData.did });

        if (success) {
          setAgent(newAgent);
          setUser({
            did: sessionData.did,
            handle: sessionData.handle,
          });
          setIsAuthenticated(true);
        } else {
          // Session is invalid, clear it
          localStorage.removeItem('bsky_session');
        }
      } catch (err) {
        console.error('Error initializing auth:', err);
        localStorage.removeItem('bsky_session');
        setError('Session expired. Please login again.');
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  // Login function
  const login = async (identifier: string, password: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      // Create a new agent if one doesn't exist
      const newAgent = agent || new BskyAgent({
        service: 'https://bsky.social',
        persistSession: (evt: AtpSessionEvent, session?: AtpSessionData) => {
          if (evt === 'create' || evt === 'update') {
            if (session) {
              localStorage.setItem('bsky_session', JSON.stringify(session));
            }
          } else if (evt === 'expired' || evt === 'delete' || evt === 'create-failed') {
            localStorage.removeItem('bsky_session');
            setIsAuthenticated(false);
            setUser(null);
          }
        },
      });

      const result = await newAgent.login({
        identifier,
        password,
      });

      if (result.success) {
        setAgent(newAgent);
        setUser({
          did: newAgent.session!.did,
          handle: newAgent.session!.handle,
        });
        setIsAuthenticated(true);

        // Register with our backend
        try {
          const response = await fetch('http://localhost:3001/auth/login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              did: newAgent.session?.did,
              handle: newAgent.session?.handle,
            }),
            credentials: 'include',
          });

          if (!response.ok) {
            console.error('Failed to register with messaging server, but continuing');
          }
        } catch (err) {
          console.error('Error registering with messaging server:', err);
          // We can continue even if our backend registration fails
        }

        return true;
      }

      setError('Login failed. Please check your credentials.');
      return false;
    } catch (err) {
      console.error('Login error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Logout function
  const logout = async (): Promise<void> => {
    setLoading(true);

    try {
      if (agent && agent.session) {
        // The AT Protocol SDK doesn't have a logout method,
        // so we'll just remove the session
        localStorage.removeItem('bsky_session');
      }

      // Also log out from our backend
      try {
        await fetch('http://localhost:3001/auth/logout', {
          method: 'POST',
          credentials: 'include',
        });
      } catch (err) {
        console.error('Error logging out from messaging server:', err);
      }

      setAgent(null);
      setUser(null);
      setIsAuthenticated(false);
    } catch (err) {
      console.error('Logout error:', err);
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
export const useAuth = () => useContext(AuthContext);


// Custom hook for using the auth context
export const useAuth = () => useContext(AuthContext);