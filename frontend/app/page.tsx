'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './HomePage.module.css';

export default function HomePage(): JSX.Element {
  const router = useRouter();

  // Redirect to login page after animation completes
  useEffect(() => {
    const timer = setTimeout(() => {
      router.push('/login');
    }, 3000); // Time for animation to complete

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className={styles.container}>
      <div className={styles.backgroundCircles}>
        <div className={`${styles.circle} ${styles.circle1}`}></div>
        <div className={`${styles.circle} ${styles.circle2}`}></div>
        <div className={`${styles.circle} ${styles.circle3}`}></div>
      </div>

      <div className={styles.content}>
        <div className={styles.logoContainer}>
          <div className={styles.logoWrap}>
            <div className={styles.logoPulse}></div>
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
          </div>
        </div>

        <h1 className={styles.title}>Bluesky Messenger</h1>

        <p className={styles.subtitle}>
          Private messaging for the decentralized social network
        </p>

        <div className={styles.loadingBar}>
          <div className={styles.loadingProgress}></div>
        </div>
      </div>
    </div>
  );
}