import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from 'fastify';

declare module 'fastify' {
    interface FastifyRequest {
        user?: {
            did: string;
        };
    }
}

// Types for our messages
interface EncryptedMessage {
    nonce: string;
    message: string;
    publicKey: string;
}

interface Message {
    id: string;
    senderId: string;
    receiverId: string;
    encryptedContent: EncryptedMessage;
    timestamp: string;
    isDelivered: boolean;
    isRead: boolean;
}

interface Conversation {
    id: string;
    participants: string[]; // DIDs of participants
    lastMessageId?: string;
    createdAt: string;
    updatedAt: string;
}

// Extended request type with user property
interface AuthenticatedRequest extends FastifyRequest {
    user?: {
        did: string;
    };
}

// Request types for different endpoints
interface SendMessageRequest extends AuthenticatedRequest {
    Body: {
        receiverId: string;
        encryptedContent: EncryptedMessage;
    };
}

interface MarkReadRequest extends AuthenticatedRequest {
    Body: {
        messageIds: string[];
    };
}

interface ConversationIdParams {
    Params: {
        id: string;
    };
}

interface MessageIdParams {
    Params: {
        id: string;
    };
}

/**
 * Messaging routes for the Bluesky messenger
 * Handles sending, receiving, and managing messages
 */
export default async function messageRoutes(
    fastify: FastifyInstance,
    options: FastifyPluginOptions
) {
    // In-memory storage (in a real app, use a database)
    const messages = new Map<string, Message>();
    const conversations = new Map<string, Conversation>();
    const userConversations = new Map<string, Set<string>>();

    // Helper function to generate a unique ID
    const generateId = () => Math.random().toString(36).substring(2, 15);

    // Helper function to get a conversation between two users
    const getOrCreateConversation = (user1: string, user2: string): string => {
        // Sort DIDs to ensure consistent conversation ID
        const participants = [user1, user2].sort();

        // Check if conversation exists
        for (const [id, convo] of conversations.entries()) {
            if (
                convo.participants.length === 2 &&
                convo.participants.includes(participants[0]) &&
                convo.participants.includes(participants[1])
            ) {
                return id;
            }
        }

        // Create new conversation
        const conversationId = generateId();
        const now = new Date().toISOString();

        conversations.set(conversationId, {
            id: conversationId,
            participants,
            createdAt: now,
            updatedAt: now,
        });

        // Add to user's conversations
        for (const participant of participants) {
            if (!userConversations.has(participant)) {
                userConversations.set(participant, new Set());
            }
            userConversations.get(participant)!.add(conversationId);
        }

        return conversationId;
    };

    // Authentication middleware
    const authenticate = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<boolean> => {
        const sessionDid = request.cookies.bsky_messenger_session;

        if (!sessionDid) {
            reply.code(401).send({ error: 'Not authenticated' });
            return false;
        }

        request.user = { did: sessionDid };
        return true;
    };

    /**
     * Get all conversations for the current user
     */
    fastify.get('/', async (request: AuthenticatedRequest, reply: FastifyReply) => {
        if (!await authenticate(request, reply)) return;

        const userDid = request.user!.did;
        const userConvoIds = userConversations.get(userDid) || new Set();

        const result = [];

        for (const conversationId of userConvoIds) {
            const conversation = conversations.get(conversationId);
            if (!conversation) continue;

            // Get the other participant
            const otherParticipant = conversation.participants.find(p => p !== userDid);

            // Get the last message
            let lastMessage = undefined;
            if (conversation.lastMessageId) {
                const msg = messages.get(conversation.lastMessageId);
                if (msg) {
                    lastMessage = {
                        text: 'Encrypted message', // We don't decrypt on the server
                        timestamp: msg.timestamp,
                        isEncrypted: true,
                    };
                }
            }

            result.push({
                id: conversationId,
                participantDid: otherParticipant,
                participantHandle: otherParticipant, // In a real app, get handle from user DB
                lastMessage,
                unreadCount: 0, // In a real app, calculate this
            });
        }

        return { conversations: result };
    });

    /**
     * Get messages for a specific conversation
     */
    fastify.get<AuthenticatedRequest & ConversationIdParams>(
        '/conversations/:id',
        async (request, reply) => {
            if (!await authenticate(request, reply)) return;

            const userDid = request.user!.did;
            const { id } = request.params;

            const conversation = conversations.get(id);
            if (!conversation) {
                return reply.code(404).send({ error: 'Conversation not found' });
            }

            // Make sure user is a participant
            if (!conversation.participants.includes(userDid)) {
                return reply.code(403).send({ error: 'Not authorized to view this conversation' });
            }

            // Get all messages for this conversation
            const conversationMessages = Array.from(messages.values())
                .filter(msg => {
                    // Filter messages between these participants
                    return conversation.participants.includes(msg.senderId) &&
                        conversation.participants.includes(msg.receiverId);
                })
                .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

            return { messages: conversationMessages };
        }
    );

    /**
     * Send a message to another user
     */
    fastify.post<SendMessageRequest>('/send', async (request, reply) => {
        if (!await authenticate(request, reply)) return;

        const userDid = request.user!.did;
        const { receiverId, encryptedContent } = request.body;

        if (!receiverId || !encryptedContent) {
            return reply.code(400).send({ error: 'Missing required fields' });
        }

        // Get or create conversation
        const conversationId = getOrCreateConversation(userDid, receiverId);

        // Create message
        const messageId = generateId();
        const now = new Date().toISOString();

        const message: Message = {
            id: messageId,
            senderId: userDid,
            receiverId,
            encryptedContent,
            timestamp: now,
            isDelivered: false,
            isRead: false,
        };

        // Store the message
        messages.set(messageId, message);

        // Update conversation
        const conversation = conversations.get(conversationId)!;
        conversations.set(conversationId, {
            ...conversation,
            lastMessageId: messageId,
            updatedAt: now,
        });

        return { messageId, conversationId };
    });

    /**
     * Mark messages as read
     */
    fastify.post<MarkReadRequest>('/mark-read', async (request, reply) => {
        if (!await authenticate(request, reply)) return;

        const userDid = request.user!.did;
        const { messageIds } = request.body;

        if (!messageIds || !Array.isArray(messageIds)) {
            return reply.code(400).send({ error: 'Missing required fields' });
        }

        // Mark messages as read
        for (const messageId of messageIds) {
            const message = messages.get(messageId);
            if (message && message.receiverId === userDid) {
                messages.set(messageId, {
                    ...message,
                    isRead: true,
                });
            }
        }

        return { success: true };
    });

    /**
     * Delete a message (from user's view only)
     */
    fastify.delete<AuthenticatedRequest & MessageIdParams>('/:id', async (request, reply) => {
        if (!await authenticate(request, reply)) return;

        const userDid = request.user!.did;
        const { id } = request.params;

        const message = messages.get(id);
        if (!message) {
            return reply.code(404).send({ error: 'Message not found' });
        }

        // Check if user is sender or receiver
        if (message.senderId !== userDid && message.receiverId !== userDid) {
            return reply.code(403).send({ error: 'Not authorized to delete this message' });
        }

        // In a real app, we'd mark as deleted for this user only
        // For this example, we'll just remove it
        messages.delete(id);

        return { success: true };
    });

    /**
     * Delete an entire conversation
     */
    fastify.delete<AuthenticatedRequest & ConversationIdParams>('/conversations/:id', async (request, reply) => {
        if (!await authenticate(request, reply)) return;

        const userDid = request.user!.did;
        const { id } = request.params;

        const conversation = conversations.get(id);
        if (!conversation) {
            return reply.code(404).send({ error: 'Conversation not found' });
        }

        // Make sure user is a participant
        if (!conversation.participants.includes(userDid)) {
            return reply.code(403).send({ error: 'Not authorized to delete this conversation' });
        }

        // In a real app, we'd mark as deleted for this user only
        // For this example, we'll just remove it
        conversations.delete(id);

        // Remove from user's conversations
        const userConvos = userConversations.get(userDid);
        if (userConvos) {
            userConvos.delete(id);
        }

        return { success: true };
    });
}