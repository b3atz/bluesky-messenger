// routes/message.ts - Complete updated version

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Message } from '../db/entities/Message.js';
import { encrypt, decrypt } from '../utils/encryption.js';
import { getSession } from '../utils/session-store.js';

export default async function dmRoutes(fastify: FastifyInstance) {
    // Register required plugins
    fastify.register(import('@fastify/cookie'));
    fastify.register(import('@fastify/formbody'));
    fastify.register(import('@fastify/cors'), {
        origin: true, // Allow requests from any origin for development
        credentials: true // Allow cookies to be sent
    });

    // Health check endpoint
    fastify.get('/health', async (request, reply) => {
        return {
            status: 'ok',
            timestamp: new Date().toISOString(),
            server: 'Bluesky Messenger API',
            version: '1.0.0'
        };
    });

    // Debug endpoint to test connection
    fastify.get('/dm/debug', async (request, reply) => {
        return {
            status: 'ok',
            message: 'DM routes are working',
            timestamp: new Date().toISOString()
        };
    });

    // Authentication hook with bypass for development
    fastify.addHook('onRequest', async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            // Log all incoming requests for debugging
            fastify.log.info(`${req.method} ${req.url} request received`);

            // Get authentication info
            const sessionId = req.cookies?.bluesky_session_id;

            // For development - allow test DID if no session
            const bypassAuth = process.env.NODE_ENV === 'development';

            if (bypassAuth && (!sessionId || !getSession(sessionId))) {
                fastify.log.warn('Development mode: Using test DID for authentication');
                (req as any).user = { did: 'did:plc:development123456' };
                return;
            }

            if (!sessionId) {
                fastify.log.error('Missing session ID in cookies');
                fastify.log.debug('Available cookies:', req.cookies);
                return reply.code(401).send({
                    error: 'Missing session ID',
                    details: 'No bluesky_session_id cookie found'
                });
            }

            const session = getSession(sessionId);
            if (!session?.did) {
                fastify.log.error(`Invalid session: ${sessionId}`);
                return reply.code(401).send({
                    error: 'Invalid session',
                    details: 'Session not found or missing DID'
                });
            }

            fastify.log.info(`Authenticated request from ${session.did}`);
            (req as any).user = { did: session.did };
        } catch (err) {
            fastify.log.error('Authentication error:', err);
            return reply.code(500).send({
                error: 'Authentication error',
                details: err instanceof Error ? err.message : 'Unknown error'
            });
        }
    });

    // GET /dm - Get all messages for the authenticated user
    fastify.get('/dm', async (req, reply) => {
        try {
            const userDid = (req as any).user.did;
            fastify.log.info(`Fetching messages for user ${userDid}`);

            // Find all messages where user is sender or recipient
            const messages = await req.em.find(Message, {
                $or: [
                    { senderDid: userDid },
                    { recipientDid: userDid },
                ],
            }, {
                orderBy: { createdAt: 'ASC' },
            });

            fastify.log.info(`Found ${messages.length} messages for user ${userDid}`);

            // Group messages by conversation partner
            const messagesByConversation = messages.reduce((acc, message) => {
                const partnerId = message.senderDid === userDid ? message.recipientDid : message.senderDid;

                if (!acc[partnerId]) {
                    acc[partnerId] = [];
                }

                // Try to decrypt the message content
                let decryptedContent = '';
                try {
                    decryptedContent = decrypt(message.content, message.iv);
                } catch (err) {
                    fastify.log.error(`Failed to decrypt message ${message.id}: ${err}`);
                    decryptedContent = '[Encryption error]';
                }

                acc[partnerId].push({
                    id: message.id,
                    from: message.senderDid,
                    to: message.recipientDid,
                    content: decryptedContent,
                    timestamp: message.createdAt,
                    encrypted: true
                });

                return acc;
            }, {} as Record<string, any[]>);

            return reply.send(messagesByConversation);
        } catch (err) {
            fastify.log.error(`Error fetching messages: ${err}`);
            return reply.code(500).send({
                error: 'Failed to fetch messages',
                details: err instanceof Error ? err.message : 'Unknown error'
            });
        }
    });

    // POST /dm - Send a DM with extensive debugging
    fastify.post('/dm', async (req, reply) => {
        try {
            fastify.log.info('POST /dm - Received message creation request');
            fastify.log.debug('Request body:', req.body);

            const did = (req as any).user.did;
            fastify.log.info(`Sender DID: ${did}`);

            const { recipientDid, content } = req.body as {
                recipientDid: string;
                content: string;
            };

            // Validate input
            if (!recipientDid) {
                fastify.log.error('Missing recipientDid');
                return reply.code(400).send({
                    error: 'Bad Request',
                    details: 'recipientDid is required'
                });
            }

            if (!content) {
                fastify.log.error('Missing content');
                return reply.code(400).send({
                    error: 'Bad Request',
                    details: 'content is required'
                });
            }

            fastify.log.info(`Sending message from ${did} to ${recipientDid}`);
            fastify.log.debug(`Message content length: ${content.length}`);

            // Encrypt the message content
            let encrypted, iv;
            try {
                const encryptionResult = encrypt(content);
                encrypted = encryptionResult.content;
                iv = encryptionResult.iv;
                fastify.log.info('Message encrypted successfully');
            } catch (encryptError) {
                fastify.log.error('Encryption error:', encryptError);
                return reply.code(500).send({
                    error: 'Encryption failed',
                    details: encryptError instanceof Error ? encryptError.message : 'Unknown error'
                });
            }

            // Create and persist the message
            try {
                const message = new Message(did, recipientDid, encrypted, iv);

                // Log entity before persist
                fastify.log.debug('Message entity before persist:', {
                    id: message.id,
                    senderDid: message.senderDid,
                    recipientDid: message.recipientDid,
                    contentLength: message.content.length,
                    iv: message.iv,
                    createdAt: message.createdAt
                });

                await req.em.persistAndFlush(message);
                fastify.log.info(`Message persisted successfully, ID: ${message.id}`);

                return reply.code(201).send({
                    success: true,
                    messageId: message.id
                });
            } catch (dbError) {
                fastify.log.error('Database error:', dbError);
                return reply.code(500).send({
                    error: 'Failed to save message',
                    details: dbError instanceof Error ? dbError.message : 'Unknown error'
                });
            }
        } catch (err) {
            fastify.log.error(`Error sending message: ${err}`);
            return reply.code(500).send({
                error: 'Failed to send message',
                details: err instanceof Error ? err.message : 'Unknown error'
            });
        }
    });
    // Add this DELETE endpoint to your backend message.ts route file

    // DELETE /dm/:conversationId - Delete a conversation
    fastify.delete<{ Params: { conversationId: string }; }>('/dm/:conversationId', async (req, reply) => {
        try {
            const conversationId = req.params.conversationId;
            const userDid = (req as any).user.did;

            fastify.log.info(`User ${userDid} deleting conversation: ${conversationId}`);

            // Find all messages for this conversation where the user is a participant
            const messages = await req.em.find(Message, {
                $and: [
                    { $or: [{ senderDid: userDid }, { recipientDid: userDid }] },
                    // You'll need to add a conversationId field to your Message entity
                    // Or use a different approach to identify messages in a conversation
                    // This is just an example - adjust based on your actual data structure
                ]
            });

            if (messages.length === 0) {
                fastify.log.warn(`No messages found for conversation ${conversationId}`);
                return reply.code(404).send({
                    error: 'Conversation not found',
                    details: 'No messages found for this conversation ID'
                });
            }

            // Delete all messages
            for (const message of messages) {
                await req.em.removeAndFlush(message);
            }

            fastify.log.info(`Successfully deleted ${messages.length} messages for conversation ${conversationId}`);

            return reply.code(200).send({
                success: true,
                deletedCount: messages.length
            });
        } catch (err) {
            fastify.log.error(`Error deleting conversation: ${err}`);
            return reply.code(500).send({
                error: 'Failed to delete conversation',
                details: err instanceof Error ? err.message : 'Unknown error'
            });
        }
    });
    // GET /dm/:did - Fetch DMs for a specific conversation
    fastify.get<{ Params: { did: string }; }>('/dm/:did', async (req, reply) => {
        try {
            const recipientDid = req.params.did;
            const senderDid = (req as any).user.did;

            fastify.log.info(`Fetching conversation between ${senderDid} and ${recipientDid}`);

            // Find messages between these users
            const messages = await req.em.find(Message, {
                $or: [
                    { senderDid, recipientDid },
                    { senderDid: recipientDid, recipientDid: senderDid },
                ],
            }, {
                orderBy: { createdAt: 'ASC' },
            });

            fastify.log.info(`Found ${messages.length} messages in conversation`);

            // Decrypt messages
            const decrypted = messages.map((msg) => {
                let decryptedContent = '';
                try {
                    decryptedContent = decrypt(msg.content, msg.iv);
                } catch (err) {
                    fastify.log.error(`Failed to decrypt message ${msg.id}: ${err}`);
                    decryptedContent = '[Encryption error]';
                }

                return {
                    id: msg.id,
                    from: msg.senderDid,
                    to: msg.recipientDid,
                    content: decryptedContent,
                    timestamp: msg.createdAt,
                };
            });

            return reply.send(decrypted);
        } catch (err) {
            fastify.log.error(`Error fetching conversation: ${err}`);
            return reply.code(500).send({
                error: 'Failed to fetch conversation',
                details: err instanceof Error ? err.message : 'Unknown error'
            });
        }
    });
}