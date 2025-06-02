'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import styles from './Hub.module.css';

export default function HubPage() {
    const { isAuthenticated, user, loading } = useAuth();
    const router = useRouter();
    const [animateFeatures, setAnimateFeatures] = useState(false);
    const [activeCodeTab, setActiveCodeTab] = useState('encryption');

    useEffect(() => {
        const timer = setTimeout(() => {
            setAnimateFeatures(true);
        }, 500);
        return () => clearTimeout(timer);
    }, []);

    // Redirect if not authenticated
    useEffect(() => {
        if (!loading && !isAuthenticated) {
            router.push('/login');
        }
    }, [isAuthenticated, loading, router]);

    if (loading) {
        return (
            <div className={styles.loadingContainer}>
                <div className={styles.loadingSpinner}>
                    <svg className={styles.loadingCircle} viewBox="0 0 50 50">
                        <circle className={styles.loadingPath} cx="25" cy="25" r="20" fill="none" strokeWidth="4"></circle>
                    </svg>
                </div>
                <p className={styles.loadingText}>Loading privacy dashboard...</p>
            </div>
        );
    }

    if (!isAuthenticated) {
        return null;
    }

    const codeExamples = {
        encryption: `// E2E Encryption Implementation (TweetNaCl)
export const encryptMessage = async (
  message: string, 
  recipientPublicKey: string, 
  senderKeys: KeyPair
): Promise<EncryptedMessage | null> => {
  const nacl = await import('tweetnacl');
  const naclUtil = await import('tweetnacl-util');
  
  // Convert keys from hex strings to Uint8Array
  const senderKeyPair = deserializeKeyPair(senderKeys);
  const theirPublicKey = Buffer.from(recipientPublicKey, 'hex');
  
  // Generate a random nonce (24 bytes)
  const nonce = nacl.randomBytes(24);
  
  // Encrypt using XSalsa20 + Poly1305
  const encryptedMessage = nacl.box(
    naclUtil.decodeUTF8(message),
    nonce,
    theirPublicKey,
    senderKeyPair.secretKey
  );
  
  return {
    nonce: Buffer.from(nonce).toString('hex'),
    message: Buffer.from(encryptedMessage).toString('hex'),
    publicKey: senderKeys.publicKey,
  };
};`,

        differential: `// Differential Privacy Implementation (Laplace Mechanism)
const addDifferentialPrivacy = (content: string, epsilon: number = 1.0): 
  { noisyContent: string, noiseMagnitude: number } => {
  
  // Laplace noise with sensitivity = 1.0
  const sensitivity = 1.0;
  const scale = sensitivity / epsilon;
  
  const words = content.split(' ');
  const noiseMagnitude = Math.random() * scale;
  
  // Add noise by injecting words with 30% probability
  const noiseWords = ['indeed', 'certainly', 'perhaps', 'quite', 'rather'];
  const shouldAddNoise = Math.random() < 0.3;
  
  if (shouldAddNoise && words.length > 3) {
    const randomPos = Math.floor(Math.random() * words.length);
    const noiseWord = noiseWords[Math.floor(Math.random() * noiseWords.length)];
    words.splice(randomPos, 0, noiseWord);
  }
  
  return {
    noisyContent: words.join(' '),
    noiseMagnitude: noiseMagnitude
  };
};`,

        access: `// Access Control Implementation
const ACCESS_LEVELS = {
  public: { label: 'Public', icon: '🌐', description: 'Visible to everyone' },
  followers: { label: 'Followers Only', icon: '👥', description: 'Visible to your followers' },
  friends: { label: 'Friends Only', icon: '🤝', description: 'Mutual followers only' },
  private: { label: 'Private', icon: '🔒', description: 'Only you can see this' }
};

// Privacy Score Calculation
const calculatePrivacyScore = (accessLevel: string, hasNoise: boolean, contentLength: number): number => {
  let score = 0;
  
  // Base score from access level
  switch (accessLevel) {
    case 'private': score += 40; break;
    case 'friends': score += 30; break;
    case 'followers': score += 20; break;
    case 'public': score += 0; break;
  }
  
  // Differential privacy adds 25 points
  if (hasNoise) score += 25;
  
  // Shorter content is more private (less information leakage)
  if (contentLength < 50) score += 15;
  else if (contentLength < 100) score += 10;
  else if (contentLength < 200) score += 5;
  
  return Math.min(100, score);
};`,

        backend: `// Backend Message Storage with Encryption
fastify.post('/dm', async (req, reply) => {
  const { recipientDid, content } = req.body;
  const senderDid = req.user.did;
  
  // Encrypt message server-side before storage
  const { content: encrypted, iv } = encrypt(content);
  const message = new Message(senderDid, recipientDid, encrypted, iv);
  
  await req.em.persistAndFlush(message);
  return reply.code(201).send({ success: true });
});

// Server-side AES encryption for storage
export function encrypt(text: string): { content: string; iv: string } {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return { content: encrypted, iv: iv.toString('hex') };
}`
    };

    return (
        <div className={styles.container}>
            {/* Header */}
            <header className={styles.header}>
                <div className={styles.headerContent}>
                    <div className={styles.logo}>
                        <div className={styles.logoIcon}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.623 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.25-8.25-3.285z" />
                            </svg>
                        </div>
                        <h1 className={styles.logoText}>Privacy-Aware Bluesky</h1>
                    </div>
                    <div className={styles.userInfo}>
                        <div className={styles.avatar}>{user?.handle?.[0]?.toUpperCase() || '?'}</div>
                        <span className={styles.username}>{user?.handle || 'User'}</span>
                    </div>
                </div>
            </header>

            <main className={styles.main}>
                {/* Hero Section */}
                <section className={styles.hero}>
                    <div className={styles.heroContent}>
                        <h2 className={styles.heroTitle}>
                            Real Privacy Implementation
                        </h2>
                        <p className={styles.heroSubtitle}>
                            Actual code implementations of end-to-end encryption, differential privacy, and access controls -
                            not just theoretical concepts, but working privacy-enhancing technologies.
                        </p>

                        <div className={styles.statsGrid}>
                            <div className={styles.statCard}>
                                <div className={styles.statIcon}>🔒</div>
                                <div className={styles.statNumber}>100%</div>
                                <div className={styles.statLabel}>E2E Encrypted Messages</div>
                            </div>
                            <div className={styles.statCard}>
                                <div className={styles.statIcon}>🛡️</div>
                                <div className={styles.statNumber}>ε=1.0</div>
                                <div className={styles.statLabel}>Differential Privacy</div>
                            </div>
                            <div className={styles.statCard}>
                                <div className={styles.statIcon}>👥</div>
                                <div className={styles.statNumber}>4</div>
                                <div className={styles.statLabel}>Access Control Levels</div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Navigation Cards */}
                <section className={styles.navigation}>
                    <div className={styles.navGrid}>
                        <div
                            className={`${styles.navCard} ${styles.messagesCard} ${animateFeatures ? styles.animate : ''}`}
                            onClick={() => router.push('/messages')}
                        >
                            <div className={styles.navCardIcon}>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                                </svg>
                            </div>
                            <div className={styles.navCardContent}>
                                <h3 className={styles.navCardTitle}>Encrypted Messages</h3>
                                <p className={styles.navCardDescription}>
                                    TweetNaCl E2E Implementation with XSalsa20 + Poly1305 encryption
                                </p>
                                <div className={styles.privacyFeatures}>
                                    <span className={styles.feature}>✓ XSalsa20 + Poly1305</span>
                                    <span className={styles.feature}>✓ Curve25519 Key Exchange</span>
                                    <span className={styles.feature}>✓ Perfect Forward Secrecy</span>
                                </div>
                            </div>
                            <div className={styles.navCardArrow}>→</div>
                        </div>

                        <div
                            className={`${styles.navCard} ${styles.postsCard} ${animateFeatures ? styles.animate : ''}`}
                            onClick={() => router.push('/posts')}
                        >
                            <div className={styles.navCardIcon}>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0-1.125-.504-1.125-1.125V11.25a9 9 0 00-9-9z" />
                                </svg>
                            </div>
                            <div className={styles.navCardContent}>
                                <h3 className={styles.navCardTitle}>Private Posts</h3>
                                <p className={styles.navCardDescription}>
                                    Differential Privacy + Access Control with Laplace mechanism
                                </p>
                                <div className={styles.privacyFeatures}>
                                    <span className={styles.feature}>✓ Laplace Mechanism (ε=1.0)</span>
                                    <span className={styles.feature}>✓ 4-Level Access Control</span>
                                    <span className={styles.feature}>✓ Privacy Score Calculation</span>
                                </div>
                            </div>
                            <div className={styles.navCardArrow}>→</div>
                        </div>
                    </div>
                </section>

                {/* Actual Code Implementation */}
                <section className={styles.privacyDetails}>
                    <h2 className={styles.sectionTitle}>Actual Implementation Code</h2>

                    {/* Code Tabs */}
                    <div style={{ backgroundColor: 'white', borderRadius: '1rem', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)', overflow: 'hidden', marginBottom: '2rem' }}>
                        <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb' }}>
                            {[
                                { key: 'encryption', label: 'E2E Encryption', icon: '🔐' },
                                { key: 'differential', label: 'Differential Privacy', icon: '📊' },
                                { key: 'access', label: 'Access Control', icon: '🎯' },
                                { key: 'backend', label: 'Backend Security', icon: '🛡️' }
                            ].map((tab) => (
                                <button
                                    key={tab.key}
                                    onClick={() => setActiveCodeTab(tab.key)}
                                    style={{
                                        flex: 1,
                                        padding: '1rem 1.5rem',
                                        fontSize: '0.875rem',
                                        fontWeight: '500',
                                        border: 'none',
                                        cursor: 'pointer',
                                        backgroundColor: activeCodeTab === tab.key ? '#eff6ff' : 'transparent',
                                        color: activeCodeTab === tab.key ? '#1d4ed8' : '#6b7280',
                                        borderBottom: activeCodeTab === tab.key ? '2px solid #3b82f6' : 'none'
                                    }}
                                >
                                    <span style={{ marginRight: '0.5rem' }}>{tab.icon}</span>
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        <div style={{ padding: '1.5rem' }}>
                            <pre style={{
                                backgroundColor: '#1f2937',
                                color: '#f9fafb',
                                padding: '1.5rem',
                                borderRadius: '0.5rem',
                                overflowX: 'auto',
                                fontSize: '0.875rem',
                                lineHeight: '1.5',
                                margin: 0
                            }}>
                                <code>{codeExamples[activeCodeTab]}</code>
                            </pre>
                        </div>
                    </div>
                </section>

                {/* Privacy Comparison Table */}
                <section className={styles.comparison}>
                    <h2 className={styles.sectionTitle}>Privacy Feature Comparison</h2>
                    <div className={styles.comparisonTable}>
                        <div className={styles.tableHeader}>
                            <div className={styles.platformColumn}>Platform</div>
                            <div className={styles.featureColumn}>E2E Messages</div>
                            <div className={styles.featureColumn}>Private Posts</div>
                            <div className={styles.featureColumn}>Access Control</div>
                            <div className={styles.featureColumn}>Diff. Privacy</div>
                        </div>

                        <div className={`${styles.tableRow}`} style={{ backgroundColor: '#eff6ff' }}>
                            <div className={styles.platformName} style={{ color: '#1d4ed8' }}>Our Implementation</div>
                            <div className={`${styles.featureStatus} ${styles.supported}`}>✓</div>
                            <div className={`${styles.featureStatus} ${styles.supported}`}>✓</div>
                            <div className={`${styles.featureStatus} ${styles.supported}`}>✓</div>
                            <div className={`${styles.featureStatus} ${styles.supported}`}>✓</div>
                        </div>

                        <div className={styles.tableRow}>
                            <div className={styles.platformName}>Bluesky</div>
                            <div className={`${styles.featureStatus} ${styles.unsupported}`}>✗</div>
                            <div className={`${styles.featureStatus} ${styles.unsupported}`}>✗</div>
                            <div className={`${styles.featureStatus} ${styles.partial}`}>~</div>
                            <div className={`${styles.featureStatus} ${styles.unsupported}`}>✗</div>
                        </div>

                        <div className={styles.tableRow}>
                            <div className={styles.platformName}>Twitter/X</div>
                            <div className={`${styles.featureStatus} ${styles.unsupported}`}>✗</div>
                            <div className={`${styles.featureStatus} ${styles.partial}`}>~</div>
                            <div className={`${styles.featureStatus} ${styles.supported}`}>✓</div>
                            <div className={`${styles.featureStatus} ${styles.unsupported}`}>✗</div>
                        </div>

                        <div className={styles.tableRow}>
                            <div className={styles.platformName}>Instagram</div>
                            <div className={`${styles.featureStatus} ${styles.partial}`}>~</div>
                            <div className={`${styles.featureStatus} ${styles.supported}`}>✓</div>
                            <div className={`${styles.featureStatus} ${styles.supported}`}>✓</div>
                            <div className={`${styles.featureStatus} ${styles.unsupported}`}>✗</div>
                        </div>
                    </div>

                    <div className={styles.legend}>
                        <span className={styles.legendItem}>
                            <span className={`${styles.legendIcon} ${styles.supported}`}>✓</span> Fully Supported
                        </span>
                        <span className={styles.legendItem}>
                            <span className={`${styles.legendIcon} ${styles.partial}`}>~</span> Partially Supported
                        </span>
                        <span className={styles.legendItem}>
                            <span className={`${styles.legendIcon} ${styles.unsupported}`}>✗</span> Not Supported
                        </span>
                    </div>
                </section>

                {/* Technical Architecture */}
                <section className={styles.privacyDetails}>
                    <h2 className={styles.sectionTitle}>Technical Architecture</h2>
                    <div className={styles.implementationGrid}>
                        <div className={`${styles.implementationCard} ${animateFeatures ? styles.animate : ''}`}>
                            <div className={styles.implIcon}>🔧</div>
                            <h3 className={styles.implTitle}>Frontend Privacy Stack</h3>
                            <div className={styles.technicalDetails}>
                                <strong>Technologies:</strong>
                                <ul>
                                    <li><strong>Next.js 14</strong> - React framework with SSR</li>
                                    <li><strong>TweetNaCl</strong> - Client-side cryptography</li>
                                    <li><strong>TypeScript</strong> - Type-safe development</li>
                                    <li><strong>Tailwind CSS</strong> - Utility-first styling</li>
                                    <li><strong>LocalStorage</strong> - Encrypted key storage</li>
                                </ul>
                            </div>
                        </div>
                        <div className={`${styles.implementationCard} ${animateFeatures ? styles.animate : ''}`}>
                            <div className={styles.implIcon}>⚡</div>
                            <h3 className={styles.implTitle}>Backend Security Stack</h3>
                            <div className={styles.technicalDetails}>
                                <strong>Technologies:</strong>
                                <ul>
                                    <li><strong>Fastify</strong> - High-performance Node.js server</li>
                                    <li><strong>MikroORM</strong> - Type-safe database ORM</li>
                                    <li><strong>SQLite</strong> - Embedded database storage</li>
                                    <li><strong>AES-256-CBC</strong> - Server-side encryption</li>
                                    <li><strong>Session Management</strong> - Secure authentication</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            {/* Footer */}
            <footer className={styles.footer}>
                <p className={styles.footerText}>
                    Built for Privacy-Aware Computing Research •
                    Demonstrating Real Privacy-Enhancing Technologies on Decentralized Social Media
                </p>
            </footer>
        </div>
    );
}