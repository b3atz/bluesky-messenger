import Fastify from 'fastify';
import cors from '@fastify/cors';
import authRoutes from './routes/auth';
import messageRoutes from './routes/messages';

const PORT = process.env.PORT || 3001;

async function startServer() {
  const app = Fastify();

  await app.register(cors, {
    origin: 'http://localhost:3000',
    credentials: true,
  });
  try {
    await app.listen({ port: Number(PORT) });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

startServer();