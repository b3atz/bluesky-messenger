// backend/src/index.ts - Updated for Heroku deployment
import dotenv from "dotenv";
import app from "./app.js";

// Load environment variables
dotenv.config();

async function bootstrap() {
  try {
    console.log('🚀 Starting Bluesky Messenger Backend...');
    console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);

    // Heroku sets HOST to 0.0.0.0 and provides PORT
    const HOST = process.env.NODE_ENV === 'production' ? '0.0.0.0' : (process.env.HOST || '127.0.0.1');
    const PORT = Number(process.env.PORT) || 3001;

    console.log(`🔧 Host: ${HOST}`);
    console.log(`🚪 Port: ${PORT}`);

    // Start the server
    await app.listen({
      port: PORT,
      host: HOST
    });

    const serverUrl = process.env.NODE_ENV === 'production'
      ? `https://${process.env.HEROKU_APP_NAME || 'your-app'}.herokuapp.com`
      : `http://${HOST}:${PORT}`;

    console.log(`✅ Server successfully started!`);
    console.log(`🌐 Server URL: ${serverUrl}`);
    console.log(`🏥 Health Check: ${serverUrl}/health`);
    console.log(`🐛 Debug Endpoint: ${serverUrl}/auth/debug`);
    console.log('');
    console.log('📝 Available endpoints:');
    console.log('   GET  /health           - Health check');
    console.log('   GET  /auth/debug       - Debug session status');
    console.log('   POST /auth/login       - Login with DID and handle');
    console.log('   POST /auth/logout      - Logout');
    console.log('   GET  /posts            - Get posts');
    console.log('   POST /posts            - Create post (with Bluesky integration!)');
    console.log('   GET  /posts/test-bluesky - Test AT Protocol connection');
    console.log('   GET  /dm               - Get conversations');
    console.log('   POST /dm               - Send message');
    console.log('   GET  /dm/:did          - Get messages with specific user');
    console.log('   DELETE /dm/:convId     - Delete conversation');
    console.log('');
    console.log('🎯 Ready to accept connections from frontend!');

    if (process.env.NODE_ENV === 'production') {
      console.log('🚀 Production mode: AT Protocol integration active!');
    }

  } catch (err) {
    console.error("💥 Error starting server:", err);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT. Shutting down gracefully...');
  try {
    await app.close();
    console.log('✅ Server closed successfully');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error during shutdown:', err);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM. Shutting down gracefully...');
  try {
    await app.close();
    console.log('✅ Server closed successfully');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error during shutdown:', err);
    process.exit(1);
  }
});

bootstrap();