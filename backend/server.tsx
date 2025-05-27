import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import authRoutes from './routes/auth';
import messageRoutes from './routes/messages';

const PORT = process.env.PORT || 3001;

async function startServer() {
  const app = Fastify();

  // Register plugins
  await app.register(cors, {
    origin: 'http://localhost:3000',
    credentials: true,
  });

  await app.register(cookie, {
    secret: 'my-secret-key-for-cookies', // Change this to a secure key in production
    hook: 'onRequest',
  });

  // Register routes
  app.register(authRoutes, { prefix: '/auth' });
  app.register(messageRoutes, { prefix: '/messages' });

  try {
    await app.listen({ port: Number(PORT), host: '0.0.0.0' });
    console.log(`Server listening on port ${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

startServer();