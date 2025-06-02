// routes/auth.ts - Simple version that works with your existing setup
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { saveSession, getSession, clearSession } from '../utils/session-store.js';
import crypto from 'crypto';

// Enhanced session interface to store Bluesky tokens
interface BlueskySessionData {
    did: string;
    handle: string;
    accessJwt: string;
    refreshJwt: string;
    email?: string;
    active?: boolean;
    createdAt: string;
}

export default async function authRoutes(fastify: FastifyInstance) {
    fastify.register(import('@fastify/cookie'));
    fastify.register(import('@fastify/formbody'));

    // Enhanced login endpoint that accepts full Bluesky session
    fastify.post('/auth/login', async (req: FastifyRequest, reply: FastifyReply) => {
        const body = req.body as any;

        // Support both old format (did, handle) and new format (full session)
        let sessionData: BlueskySessionData;

        if (body.accessJwt && body.refreshJwt) {
            // New format with full Bluesky session tokens
            sessionData = {
                did: body.did,
                handle: body.handle,
                accessJwt: body.accessJwt,
                refreshJwt: body.refreshJwt,
                email: body.email,
                active: body.active !== false,
                createdAt: new Date().toISOString()
            };
            fastify.log.info(`Full Bluesky session login: ${body.handle} with AT Protocol tokens`);
        } else if (body.did && body.handle) {
            // Legacy format - create limited session without tokens
            sessionData = {
                did: body.did,
                handle: body.handle,
                accessJwt: '', // Empty - won't be able to make AT Protocol calls
                refreshJwt: '',
                active: true,
                createdAt: new Date().toISOString()
            };
            fastify.log.warn(`Legacy session login: ${body.handle} without AT Protocol tokens`);
        } else {
            return reply.code(400).send({
                error: 'Missing required session data',
                details: 'Either provide (did, handle) or full Bluesky session with tokens'
            });
        }

        try {
            // Create a session
            const sessionId = crypto.randomUUID();

            // Save the full session data
            saveSession(sessionId, sessionData);

            // Set cookie
            reply.setCookie('bluesky_session_id', sessionId, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                path: '/',
                maxAge: 60 * 60 * 24 * 7 // 7 days
            });

            fastify.log.info(`Session created: ${sessionId.substring(0, 8)}... for ${sessionData.handle}`);

            return {
                success: true,
                user: {
                    did: sessionData.did,
                    handle: sessionData.handle
                },
                hasTokens: !!(sessionData.accessJwt && sessionData.refreshJwt),
                message: sessionData.accessJwt ?
                    'Session created with AT Protocol integration' :
                    'Session created (limited - no AT Protocol tokens)'
            };

        } catch (error) {
            fastify.log.error('Auth error:', error);
            return reply.code(500).send({ error: 'Internal server error' });
        }
    });

    // Debug endpoint to check session status
    fastify.get('/auth/debug', async (req: FastifyRequest, reply: FastifyReply) => {
        const sessionId = req.cookies?.bluesky_session_id;

        if (!sessionId) {
            return {
                authenticated: false,
                sessionId: null,
                error: 'No session cookie found'
            };
        }

        const session = getSession(sessionId);

        if (!session) {
            return {
                authenticated: false,
                sessionId: sessionId.substring(0, 8) + '...',
                error: 'Session not found in store'
            };
        }

        return {
            authenticated: true,
            sessionId: sessionId.substring(0, 8) + '...',
            user: {
                did: session.did,
                handle: session.handle
            },
            hasTokens: !!(session.accessJwt && session.refreshJwt),
            sessionAge: session.createdAt ?
                Math.floor((Date.now() - new Date(session.createdAt).getTime()) / 1000) :
                'unknown'
        };
    });

    // Logout endpoint
    fastify.post('/auth/logout', async (req: FastifyRequest, reply: FastifyReply) => {
        const sessionId = req.cookies?.bluesky_session_id;

        if (sessionId) {
            clearSession(sessionId);
            reply.clearCookie('bluesky_session_id', { path: '/' });
            fastify.log.info(`Session logged out: ${sessionId.substring(0, 8)}...`);
        }

        return { success: true, message: 'Logged out successfully' };
    });
}