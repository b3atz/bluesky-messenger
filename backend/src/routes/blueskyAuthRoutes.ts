// blueskyAuthRoutes.ts - Fixed OAuth session handling
import { FastifyPluginAsync } from 'fastify';
import { getBlueskyClient } from '../utils/bluesky-client.js';
import crypto from 'crypto';
import { URLSearchParams } from 'url';
import { saveSession } from '../utils/session-store.js';

// Define the interface to match what we expect
interface BlueskySessionData {
  did: string;
  handle: string;
  accessJwt: string;
  refreshJwt: string;
  email?: string;
  active?: boolean;
  createdAt: string;
}

const blueskyAuthRoutes: FastifyPluginAsync = async (fastify) => {
  // Ensure cookie & body plugins are registered
  fastify.register(import('@fastify/cookie'));
  fastify.register(import('@fastify/formbody'));

  // POST /api/auth/start
  fastify.post('/api/auth/start', async (request, reply) => {
    const { handle } = request.body as { handle: string };
    const client = await getBlueskyClient();
    const state = crypto.randomUUID();
    const url = await client.authorize(handle, { state });
    return reply.send({ url });
  });

  // GET /api/auth/callback - Fixed OAuth session handling
  fastify.get('/oauth/callback', async (request, reply) => {
    try {
      const client = await getBlueskyClient();

      const params = new URLSearchParams(request.query as Record<string, string>);
      const result = await client.callback(params);

      if (!result?.session) {
        return reply.status(400).send({ error: 'Authentication failed - no session' });
      }

      const sessionId = crypto.randomUUID();

      // The OAuth session structure might be different, let's handle it safely
      const oauthSession = result.session as any; // Type assertion to access properties

      fastify.log.info('OAuth session received:', JSON.stringify(oauthSession, null, 2));

      // Try to extract the required information from the OAuth session
      // The actual structure depends on the @atproto/oauth-client-node implementation
      const sessionData: BlueskySessionData = {
        did: oauthSession.sub || oauthSession.did || 'unknown',
        handle: oauthSession.handle || extractHandleFromSession(oauthSession) || 'unknown',
        accessJwt: oauthSession.accessToken || oauthSession.access_token || '',
        refreshJwt: oauthSession.refreshToken || oauthSession.refresh_token || '',
        active: true,
        createdAt: new Date().toISOString()
      };

      // Log what we extracted
      fastify.log.info('Extracted session data:', {
        did: sessionData.did,
        handle: sessionData.handle,
        hasAccessToken: !!sessionData.accessJwt,
        hasRefreshToken: !!sessionData.refreshJwt
      });

      saveSession(sessionId, sessionData);

      reply.setCookie('bluesky_session_id', sessionId, {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        path: '/',
      });

      return reply.send({
        success: true,
        sessionData: {
          did: sessionData.did,
          handle: sessionData.handle,
          hasTokens: !!(sessionData.accessJwt && sessionData.refreshJwt)
        }
      });
    } catch (error) {
      fastify.log.error('OAuth callback error:', error);
      return reply.status(500).send({
        error: 'OAuth callback failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // POST /auth/login - Direct login endpoint for frontend (this works with your AuthContext)
  fastify.post('/auth/login', async (request, reply) => {
    const body = request.body as any;

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
        accessJwt: '',
        refreshJwt: '',
        active: true,
        createdAt: new Date().toISOString()
      };
      fastify.log.warn(`Legacy session login: ${body.handle} without AT Protocol tokens`);
    } else {
      return reply.status(400).send({ error: 'Missing did or handle' });
    }

    // Create a session ID
    const sessionId = crypto.randomUUID();

    // Save the session
    saveSession(sessionId, sessionData);

    // Set the cookie
    reply.setCookie('bluesky_session_id', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return reply.send({
      success: true,
      hasTokens: !!(sessionData.accessJwt && sessionData.refreshJwt),
      message: sessionData.accessJwt ?
        'Session created with AT Protocol tokens' :
        'Session created without AT Protocol tokens'
    });
  });

  // POST /auth/logout - Logout endpoint
  fastify.post('/auth/logout', async (request, reply) => {
    // Clear the cookie
    reply.clearCookie('bluesky_session_id', { path: '/' });
    return reply.send({ success: true });
  });
}

// Helper function to try to extract handle from various possible session structures
function extractHandleFromSession(session: any): string | null {
  // Try various possible property names
  const possibleHandleFields = [
    'handle',
    'preferred_username',
    'username',
    'account_handle',
    'user_handle'
  ];

  for (const field of possibleHandleFields) {
    if (session[field]) {
      return session[field];
    }
  }

  // If no handle found, try to extract from sub/did if it looks like a handle
  if (session.sub && session.sub.includes('.')) {
    return session.sub;
  }

  return null;
}

export default blueskyAuthRoutes;