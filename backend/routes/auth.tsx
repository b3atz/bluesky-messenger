import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from 'fastify';

// Define interfaces for request body types
interface RegisterRequest {
    Body: {
        did: string;
        handle: string;
        publicKey?: string;
    }
}

interface SessionRequest extends FastifyRequest {
    user?: {
        did: string;
    }
}

/**
 * Authentication routes for the Bluesky messenger
 * Handles user registration, login, and logout
 */
export default async function authRoutes(
    fastify: FastifyInstance,
    options: FastifyPluginOptions
) {
    // Store for user information (in a real app, use a database)
    const users = new Map<string, { did: string; handle: string; publicKey?: string }>();

    /**
     * Register a new user with our messaging service
     * Stores minimal user information (DID, handle, public key)
     */
    fastify.post<RegisterRequest>('/register', async (request, reply) => {
        const { did, handle, publicKey } = request.body;

        if (!did || !handle) {
            return reply.code(400).send({ error: 'Missing required fields' });
        }

        // Store user info
        users.set(did, { did, handle, publicKey });

        // Set a session cookie
        reply.setCookie('bsky_messenger_session', did, {
            path: '/',
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            maxAge: 30 * 24 * 60 * 60, // 30 days
        });

        return { success: true, did };
    });

    /**
     * Login to our messaging service
     * Verifies user exists and sets session
     */
    fastify.post<RegisterRequest>('/login', async (request, reply) => {
        const { did, handle, publicKey } = request.body;

        if (!did || !handle) {
            return reply.code(400).send({ error: 'Missing required fields' });
        }

        // Check if user exists, otherwise create
        if (!users.has(did)) {
            users.set(did, { did, handle, publicKey });
        } else if (publicKey) {
            // Update public key if provided
            const userData = users.get(did);
            users.set(did, { ...userData!, publicKey });
        }

        // Set a session cookie
        reply.setCookie('bsky_messenger_session', did, {
            path: '/',
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            maxAge: 30 * 24 * 60 * 60, // 30 days
        });

        return { success: true, did };
    });

    /**
     * Logout from the messaging service
     * Clears the session cookie
     */
    fastify.post('/logout', async (request, reply) => {
        reply.clearCookie('bsky_messenger_session', { path: '/' });
        return { success: true };
    });

    /**
     * Get current user information
     * Returns the user data for the current session
     */
    fastify.get('/me', async (request: FastifyRequest, reply: FastifyReply) => {
        const sessionDid = request.cookies.bsky_messenger_session;

        if (!sessionDid || !users.has(sessionDid)) {
            return reply.code(401).send({ error: 'Not authenticated' });
        }

        const userData = users.get(sessionDid);
        return {
            did: userData!.did,
            handle: userData!.handle,
        };
    });
}