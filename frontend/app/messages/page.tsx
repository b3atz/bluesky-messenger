// File: frontend/app/messages/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
// Use lowercase 'messages' to match the file name case
import Messages from '../../components/messages/messages';

export default function MessagesPage(): JSX.Element {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Return a fragment with a conditional to satisfy TypeScript
  // This fixes the "Type 'null' is not assignable to type 'Element'" error
  return (
    <>
      {!isAuthenticated ? (
        <div className="hidden">Loading...</div>
      ) : (
        <Messages />
      )}
    </>
  );
}