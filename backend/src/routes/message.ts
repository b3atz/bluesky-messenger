// routes/dm.ts
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Message } from '../db/entities/Message.js';
import { encrypt, decrypt } from '../utils/encryption.js';
import { getSession } from '../utils/session-store.js';

export default async function dmRoutes(fastify: FastifyInstance) {
    fastify.register(import('@fastify/cookie'));
    fastify.register(import('@fastify/formbody'));
    fastify.addHook('onRequest', async (req: FastifyRequest, reply: FastifyReply) => {
        const sessionId = req.cookies?.bluesky_session_id;
        if (!sessionId) return reply.code(401).send({ error: 'Missing session ID' });

        const session = getSession(sessionId);
        if (!session?.did) return reply.code(401).send({ error: 'Invalid session' });

        (req as any).user = { did: session.did };
    });
    // Send a DM
    fastify.post('/dm', async (req, rep) => {
        const did = (req as any).user.did;
        const { recipientDid, content } = req.body as {
            recipientDid: string;
            content: string;
        };

        const { content: encrypted, iv } = encrypt(content);
        const message = new Message(did, recipientDid, encrypted, iv);

        await req.em.persistAndFlush(message);
        return rep.code(201).send({ success: true });
    });

  // Fetch DMs for a given user
    fastify.get<{Params: { did: string };}>('/dm/:did', async (req, rep) => {
        const recipientDid = req.params.did as string;
        const senderDid = (req as any).user.did;

        const messages = await req.em.find(Message, {
            $or: [
                { senderDid, recipientDid },
                { senderDid: recipientDid, recipientDid: senderDid },
            ],
        }, {
            orderBy: { createdAt: 'ASC' }, // oldest to newest
        });

        const decrypted = messages.map((msg) => ({
            from: msg.senderDid,
            content: decrypt(msg.content, msg.iv),
            timestamp: msg.createdAt,
        }));

        return decrypted;
    });
}