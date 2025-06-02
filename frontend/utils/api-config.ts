// frontend/utils/api-config.ts

export const getApiUrl = (): string => {
    if (process.env.NODE_ENV === 'development') {
        return 'http://localhost:3001';
    }

    // HARDCODED FIX - This will definitely work
    return 'https://bluesky-privacy-project-c14177203721.herokuapp.com';
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