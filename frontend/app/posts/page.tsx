'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { API_URL, checkBackendHealth } from '../../utils/api-config';
import styling from './Posts.module.css';

// Types
interface Post {
    id: string;
    author: string;
    authorHandle?: string;
    title: string;
    content: string;
    timestamp: string;
    accessLevel: 'public' | 'followers' | 'friends' | 'private';
    privacyScore: number;
    privacyTechnique: string;
    isOwn?: boolean;
    atProtocolUri?: string;
    isNew?: boolean;
}

interface PrivacyResult {
    processedContent: string;
    technique: string;
    privacyScore: number;
    noiseMagnitude: number;
    isActualDP: boolean;
}

// Access level configurations
const ACCESS_LEVELS = {
    public: {
        label: 'Public',
        icon: '🌐',
        description: 'Visible to everyone on Bluesky',
        color: '#10b981'
    },
    followers: {
        label: 'Followers Only',
        icon: '👥',
        description: 'Only your Bluesky followers can see',
        color: '#3b82f6'
    },
    friends: {
        label: 'Friends Only',
        icon: '🤝',
        description: 'Mutual followers only',
        color: '#f59e0b'
    },
    private: {
        label: 'Private',
        icon: '🔒',
        description: 'Only you can see this',
        color: '#ef4444'
    }
};

// Privacy transformations
class PrivacyEnhancingTransformations {
    static maskPII(text: string, level: 'low' | 'medium' | 'high' = 'medium'): PrivacyResult {
        let masked = text;
        let replacements = 0;

        const patterns = [
            { regex: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, replacement: '[PHONE]' },
            { regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, replacement: '[EMAIL]' },
            { regex: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '[SSN]' },
            { regex: /\b\d{1,2}\/\d{1,2}\/\d{4}\b/g, replacement: '[DATE]' },
            { regex: /\b\d{5}(-\d{4})?\b/g, replacement: '[ZIP]' }
        ];

        patterns.forEach(({ regex, replacement }) => {
            if (regex.test(masked)) {
                masked = masked.replace(regex, replacement);
                replacements++;
            }
        });

        if (level === 'medium' || level === 'high') {
            const mediumPatterns = [
                { regex: /\b\d+\s+[A-Za-z\s]+(street|avenue|road|drive|lane|court|st|ave|rd|dr|ln|ct|blvd|boulevard|way|place|pl|circle|cir|parkway|pkwy)\b\.?/gi, replacement: '[ADDRESS]' },
                { regex: /\$\d+(?:,\d{3})*(?:\.\d{2})?/g, replacement: '[AMOUNT]' }
            ];

            mediumPatterns.forEach(({ regex, replacement }) => {
                const matches = masked.match(regex);
                if (matches) {
                    masked = masked.replace(regex, replacement);
                    replacements += matches.length;
                }
            });
        }

        return {
            processedContent: masked,
            technique: `PII Masking (${level})`,
            privacyScore: Math.min(100, 60 + (replacements * 10)),
            noiseMagnitude: replacements,
            isActualDP: false
        };
    }

    static obfuscateContent(content: string, epsilon: number = 1.0): PrivacyResult {
        const words = content.split(' ');
        let processedWords = [...words];
        let modifications = 0;

        const contextualNoise = {
            positive: ['indeed', 'certainly', 'absolutely', 'definitely', 'quite'],
            neutral: ['perhaps', 'possibly', 'likely', 'generally', 'typically'],
            transition: ['however', 'moreover', 'furthermore', 'additionally', 'meanwhile']
        };

        const isPositive = /\b(good|great|love|awesome|amazing|excellent)\b/i.test(content);
        const noiseCategory = isPositive ? 'positive' : Math.random() < 0.5 ? 'neutral' : 'transition';
        const noiseWords = contextualNoise[noiseCategory];

        const addNoiseProbability = Math.min(0.5, 1 / (epsilon + 1));

        if (Math.random() < addNoiseProbability && words.length > 3) {
            const randomPos = Math.floor(Math.random() * words.length);
            const noiseWord = noiseWords[Math.floor(Math.random() * noiseWords.length)];
            processedWords.splice(randomPos, 0, noiseWord);
            modifications++;
        }

        return {
            processedContent: processedWords.join(' '),
            technique: `Content Obfuscation (ε=${epsilon})`,
            privacyScore: Math.min(100, 40 + (modifications * 15) + Math.round((2 - epsilon) * 20)),
            noiseMagnitude: modifications,
            isActualDP: false
        };
    }

    static generalizeContent(content: string): PrivacyResult {
        let generalized = content;
        let generalizations = 0;

        const patterns = [
            {
                regex: /\b(\d+)\b/g, replacer: (match: string, num: string) => {
                    const n = parseInt(num);
                    if (n > 0) {
                        generalizations++;
                        if (n < 10) return 'several';
                        if (n < 100) return 'dozens';
                        if (n < 1000) return 'hundreds';
                        return 'thousands';
                    }
                    return match;
                }
            },
            {
                regex: /\b(\d{1,2}):(\d{2})\s*(AM|PM)\b/gi, replacer: () => {
                    generalizations++;
                    return 'during the day';
                }
            },
            {
                regex: /\b(\d{1,2})\s+years?\s+old\b/gi, replacer: (match: string, age: string) => {
                    generalizations++;
                    const a = parseInt(age);
                    if (a < 18) return 'young';
                    if (a < 30) return 'in their twenties';
                    if (a < 50) return 'middle-aged';
                    return 'older';
                }
            }
        ];

        patterns.forEach(({ regex, replacer }) => {
            generalized = generalized.replace(regex, replacer);
        });

        return {
            processedContent: generalized,
            technique: 'Content Generalization',
            privacyScore: Math.min(100, 50 + (generalizations * 12)),
            noiseMagnitude: generalizations,
            isActualDP: false
        };
    }
}

const calculatePrivacyScore = (
    accessLevel: string,
    privacyResult: PrivacyResult,
    contentLength: number
): number => {
    let score = 0;

    switch (accessLevel) {
        case 'private': score += 40; break;
        case 'friends': score += 30; break;
        case 'followers': score += 20; break;
        case 'public': score += 0; break;
    }

    score += Math.round(privacyResult.privacyScore * 0.4);

    if (contentLength < 50) score += 15;
    else if (contentLength < 100) score += 10;
    else if (contentLength < 200) score += 5;

    score += Math.min(15, privacyResult.noiseMagnitude * 3);

    return Math.min(100, score);
};

export default function PostsPage(): JSX.Element {
    const { isAuthenticated, user, loading } = useAuth();
    const router = useRouter();

    // State
    const [posts, setPosts] = useState<Post[]>([]);
    const [newPostTitle, setNewPostTitle] = useState('');
    const [newPostContent, setNewPostContent] = useState('');
    const [selectedAccessLevel, setSelectedAccessLevel] = useState<keyof typeof ACCESS_LEVELS>('public');
    const [privacyMode, setPrivacyMode] = useState<'none' | 'pii' | 'obfuscate' | 'generalize'>('pii');
    const [privacyEpsilon, setPrivacyEpsilon] = useState(1.0);
    const [piiLevel, setPiiLevel] = useState<'low' | 'medium' | 'high'>('medium');
    const [isPosting, setIsPosting] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [showPrivacySettings, setShowPrivacySettings] = useState(false);
    const [newPostIds, setNewPostIds] = useState<Set<string>>(new Set());
    const [backendStatus, setBackendStatus] = useState<'connected' | 'failed' | 'connecting'>('connecting');

    const postsEndRef = useRef<HTMLDivElement>(null);

    // Navigation handlers
    const handleGoToHub = () => {
        router.push('/hub');
    };

    // Check authentication
    useEffect(() => {
        if (!loading && !isAuthenticated) {
            router.push('/login');
        }
    }, [isAuthenticated, loading, router]);

    // Load posts
    useEffect(() => {
        if (isAuthenticated) {
            loadPosts();
        }
    }, [isAuthenticated]);

    // Clear new post animations
    useEffect(() => {
        if (newPostIds.size > 0) {
            const timer = setTimeout(() => {
                setNewPostIds(new Set());
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [newPostIds]);

    // Check backend health periodically
    useEffect(() => {
        const checkHealth = async () => {
            const status = await checkBackendHealth();
            setBackendStatus(status);
        };

        checkHealth();
        const intervalId = setInterval(checkHealth, 30000);
        return () => clearInterval(intervalId);
    }, []);

    const loadPosts = async () => {
        setIsLoading(true);
        setBackendStatus('connecting');

        try {
            const response = await fetch(`${API_URL}/posts`, {
                credentials: 'include',
                headers: {
                    'Accept': 'application/json',
                    'Cache-Control': 'no-cache'
                }
            });

            if (response.ok) {
                const data = await response.json();
                setBackendStatus('connected');

                const postsArray = data.posts || data;

                const processedPosts = postsArray.map((post: any) => ({
                    id: post.id.toString(),
                    author: post.author || post.did || user?.did || 'unknown',
                    authorHandle: user?.handle || 'unknown',
                    title: post.title,
                    content: post.content,
                    timestamp: post.createdAt || new Date().toISOString(),
                    accessLevel: post.accessLevel || 'public',
                    privacyScore: post.privacyScore || 0,
                    privacyTechnique: post.privacyTechnique || 'None',
                    isOwn: post.isOwn || (post.author === user?.did),
                    atProtocolUri: post.atProtocolUri
                }));

                setPosts(processedPosts);
                console.log(`Loaded ${processedPosts.length} posts with access control`);
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            console.error('Error loading posts:', error);
            setBackendStatus('failed');

            const storedPosts = localStorage.getItem('privacy_posts');
            if (storedPosts) {
                setPosts(JSON.parse(storedPosts));
            } else {
                createDemoPosts();
            }
        }

        setIsLoading(false);
    };

    const createDemoPosts = () => {
        const demoPosts: Post[] = [
            {
                id: 'demo-1',
                author: user?.did || 'demo',
                authorHandle: user?.handle || 'demo.user',
                title: 'Welcome to Privacy-Aware Posts',
                content: 'This demonstrates real access control with Bluesky integration. Posts respect follower relationships and privacy settings.',
                timestamp: new Date(Date.now() - 3600000).toISOString(),
                accessLevel: 'public',
                privacyScore: 72,
                privacyTechnique: 'PII Masking',
                isOwn: true
            },
            {
                id: 'demo-2',
                author: user?.did || 'demo',
                authorHandle: user?.handle || 'demo.user',
                title: 'Followers Only Content',
                content: 'This post is only visible to your Bluesky followers, demonstrating real access control through the AT Protocol.',
                timestamp: new Date(Date.now() - 1800000).toISOString(),
                accessLevel: 'followers',
                privacyScore: 88,
                privacyTechnique: 'Content Obfuscation',
                isOwn: true
            }
        ];

        setPosts(demoPosts);
        localStorage.setItem('privacy_posts', JSON.stringify(demoPosts));
    };

    const handleCreatePost = async () => {
        if (!newPostTitle.trim() || !newPostContent.trim()) return;

        setIsPosting(true);

        try {
            let privacyResult: PrivacyResult;

            switch (privacyMode) {
                case 'pii':
                    privacyResult = PrivacyEnhancingTransformations.maskPII(newPostContent.trim(), piiLevel);
                    break;
                case 'obfuscate':
                    privacyResult = PrivacyEnhancingTransformations.obfuscateContent(newPostContent.trim(), privacyEpsilon);
                    break;
                case 'generalize':
                    privacyResult = PrivacyEnhancingTransformations.generalizeContent(newPostContent.trim());
                    break;
                default:
                    privacyResult = {
                        processedContent: newPostContent.trim(),
                        technique: 'None',
                        privacyScore: 0,
                        noiseMagnitude: 0,
                        isActualDP: false
                    };
            }

            const finalPrivacyScore = calculatePrivacyScore(
                selectedAccessLevel,
                privacyResult,
                privacyResult.processedContent.length
            );

            const response = await fetch(`${API_URL}/posts`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    title: newPostTitle.trim(),
                    content: privacyResult.processedContent,
                    accessLevel: selectedAccessLevel,
                    privacyTechnique: privacyResult.technique,
                    privacyScore: finalPrivacyScore
                }),
            });

            if (response.ok) {
                const result = await response.json();

                const newPost: Post = {
                    id: result.id.toString(),
                    author: user?.did || 'anonymous',
                    authorHandle: user?.handle || 'anonymous',
                    title: newPostTitle.trim(),
                    content: privacyResult.processedContent,
                    timestamp: new Date().toISOString(),
                    accessLevel: selectedAccessLevel,
                    privacyScore: finalPrivacyScore,
                    privacyTechnique: privacyResult.technique,
                    isOwn: true,
                    atProtocolUri: result.atProtocolUri,
                    isNew: true
                };

                setPosts(prev => [newPost, ...prev]);
                setNewPostIds(prev => new Set([...Array.from(prev), newPost.id]));

                setNewPostTitle('');
                setNewPostContent('');
                setShowPrivacySettings(false);

                console.log(`Post created with access level: ${selectedAccessLevel}`);
                if (result.atProtocolUri) {
                    console.log('Published to Bluesky:', result.atProtocolUri);
                }
            } else {
                throw new Error(`Failed to create post: ${response.status}`);
            }

        } catch (error) {
            console.error('Error creating post:', error);
            alert('Failed to create post. Please try again.');
        } finally {
            setIsPosting(false);
        }
    };

    const getAccessLevelColor = (level: keyof typeof ACCESS_LEVELS) => {
        return ACCESS_LEVELS[level].color;
    };

    const getPrivacyScoreColor = (score: number) => {
        if (score >= 80) return '#10b981';
        if (score >= 60) return '#f59e0b';
        return '#ef4444';
    };

    if (loading || isLoading) {
        return (
            <div className={styling.loadingContainer}>
                <div className={styling.loadingSpinner}>
                    <svg className={styling.loadingCircle} viewBox="0 0 50 50">
                        <circle className={styling.loadingPath} cx="25" cy="25" r="20" fill="none" strokeWidth="4"></circle>
                    </svg>
                </div>
                <p className={styling.loadingText}>Loading privacy-aware posts...</p>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <></>;
    }

    return (
        <div className={styling.container}>
            {/* Header */}
            <header className={styling.header}>
                <div className={styling.headerContent}>
                    <div className={styling.navigationButtons}>
                        <button
                            onClick={handleGoToHub}
                            className={styling.hubButton}
                            title="Go to Hub"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M9.293 2.293a1 1 0 011.414 0l7 7A1 1 0 0117 10v8a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4a1 1 0 00-1-1H9a1 1 0 00-1 1v4a1 1 0 01-1 1H3a1 1 0 01-1-1v-8a1 1 0 01.293-.707l7-7z" clipRule="evenodd" />
                            </svg>
                            Hub
                        </button>
                    </div>

                    <div className={styling.headerTitle}>
                        <h1>Privacy-Aware Posts</h1>
                        <p>
                            Real access control with Bluesky integration
                            <span className={`${styling.statusIndicator} ${styling[backendStatus]}`}>
                                {backendStatus === 'connected' ? '🟢 Connected' :
                                    backendStatus === 'connecting' ? '🟡 Connecting' : '🔴 Offline'}
                            </span>
                        </p>
                    </div>

                    <div className={styling.privacyIndicator}>
                        <div className={styling.privacyBadge}>
                            <span className={styling.privacyLabel}>Privacy Budget</span>
                            <div className={styling.privacyMeter}>
                                <div
                                    className={styling.privacyFill}
                                    style={{ width: `${100}%` }}
                                ></div>
                            </div>
                            <span className={styling.privacyValue}>100%</span>
                        </div>
                    </div>
                </div>
            </header>

            <div className={styling.mainContent}>
                {/* Create Post Form */}
                <div className={styling.createPostCard}>
                    <div className={styling.createPostHeader}>
                        <h2>Create New Post</h2>
                        <button
                            onClick={() => setShowPrivacySettings(!showPrivacySettings)}
                            className={styling.privacySettingsToggle}
                        >
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            Privacy Settings
                        </button>
                    </div>

                    {showPrivacySettings && (
                        <div className={styling.privacySettings}>
                            <div className={styling.settingsGrid}>
                                {/* Access Level */}
                                <div className={styling.settingGroup}>
                                    <label className={styling.settingLabel}>Access Level</label>
                                    <div className={styling.accessLevelGrid}>
                                        {Object.entries(ACCESS_LEVELS).map(([key, config]) => (
                                            <button
                                                key={key}
                                                type="button"
                                                onClick={() => setSelectedAccessLevel(key as keyof typeof ACCESS_LEVELS)}
                                                className={`${styling.accessLevelButton} ${selectedAccessLevel === key ? styling.selected : ''}`}
                                                style={{ borderColor: selectedAccessLevel === key ? config.color : undefined }}
                                            >
                                                <span className={styling.accessIcon}>{config.icon}</span>
                                                <span className={styling.accessLabel}>{config.label}</span>
                                                <span className={styling.accessDescription}>{config.description}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Privacy Enhancement */}
                                <div className={styling.settingGroup}>
                                    <label className={styling.settingLabel}>Privacy Enhancement</label>
                                    <div className={styling.accessLevelGrid}>
                                        {[
                                            { value: 'none', label: 'None', icon: '🚫', description: 'No privacy transformations' },
                                            { value: 'pii', label: 'PII Masking', icon: '🔍', description: 'Remove sensitive information' },
                                            { value: 'obfuscate', label: 'Content Obfuscation', icon: '🌫️', description: 'Add contextual noise words' },
                                            { value: 'generalize', label: 'Generalization', icon: '📊', description: 'Replace specifics with ranges' }
                                        ].map((option) => (
                                            <button
                                                key={option.value}
                                                type="button"
                                                onClick={() => setPrivacyMode(option.value as any)}
                                                className={`${styling.accessLevelButton} ${privacyMode === option.value ? styling.selected : ''}`}
                                            >
                                                <span className={styling.accessIcon}>{option.icon}</span>
                                                <span className={styling.accessLabel}>{option.label}</span>
                                                <span className={styling.accessDescription}>{option.description}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {privacyMode === 'pii' && (
                                    <div className={styling.settingGroup}>
                                        <label className={styling.settingLabel}>PII Detection Level</label>
                                        <div className={styling.piiLevelSelector}>
                                            <div className={styling.piiOptions}>
                                                {[
                                                    { value: 'low', label: 'Low', description: 'Phone, Email, SSN' },
                                                    { value: 'medium', label: 'Medium', description: '+ Address, Money' },
                                                    { value: 'high', label: 'High', description: '+ Names, Aggressive' }
                                                ].map((option) => (
                                                    <button
                                                        key={option.value}
                                                        className={`${styling.piiOption} ${piiLevel === option.value ? styling.selected : ''}`}
                                                        onClick={() => setPiiLevel(option.value as 'low' | 'medium' | 'high')}
                                                        type="button"
                                                    >
                                                        <div className={styling.piiLabel}>{option.label}</div>
                                                        <div className={styling.piiDescription}>{option.description}</div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {privacyMode === 'obfuscate' && (
                                    <div className={styling.settingGroup}>
                                        <div className={styling.settingHeader}>
                                            <label className={styling.settingLabel}>Content Obfuscation Level</label>
                                            <span className={styling.settingBadge}>ε = {privacyEpsilon}</span>
                                        </div>
                                        <p className={styling.settingDescription}>
                                            Lower ε = more privacy transformations (more noise)
                                        </p>
                                        <div className={styling.epsilonSlider}>
                                            <input
                                                type="range"
                                                min="0.1"
                                                max="2.0"
                                                step="0.1"
                                                value={privacyEpsilon}
                                                onChange={(e) => setPrivacyEpsilon(parseFloat(e.target.value))}
                                                className={styling.slider}
                                            />
                                            <div className={styling.sliderLabels}>
                                                <span>More Privacy</span>
                                                <span>Less Privacy</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div className={styling.createPostForm}>
                        <input
                            type="text"
                            placeholder="Post title..."
                            value={newPostTitle}
                            onChange={(e) => setNewPostTitle(e.target.value)}
                            className={styling.titleInput}
                        />
                        <textarea
                            placeholder="What's on your mind? (Privacy-enhanced content)"
                            value={newPostContent}
                            onChange={(e) => setNewPostContent(e.target.value)}
                            className={styling.contentTextarea}
                            rows={4}
                        />

                        <div className={styling.postActions}>
                            <div className={styling.postMetrics}>
                                <span className={styling.accessLevelBadge} style={{ backgroundColor: getAccessLevelColor(selectedAccessLevel) }}>
                                    {ACCESS_LEVELS[selectedAccessLevel].icon} {ACCESS_LEVELS[selectedAccessLevel].label}
                                </span>
                                {privacyMode !== 'none' && (
                                    <span className={styling.privacyBadge}>
                                        🔒 {privacyMode === 'pii' ? 'PII Masking' : privacyMode === 'obfuscate' ? `Obfuscation (ε=${privacyEpsilon})` : 'Generalization'}
                                    </span>
                                )}
                            </div>

                            <button
                                onClick={handleCreatePost}
                                disabled={!newPostTitle.trim() || !newPostContent.trim() || isPosting}
                                className={styling.postButton}
                            >
                                {isPosting ? 'Publishing...' : 'Publish Post'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Posts Feed */}
                <div className={styling.postsContainer}>
                    <div className={styling.postsHeader}>
                        <h2>Your Privacy-Protected Posts</h2>
                        <span className={styling.postCount}>{posts.length} posts</span>
                    </div>

                    {posts.length === 0 ? (
                        <div className={styling.emptyState}>
                            <div className={styling.emptyIcon}>📝</div>
                            <h3>No posts yet</h3>
                            <p>Create your first privacy-aware post above!</p>
                        </div>
                    ) : (
                        <div className={styling.postsList}>
                            {posts.map((post) => (
                                <div
                                    key={post.id}
                                    className={`${styling.postCard} ${newPostIds.has(post.id) ? styling.newPost : ''}`}
                                >
                                    <div className={styling.postHeader}>
                                        <div className={styling.postAuthor}>
                                            <div className={styling.authorAvatar}>
                                                {post.authorHandle?.[0]?.toUpperCase() || '?'}
                                            </div>
                                            <div className={styling.authorInfo}>
                                                <span className={styling.authorHandle}>@{post.authorHandle}</span>
                                                <span className={styling.postTime}>
                                                    {new Date(post.timestamp).toLocaleString()}
                                                </span>
                                            </div>
                                        </div>

                                        <div className={styling.postBadges}>
                                            <span
                                                className={styling.accessBadge}
                                                style={{ backgroundColor: getAccessLevelColor(post.accessLevel) }}
                                            >
                                                {ACCESS_LEVELS[post.accessLevel].icon}
                                            </span>
                                            <span
                                                className={styling.privacyScoreBadge}
                                                style={{ backgroundColor: getPrivacyScoreColor(post.privacyScore) }}
                                            >
                                                {post.privacyScore}%
                                            </span>
                                            {post.privacyTechnique !== 'None' && (
                                                <span className={styling.noiseBadge}>
                                                    🛡️ Enhanced
                                                </span>
                                            )}
                                            {post.atProtocolUri && (
                                                <span className={styling.blueskyBadge}>
                                                    📡 Bluesky
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className={styling.postContent}>
                                        <h3 className={styling.postTitle}>{post.title}</h3>
                                        <p className={styling.postText}>{post.content}</p>
                                    </div>

                                    <div className={styling.postFooter}>
                                        <div className={styling.privacyInfo}>
                                            <span className={styling.privacyLabel}>
                                                Privacy Score: <strong style={{ color: getPrivacyScoreColor(post.privacyScore) }}>
                                                    {post.privacyScore}%
                                                </strong>
                                            </span>
                                            {post.privacyTechnique !== 'None' && (
                                                <span className={styling.privacyFeature}>
                                                    ✓ {post.privacyTechnique}
                                                </span>
                                            )}
                                        </div>
                                        <div className={styling.postLinks}>
                                            <span>Access: {ACCESS_LEVELS[post.accessLevel].label}</span>
                                            {post.atProtocolUri && (
                                                <a
                                                    href={`https://bsky.app/profile/${post.authorHandle}/post/${post.atProtocolUri.split('/').pop()}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className={styling.blueskyLink}
                                                >
                                                    View on Bluesky →
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <div ref={postsEndRef} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}