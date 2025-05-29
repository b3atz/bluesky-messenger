// blueskyAuthRoutes.ts
import { FastifyPluginAsync } from 'fastify';
import { getBlueskyClient } from '../utils/bluesky-client.js'; // adjust the path
import crypto from 'crypto';
import { URLSearchParams } from 'url';
import { saveSession } from '../utils/session-store.js';

const blueskyAuthRoutes: FastifyPluginAsync = async (fastify) => {
  // Ensure cookie & body plugins are registered
  fastify.register(import('@fastify/cookie'));
  fastify.register(import('@fastify/formbody')); // or '@fastify/body' for JSON

  // POST /api/auth/start
  fastify.post('/api/auth/start', async (request, reply) => {
    const { handle } = request.body as { handle: string };
    const client = await getBlueskyClient();
    const state = crypto.randomUUID();
    const url = await client.authorize(handle, { state });
    return reply.send({ url });
  });

  // GET /api/auth/callback

  fastify.get('/oauth/callback', async (request, reply) => {
    const client = await getBlueskyClient();

    const params = new URLSearchParams(request.query as Record<string, string>);
    const result = await client.callback(params);

    if (!result?.session) {
      return reply.status(400).send({ error: 'Authentication failed' });
    }

    const sessionId = crypto.randomUUID();
    saveSession(sessionId, result.session);

    reply.setCookie('bluesky_session_id', sessionId, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
    });

    return reply.send({ success: true });
  });
}

export default blueskyAuthRoutes;
