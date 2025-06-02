// routes/posts.ts - Updated to actually post to Bluesky using AT Protocol
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Post } from '../db/entities/Post.js';
import { getSession } from '../utils/session-store.js';
import { BskyAgent } from '@atproto/api';

// Create Bluesky agent from session
async function createBlueskyAgent(sessionData: any): Promise<BskyAgent | null> {
  if (!sessionData.accessJwt || !sessionData.refreshJwt) {
    console.log('Session missing AT Protocol tokens');
    return null;
  }

  try {
    const agent = new BskyAgent({
      service: 'https://bsky.social'
    });

    // Resume the session with stored tokens
    await agent.resumeSession({
      did: sessionData.did,
      handle: sessionData.handle,
      accessJwt: sessionData.accessJwt,
      refreshJwt: sessionData.refreshJwt,
      active: sessionData.active !== false
    });

    return agent;
  } catch (error) {
    console.error('Failed to create Bluesky agent:', error);
    return null;
  }
}

async function postRoutes(fastify: FastifyInstance) {
  fastify.register(import('@fastify/cookie'));
  fastify.register(import('@fastify/formbody'));

  // Auth hook
  fastify.addHook('onRequest', async (req: FastifyRequest, reply: FastifyReply) => {
    // Skip auth for health endpoint
    if (req.url === '/health') return;

    const sessionId = req.cookies?.bluesky_session_id;
    if (!sessionId) return reply.code(401).send({ error: 'Missing session ID' });

    const session = getSession(sessionId);
    if (!session?.did) return reply.code(401).send({ error: 'Invalid session' });

    (req as any).user = { did: session.did, handle: session.handle };
    (req as any).session = session;
  });

  // Create post with actual Bluesky publishing
  fastify.post('/posts', async (req: FastifyRequest, reply: FastifyReply) => {
    const {
      title,
      content,
      accessLevel = 'public',
      privacyTechnique = 'None',
      privacyScore = 0
    } = req.body as {
      title: string;
      content: string;
      accessLevel?: string;
      privacyTechnique?: string;
      privacyScore?: number;
    };

    const user = (req as any).user;
    const session = (req as any).session;

    try {
      // Create the post in our database first
      const post = new Post(user.did, title, content);
      await req.em.persistAndFlush(post);

      let atProtocolUri = null;
      let blueskyError = null;

      // Only publish public posts to Bluesky
      if (accessLevel === 'public') {
        fastify.log.info('Attempting to publish to Bluesky...');

        try {
          const agent = await createBlueskyAgent(session);

          if (agent) {
            // Prepare the post text (combine title and content)
            const postText = title ? `${title}\n\n${content}` : content;

            // Ensure we don't exceed Bluesky's character limit (300 chars)
            const truncatedText = postText.length > 300 ?
              postText.substring(0, 297) + '...' : postText;

            fastify.log.info(`Publishing to Bluesky: "${truncatedText.substring(0, 50)}..."`);

            // Actually post to Bluesky!
            const blueskyResult = await agent.post({
              text: truncatedText,
              createdAt: new Date().toISOString()
            });

            atProtocolUri = blueskyResult.uri;
            fastify.log.info(`✅ Successfully published to Bluesky! URI: ${atProtocolUri}`);

            // Store the AT Protocol URI in our database
            (post as any).atProtocolUri = atProtocolUri;
            await req.em.flush();

          } else {
            blueskyError = 'No AT Protocol tokens available';
            fastify.log.warn('Cannot publish to Bluesky: No valid agent created');
          }
        } catch (publishError) {
          blueskyError = publishError instanceof Error ? publishError.message : 'Unknown error';
          fastify.log.error('Error publishing to Bluesky:', publishError);
        }
      } else {
        fastify.log.info(`Post marked as ${accessLevel}, not publishing to Bluesky`);
      }

      // Return response
      const response: any = {
        id: post.id,
        accessLevel,
        privacyScore,
        message: accessLevel === 'public' ?
          (atProtocolUri ?
            '✅ Published to Bluesky and saved to private server!' :
            `⚠️ Saved to private server only (Bluesky: ${blueskyError})`) :
          '🔒 Saved to private server only (access controlled)'
      };

      if (atProtocolUri) {
        response.atProtocolUri = atProtocolUri;
        response.blueskyUrl = `https://bsky.app/profile/${user.handle}/post/${atProtocolUri.split('/').pop()}`;
      }

      return reply.code(201).send(response);

    } catch (error) {
      fastify.log.error('Error creating post:', error);
      return reply.code(500).send({
        error: 'Failed to create post',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get all posts (existing logic)
  fastify.get('/posts', async (req: FastifyRequest, reply: FastifyReply) => {
    const user = (req as any).user;

    try {
      const posts = await req.em.find(Post, {});

      const result = posts.map(p => ({
        id: p.id,
        title: p.title,
        content: p.content,
        author: p.did,
        isOwn: p.did === user.did,
        atProtocolUri: (p as any).atProtocolUri,
        createdAt: (p as any).createdAt || new Date().toISOString()
      }));

      return { posts: result };
    } catch (error) {
      fastify.log.error('Error fetching posts:', error);
      return reply.code(500).send({ error: 'Failed to fetch posts' });
    }
  });

  // Test endpoint to verify AT Protocol integration
  fastify.get('/posts/test-bluesky', async (req: FastifyRequest, reply: FastifyReply) => {
    const session = (req as any).session;

    try {
      const agent = await createBlueskyAgent(session);

      if (!agent) {
        return {
          success: false,
          error: 'No AT Protocol tokens available',
          hasTokens: !!(session.accessJwt && session.refreshJwt)
        };
      }

      // Test by getting the user's profile
      const profile = await agent.getProfile({ actor: session.did });

      return {
        success: true,
        message: 'AT Protocol integration is working!',
        profile: {
          handle: profile.data.handle,
          displayName: profile.data.displayName,
          followersCount: profile.data.followersCount,
          followsCount: profile.data.followsCount,
          postsCount: profile.data.postsCount
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        details: 'Failed to connect to AT Protocol'
      };
    }
  });

  // Other existing routes (get single post, update, delete) remain the same...
  fastify.get('/posts/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: number };
    const user = (req as any).user;

    const post = await req.em.findOne(Post, { id });
    if (!post || post.did !== user.did) {
      return reply.code(404).send({ error: 'Post not found or unauthorized' });
    }

    return {
      id: post.id,
      title: post.title,
      content: post.content,
      atProtocolUri: (post as any).atProtocolUri
    };
  });

  fastify.put('/posts/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: number };
    const { title, content } = req.body as { title: string; content: string };
    const user = (req as any).user;

    const post = await req.em.findOne(Post, { id });
    if (!post || post.did !== user.did) {
      return reply.code(404).send({ error: 'Post not found or unauthorized' });
    }

    post.title = title;
    post.content = content;

    await req.em.flush();
    reply.send({ success: true });
  });

  fastify.delete('/posts/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: number };
    const user = (req as any).user;

    const post = await req.em.findOne(Post, { id });
    if (!post || post.did !== user.did) {
      return reply.code(404).send({ error: 'Post not found or unauthorized' });
    }

    await req.em.removeAndFlush(post);
    reply.send({ success: true });
  });
}

export default postRoutes;