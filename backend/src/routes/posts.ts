import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Post } from '../db/entities/Post.js';
import { getSession } from '../utils/session-store.js'; // ← server-side session storage

async function postRoutes(fastify: FastifyInstance) {
  fastify.register(import('@fastify/cookie'));
  fastify.register(import('@fastify/formbody'))
  // Auth hook using session ID from cookie
  fastify.addHook('onRequest', async (req: FastifyRequest, reply: FastifyReply) => {
    const sessionId = req.cookies?.bluesky_session_id;
    if (!sessionId) return reply.code(401).send({ error: 'Missing session ID' });

    const session = getSession(sessionId);
    if (!session?.did) return reply.code(401).send({ error: 'Invalid session' });

    (req as any).user = { did: session.did };
  });

  // Create post
  fastify.post('/posts', async (req: FastifyRequest, reply: FastifyReply) => {
    const { title, content } = req.body as { title: string; content: string };
    const did = (req as any).user.did;

    const post = new Post(did, title, content);

    await req.em.persistAndFlush(post);
    reply.code(201).send({ id: post.id });
  });

  // Get all posts
  fastify.get('/posts', async (req: FastifyRequest, reply: FastifyReply) => {
    const posts = await req.em.find(Post, { });

    const result = posts.map(p => ({
      id: p.id,
      title: p.title,
      content: p.content
    }));

    return result;
  });

  // Get one post
  fastify.get('/posts/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: number };
    const did = (req as any).user.did;

    const post = await req.em.findOne(Post, { id });
    if (!post || post.did !== did) {
      return reply.code(404).send({ error: 'Post not found or unauthorized' });
    }

    return {
      id: post.id,
      title: post.title,
      content: post.content
    };
  });

  // Update post
  fastify.put('/posts/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: number };
    const { title, content } = req.body as { title: string; content: string };
    const did = (req as any).user.did;

    const post = await req.em.findOne(Post, { id });
    if (!post || post.did !== did) {
      return reply.code(404).send({ error: 'Post not found or unauthorized' });
    }

    post.title = title;
    post.content = content;

    await req.em.flush();
    reply.send({ success: true });
  });

  // Delete post
  fastify.delete('/posts/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: number };
    const did = (req as any).user.did;

    const post = await req.em.findOne(Post, { id });
    if (!post || post.did !== did) {
      return reply.code(404).send({ error: 'Post not found or unauthorized' });
    }

    await req.em.removeAndFlush(post);
    reply.send({ success: true });
  });
}

export default postRoutes;