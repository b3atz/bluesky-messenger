// File: backend/server.js
const Fastify = require('fastify');
const fastifyCors = require('@fastify/cors');
const fastifyCookie = require('@fastify/cookie');
const path = require('path');

// Import route files
const authRoutes = require('./routes/auth');
const messageRoutes = require('./routes/messages');

const PORT = process.env.PORT || 3001;

async function startServer() {
  const app = Fastify();

  // Register plugins
  await app.register(fastifyCors, {
    origin: 'http://localhost:3000',
    credentials: true,
  });

  await app.register(fastifyCookie, {
    secret: 'my-secret-key-for-cookies', // Change this to a secure key in production
    hook: 'onRequest',
  });

  // Register routes
  app.register(authRoutes, { prefix: '/auth' });
  app.register(messageRoutes, { prefix: '/messages' });

  // Add a test route
  app.get('/test', async () => {
    return { message: 'Server is working!' };
  });

  try {
    await app.listen({ port: Number(PORT), host: '0.0.0.0' });
    console.log(`Server listening on port ${PORT}`);
  } catch (err) {
    console.error('Error starting server:', err);
    process.exit(1);
  }
}

startServer();