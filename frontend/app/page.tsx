  // File: frontend/app/page.tsx
  'use client';

  import { useEffect } from 'react';
  import { useRouter } from 'next/navigation';

  export default function Home(): JSX.Element {
    const router = useRouter();

    // Redirect to login page after a brief display of the landing page
    useEffect(() => {
      const timer = setTimeout(() => {
        router.push('/login_init');
      }, 2000);

      return () => clearTimeout(timer);
    }, [router]);

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
        <div className="text-center">
          <div className="w-24 h-24 mx-auto mb-6 relative">
            <div className="absolute inset-0 rounded-full bg-blue-100 dark:bg-blue-900 animate-pulse"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-12 h-12 text-blue-600 dark:text-blue-300"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
                />
              </svg>
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Bluesky Messenger
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Private messaging for the decentralized social network
          </p>
        </div>
      </div>
    );
  }