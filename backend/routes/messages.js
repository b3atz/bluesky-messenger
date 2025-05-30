// File: backend/routes/messages.js

// Import auth module for users and authentication
const { users, authenticate } = require('./auth');

// In-memory storage for conversations and messages
const conversations = new Map();
const messages = new Map();

/**
 * Message routes for handling conversations and messages
 * @param {FastifyInstance} fastify - Fastify instance
 * @param {Object} options - Options passed to the plugin
 */
async function messageRoutes(fastify, options) {
  // Get all conversations for the user
  fastify.get('/', { preHandler: authenticate }, async (request, reply) => {
    const { did } = request.user;
    
    // Get conversations for this user
    const userConversations = Array.from(conversations.values())
      .filter(conv => conv.participants.includes(did))
      .map(conv => {
        // Find the other participant
        const otherParticipantDid = conv.participants.find(p => p !== did);
        const otherParticipant = users.get(otherParticipantDid);
        
        // Get last message
        const conversationMessages = Array.from(messages.values())
          .filter(msg => msg.conversationId === conv.id)
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        const lastMessage = conversationMessages.length > 0 ? conversationMessages[0] : null;
        
        // Count unread messages
        const unreadCount = conversationMessages.filter(
          msg => !msg.isRead && msg.receiverId === did
        ).length;
        
        return {
          id: conv.id,
          participantDid: otherParticipantDid,
          participantHandle: otherParticipant?.handle || otherParticipantDid,
          lastMessage: lastMessage ? {
            text: 'Encrypted message',
            timestamp: lastMessage.timestamp,
            isEncrypted: true
          } : undefined,
          unreadCount
        };
      });
    
    return { conversations: userConversations };
  });
  
  // Get messages for a specific conversation
  fastify.get('/conversations/:id', { preHandler: authenticate }, async (request, reply) => {
    const { did } = request.user;
    const { id } = request.params;
    
    const conversation = conversations.get(id);
    
    if (!conversation || !conversation.participants.includes(did)) {
      return reply.code(404).send({ error: 'Conversation not found' });
    }
    
    // Get messages for this conversation
    const conversationMessages = Array.from(messages.values())
      .filter(msg => msg.conversationId === id)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    return { messages: conversationMessages };
  });
  
  // Send a message
  fastify.post('/send', { preHandler: authenticate }, async (request, reply) => {
    const { did } = request.user;
    const { receiverId, encryptedContent } = request.body;
    
    if (!receiverId || !encryptedContent) {
      return reply.code(400).send({ error: 'Missing required fields' });
    }
    
    // Find or create conversation
    let conversation = Array.from(conversations.values())
      .find(conv => 
        conv.participants.includes(did) && 
        conv.participants.includes(receiverId)
      );
    
    if (!conversation) {
      const conversationId = Math.random().toString(36).substring(2, 15);
      conversation = {
        id: conversationId,
        participants: [did, receiverId],
        createdAt: new Date().toISOString()
      };
      conversations.set(conversationId, conversation);
    }
    
    // Create message
    const messageId = Math.random().toString(36).substring(2, 15);
    const message = {
      id: messageId,
      senderId: did,
      receiverId,
      conversationId: conversation.id,
      encryptedContent,
      timestamp: new Date().toISOString(),
      isDelivered: false,
      isRead: false
    };
    
    messages.set(messageId, message);
    
    return { 
      success: true, 
      messageId, 
      conversationId: conversation.id 
    };
  });
  
  // Mark messages as read
  fastify.post('/mark-read', { preHandler: authenticate }, async (request, reply) => {
    const { did } = request.user;
    const { messageIds } = request.body;
    
    if (!Array.isArray(messageIds)) {
      return reply.code(400).send({ error: 'messageIds must be an array' });
    }
    
    let updatedCount = 0;
    
    messageIds.forEach(id => {
      const message = messages.get(id);
      if (message && message.receiverId === did) {
        message.isRead = true;
        updatedCount++;
      }
    });
    
    return { success: true, updatedCount };
  });
}

module.exports = messageRoutes;