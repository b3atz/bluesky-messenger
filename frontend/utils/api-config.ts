// frontend/utils/api-config.ts
export const getApiUrl = (): string => {
    // If we're in development, use localhost
    if (process.env.NODE_ENV === 'development') {
        return 'http://localhost:3001';
    }

    // If there's an explicit API URL set, use that
    if (process.env.NEXT_PUBLIC_API_URL) {
        return process.env.NEXT_PUBLIC_API_URL;
    }

    // **FIX: Use your specific backend Heroku URL**
    if (typeof window !== 'undefined') {
        // Check if we're on the frontend-only Heroku app
        if (window.location.origin.includes('bluesky-privacy-project-c14177203721.herokuapp.com')) {
            // Point to your backend Heroku app
            return 'https://privacy-enhanced-bluesky-6a4a7cccefa2.herokuapp.com';
        }

        // Otherwise, assume same origin
        return window.location.origin;
    }

    // Fallback for server-side rendering - use your backend URL
    return 'https://privacy-enhanced-bluesky-6a4a7cccefa2.herokuapp.com';
};

export const API_URL = getApiUrl();

// Health check function
export const checkBackendHealth = async (): Promise<'connected' | 'failed' | 'connecting'> => {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(`${API_URL}/health`, {
            signal: controller.signal,
            headers: {
                'Cache-Control': 'no-cache',
                'Accept': 'application/json',
            },
            credentials: 'include'
        });

        clearTimeout(timeoutId);

        if (response.ok) {
            return 'connected';
        } else {
            return 'failed';
        }
    } catch (error) {
        // Try fallback check
        try {
            const fallbackResponse = await fetch(`${API_URL}/`, {
                method: 'HEAD',
                signal: AbortSignal.timeout(2000),
                credentials: 'include'
            });

            if (fallbackResponse.ok || fallbackResponse.status === 404) {
                return 'connected';
            } else {
                return 'failed';
            }
        } catch (fallbackError) {
            return 'failed';
        }
    }
  };