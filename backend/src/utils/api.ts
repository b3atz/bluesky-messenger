// api.ts - Central place to manage backend API connections

/**
 * API utility for managing backend connections
 * Place this file in your frontend utils folder
 */

// Backend API URL - change this to your production URL when deploying
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Connection status types
export type ConnectionStatus = 'connecting' | 'connected' | 'failed';

// Keep track of connection status
let connectionStatus: ConnectionStatus = 'connecting';
let connectionListeners: ((status: ConnectionStatus) => void)[] = [];

/**
 * Subscribe to connection status changes
 */
export const subscribeToConnectionStatus = (
    callback: (status: ConnectionStatus) => void
): (() => void) => {
    connectionListeners.push(callback);
    // Immediately call with current status
    callback(connectionStatus);

    // Return unsubscribe function
    return () => {
        connectionListeners = connectionListeners.filter(cb => cb !== callback);
    };
};

/**
 * Update connection status and notify listeners
 */
const updateConnectionStatus = (status: ConnectionStatus) => {
    if (connectionStatus !== status) {
        connectionStatus = status;
        // Notify all listeners
        connectionListeners.forEach(callback => callback(status));
    }
};

/**
 * Get the current connection status
 */
export const getConnectionStatus = (): ConnectionStatus => {
    return connectionStatus;
};

/**
 * Check backend health
 * Call this periodically to update connection status
 */
export const checkBackendConnection = async (): Promise<boolean> => {
    try {
        updateConnectionStatus('connecting');

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

        const response = await fetch(`${API_URL}/health`, {
            method: 'GET',
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
            updateConnectionStatus('connected');
            return true;
        } else {
            console.error('Backend health check failed:', await response.text());
            updateConnectionStatus('failed');
            return false;
        }
    } catch (error) {
        console.error('Backend connection error:', error);
        updateConnectionStatus('failed');
        return false;
    }
};

// Generic API request function with error handling
export const apiRequest = async <T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> => {
    try {
        // Default options for API requests
        const defaultOptions: RequestInit = {
            credentials: 'include', // Include cookies for authentication
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        };

        const mergedOptions = { ...defaultOptions, ...options };
        const response = await fetch(`${API_URL}${endpoint}`, mergedOptions);

        // Update connection status based on response
        updateConnectionStatus(response.ok ? 'connected' : 'failed');

        if (!response.ok) {
            const errorText = await response.text();
            try {
                // Try to parse as JSON
                const errorJson = JSON.parse(errorText);
                throw new Error(errorJson.error || errorJson.message || `API Error: ${response.status}`);
            } catch (e) {
                // If parsing fails, use the raw text
                throw new Error(`API Error: ${response.status} - ${errorText || 'Unknown error'}`);
            }
        }

        // For 204 No Content responses
        if (response.status === 204) {
            return {} as T;
        }

        // Parse JSON response
        const data = await response.json();
        return data as T;
    } catch (error) {
        // Network errors or other exceptions
        if (error instanceof TypeError && error.message.includes('fetch')) {
            updateConnectionStatus('failed');
        }

        throw error;
    }
};

// Initialize with a connection check
checkBackendConnection().then(connected => {
    console.log(`Initial backend connection check: ${connected ? 'Connected' : 'Failed'}`);
});

// Message-specific API functions
export const fetchMessages = async () => {
    return apiRequest<Record<string, any[]>>('/dm');
};

export const fetchConversation = async (did: string) => {
    return apiRequest<any[]>(`/dm/${did}`);
};

export const sendMessage = async (recipientDid: string, content: string) => {
    return apiRequest<{ success: boolean; messageId: number }>('/dm', {
        method: 'POST',
        body: JSON.stringify({ recipientDid, content })
    });
};

export default {
    checkBackendConnection,
    subscribeToConnectionStatus,
    getConnectionStatus,
    fetchMessages,
    fetchConversation,
    sendMessage
};