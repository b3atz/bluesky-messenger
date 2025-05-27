// File: backend/routes/auth.js

// In-memory storage for users and sessions
const users = new Map();
const sessions = new Map();

/**
 * Auth routes for handling login/logout
 * @param {FastifyInstance} fastify - Fastify instance
 * @param {Object} options - Options passed to the plugin
 */
async function authRoutes(fastify, options) {
  // Login route
  fastify.post('/auth/login', async (request, reply) => {
    const { did, handle } = request.body;
    
    if (!did || !handle) {
      return reply.code(400).send({ error: 'Missing required fields' });
    }
    
    // Store user info
    users.set(did, { did, handle });
    
    // Create a session
    const sessionId = Math.random().toString(36).substring(2, 15);
    sessions.set(sessionId, { did, handle });
    
    // Set session cookie
    reply.setCookie('session_id', sessionId, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 1 week
    });
    
    return { success: true };
  });
  
  // Logout route
  fastify.post('/logout', async (request, reply) => {
    const sessionId = request.cookies.session_id;
    
    if (sessionId) {
      sessions.delete(sessionId);
      reply.clearCookie('session_id');
    }
    
    return { success: true };
  });
}

// Export the routes plugin
module.exports = authRoutes;

// Export users and sessions for use in other modules
module.exports.users = users;
module.exports.sessions = sessions;

// Helper function to authenticate requests
module.exports.authenticate = async (request, reply) => {
  const sessionId = request.cookies.session_id;
  
  if (!sessionId || !sessions.has(sessionId)) {
    reply.code(401).send({ error: 'Unauthorized' });
    return false;
  }
  
  request.user = sessions.get(sessionId);
  return true;
};