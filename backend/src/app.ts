// backend/src/app.ts - Complete fixed version with proper CORS
import Fastify from "fastify";
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import formbody from '@fastify/formbody';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Simple in-memory storage for sessions (in production, use Redis or database)
interface User {
	did: string;
	handle: string;
	accessJwt?: string;
	refreshJwt?: string;
	createdAt: string;
}

interface Message {
	id: string;
	conversationId: string;
	senderId: string;
	recipientId: string;
	content: string;
	timestamp: string;
	encrypted?: boolean;
}

interface Conversation {
	id: string;
	participants: string[];
	lastMessage?: Message;
	createdAt: string;
}

interface PostData {
	id: string;
	did: string;
	title: string;
	content: string;
	accessLevel: 'public' | 'followers' | 'friends' | 'private';
	privacyScore: number;
	privacyTechnique: string;
	atProtocolUri?: string;
	createdAt: string;
}

// Storage
const users = new Map<string, User>();
const sessions = new Map<string, { userId: string; createdAt: string; blueskySession?: any }>();
const conversations = new Map<string, Conversation>();
const messages = new Map<string, Message>();
const posts = new Map<string, PostData>();

const app = Fastify({
	logger: process.env.NODE_ENV === 'production'
		? true  // Simple logging for production
		: {     // Pretty logging for development
			transport: {
				target: 'pino-pretty',
				options: {
					translateTime: 'HH:MM:ss Z',
					ignore: 'pid,hostname',
				},
			},
			level: "info",
		}
});

console.log('🚀 Starting Enhanced Bluesky Messenger Backend...');

// FIXED CORS CONFIGURATION
await app.register(cors, {
	origin: (origin, callback) => {
		// Always allow requests with no origin (mobile apps, curl, etc.)
		if (!origin) {
			console.log('✅ CORS: Allowing request with no origin');
			return callback(null, true);
		}

		// List of explicitly allowed origins
		const allowedOrigins = [
			'http://localhost:3000',
			'http://127.0.0.1:3000',
			'https://bluesky-privacy-project-c14177203721.herokuapp.com',
			'https://privacy-enhanced-bluesky-6a4a7cccefa2.herokuapp.com'
		];

		// Check exact match first
		if (allowedOrigins.includes(origin)) {
			console.log(`✅ CORS: Allowing exact match origin: ${origin}`);
			return callback(null, true);
		}

		// Allow any herokuapp.com subdomain
		if (origin.endsWith('.herokuapp.com')) {
			console.log(`✅ CORS: Allowing Heroku origin: ${origin}`);
			return callback(null, true);
		}

		// Allow localhost with any port
		if (origin.match(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/)) {
			console.log(`✅ CORS: Allowing localhost origin: ${origin}`);
			return callback(null, true);
		}

		// Log and reject unknown origins
		console.log(`❌ CORS: Blocking origin: ${origin}`);
		return callback(null, false); // Don't throw error, just return false
	},
	credentials: true,
	methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD'],
	allowedHeaders: [
		'Content-Type',
		'Authorization',
		'Cookie',
		'Accept',
		'Cache-Control',
		'X-Requested-With',
		'Origin',
		'Referer',
		'User-Agent'
	],
	optionsSuccessStatus: 200 // Some legacy browsers choke on 204
});

// Explicit preflight handler for all routes
app.options('*', async (request, reply) => {
	const origin = request.headers.origin;

	// Set CORS headers explicitly for preflight requests
	reply.header('Access-Control-Allow-Origin', origin || '*');
	reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, HEAD');
	reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie, Accept, Cache-Control, X-Requested-With, Origin, Referer, User-Agent');
	reply.header('Access-Control-Allow-Credentials', 'true');
	reply.header('Access-Control-Max-Age', '86400'); // Cache preflight for 24 hours

	console.log(`✅ CORS Preflight: ${request.method} ${request.url} from ${origin}`);
	return reply.code(200).send();
});

await app.register(cookie, {
	secret: process.env.COOKIE_SECRET || 'bluesky-messenger-secret-key-change-in-production',
	parseOptions: {
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
		path: '/'
	}
});

await app.register(formbody);

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
	// Try multiple possible frontend build locations
	const possibleFrontendPaths = [
		join(__dirname, 'frontend'),
		join(__dirname, '../frontend/out'),
		join(__dirname, '../../frontend/out'),
		join(__dirname, 'public'),
		join(__dirname, '../public')
	];

	let frontendPath = null;
	for (const path of possibleFrontendPaths) {
		if (fs.existsSync(path)) {
			frontendPath = path;
			console.log(`✅ Found frontend files at: ${path}`);
			break;
		}
	}

	if (frontendPath) {
		// Register static file serving
		await app.register(import('@fastify/static'), {
			root: frontendPath,
			prefix: '/',
		});

		// Serve index.html for client-side routing
		app.setNotFoundHandler(async (request, reply) => {
			// If it's an API route, return 404
			if (request.url.startsWith('/api') ||
				request.url.startsWith('/auth') ||
				request.url.startsWith('/dm') ||
				request.url.startsWith('/posts') ||
				request.url.startsWith('/health')) {
				return reply.code(404).send({ error: 'API endpoint not found' });
			}

			// For all other routes, serve the React app
			const indexPath = join(frontendPath, 'index.html');
			if (fs.existsSync(indexPath)) {
				return reply.type('text/html').sendFile('index.html');
			} else {
				return reply.code(404).send({ error: 'Frontend not found' });
			}
		});
	} else {
		console.warn('⚠️ No frontend files found. API-only mode.');

		// Serve a simple HTML page for the root route
		app.get('/', async (request, reply) => {
			return reply.type('text/html').send(`
				<!DOCTYPE html>
				<html>
				<head>
					<title>Bluesky Messenger API</title>
					<style>
						body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
						.status { padding: 10px; border-radius: 5px; margin: 10px 0; }
						.success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
						.info { background: #d1ecf1; color: #0c5460; border: 1px solid #b8daff; }
					</style>
				</head>
				<body>
					<h1>🚀 Bluesky Messenger API</h1>
					<div class="status success">✅ Backend is running successfully!</div>
					<div class="status info">ℹ️ Frontend not found - API endpoints are available</div>
					
					<h2>Available Endpoints:</h2>
					<ul>
						<li><strong>GET /health</strong> - API health check</li>
						<li><strong>POST /auth/login</strong> - User authentication</li>
						<li><strong>GET /dm</strong> - Get messages</li>
						<li><strong>POST /dm</strong> - Send message</li>
						<li><strong>GET /posts</strong> - Get posts</li>
						<li><strong>POST /posts</strong> - Create post</li>
					</ul>
					
					<p><strong>Environment:</strong> ${process.env.NODE_ENV || 'development'}</p>
					<p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
				</body>
				</html>
			`);
		});
	}
}

// Enhanced auth middleware that supports both simple and Bluesky sessions
const authenticate = async (request: any, reply: any) => {
	const sessionId = request.cookies?.bluesky_session_id;

	if (!sessionId) {
		app.log.warn('No session ID');
		return reply.code(401).send({ error: 'Authentication required' });
	}

	const session = sessions.get(sessionId);
	if (!session) {
		app.log.warn(`Invalid session: ${sessionId}`);
		return reply.code(401).send({ error: 'Invalid session' });
	}

	const user = users.get(session.userId);
	if (!user) {
		app.log.warn(`User not found for session`);
		return reply.code(401).send({ error: 'User not found' });
	}

	request.user = user;
	request.sessionData = session.blueskySession || user;
	app.log.info(`Authenticated: ${user.handle}`);
};

// Routes
app.get('/health', async (request, reply) => {
	// Add CORS headers to health check too
	const origin = request.headers.origin;
	if (origin) {
		reply.header('Access-Control-Allow-Origin', origin);
		reply.header('Access-Control-Allow-Credentials', 'true');
	}

	return {
		status: 'ok',
		timestamp: new Date().toISOString(),
		server: 'Enhanced Bluesky Messenger',
		environment: process.env.NODE_ENV || 'development',
		features: ['E2EE DMs', 'Privacy-Aware Posts', 'AT Protocol Integration'],
		stats: {
			users: users.size,
			sessions: sessions.size,
			conversations: conversations.size,
			messages: messages.size,
			posts: posts.size
		}
	};
});

// Enhanced Auth Routes
app.post('/auth/login', async (request, reply) => {
	const { did, handle, accessJwt, refreshJwt } = request.body as {
		did: string;
		handle: string;
		accessJwt?: string;
		refreshJwt?: string;
	};

	app.log.info(`Enhanced login: ${handle} (${did})`);

	if (!did || !handle) {
		return reply.code(400).send({ error: 'DID and handle required' });
	}

	// Create/update user with Bluesky session info
	const user: User = {
		did,
		handle,
		accessJwt,
		refreshJwt,
		createdAt: users.has(did) ? users.get(did)!.createdAt : new Date().toISOString()
	};
	users.set(did, user);

	// Create session with Bluesky session data
	const sessionId = crypto.randomUUID();
	const sessionData = {
		userId: did,
		createdAt: new Date().toISOString(),
		blueskySession: accessJwt ? { did, handle, accessJwt, refreshJwt } : null
	};
	sessions.set(sessionId, sessionData);

	// Set cookie with environment-appropriate settings
	reply.setCookie('bluesky_session_id', sessionId, {
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
		path: '/',
		maxAge: 60 * 60 * 24 * 7 // 7 days
	});

	app.log.info(`Enhanced session created: ${sessionId.substring(0, 8)}... for ${handle}`);

	return {
		success: true,
		user: { did, handle },
		hasBlueskySession: !!accessJwt,
		features: ['access_control', 'privacy_enhancement', 'at_protocol_integration']
	};
});

app.post('/auth/logout', { preHandler: authenticate }, async (request, reply) => {
	const sessionId = request.cookies?.bluesky_session_id;
	if (sessionId) {
		sessions.delete(sessionId);
		reply.clearCookie('bluesky_session_id');
	}
	return { success: true };
});

// Debug endpoint
app.get('/auth/debug', async (request, reply) => {
	const sessionId = request.cookies?.bluesky_session_id;

	if (!sessionId) {
		return {
			authenticated: false,
			sessionId: null,
			error: 'No session cookie found',
			availableCookies: Object.keys(request.cookies || {})
		};
	}

	const session = sessions.get(sessionId);

	if (!session) {
		return {
			authenticated: false,
			sessionId: sessionId.substring(0, 8) + '...',
			error: 'Session not found in store'
		};
	}

	const user = users.get(session.userId);

	if (!user) {
		return {
			authenticated: false,
			sessionId: sessionId.substring(0, 8) + '...',
			error: 'User not found'
		};
	}

	return {
		authenticated: true,
		sessionId: sessionId.substring(0, 8) + '...',
		user: {
			did: user.did,
			handle: user.handle
		},
		hasTokens: !!(user.accessJwt && user.refreshJwt),
		sessionAge: Math.floor((Date.now() - new Date(session.createdAt).getTime()) / 1000),
		blueskySession: !!session.blueskySession
	};
});

// Posts endpoint with AT Protocol integration
app.post('/posts', { preHandler: authenticate }, async (request: any, reply) => {
	const {
		title,
		content,
		accessLevel = 'public',
		privacyTechnique = 'None',
		privacyScore = 0,
	} = request.body as {
		title: string;
		content: string;
		accessLevel?: 'public' | 'followers' | 'friends' | 'private';
		privacyTechnique?: string;
		privacyScore?: number;
	};

	const user = request.user;

	try {
		const postId = crypto.randomUUID();
		const post: PostData = {
			id: postId,
			did: user.did,
			title,
			content,
			accessLevel,
			privacyScore,
			privacyTechnique,
			createdAt: new Date().toISOString()
		};

		posts.set(postId, post);

		let atProtocolUri = null;
		let blueskyError = null;

		// Only publish public posts to Bluesky
		if (accessLevel === 'public' && user.accessJwt && user.refreshJwt) {
			try {
				const { BskyAgent } = await import('@atproto/api');
				const agent = new BskyAgent({ service: 'https://bsky.social' });

				await agent.resumeSession({
					did: user.did,
					handle: user.handle,
					accessJwt: user.accessJwt,
					refreshJwt: user.refreshJwt,
					active: true
				});

				const postText = title ? `${title}\n\n${content}` : content;
				const truncatedText = postText.length > 300 ? postText.substring(0, 297) + '...' : postText;

				const blueskyResult = await agent.post({
					text: truncatedText,
					createdAt: new Date().toISOString()
				});

				atProtocolUri = blueskyResult.uri;
				post.atProtocolUri = atProtocolUri;
				posts.set(postId, post);

				app.log.info(`✅ Posted to Bluesky! URI: ${atProtocolUri}`);
			} catch (publishError) {
				blueskyError = publishError instanceof Error ? publishError.message : 'Unknown error';
				app.log.error('❌ Error publishing to Bluesky:', publishError);
			}
		}

		const response: any = {
			id: postId,
			accessLevel,
			privacyScore,
			success: true,
			message: atProtocolUri
				? '🎉 Published to Bluesky AND saved to private server!'
				: accessLevel === 'public'
					? `⚠️ Saved to private server only (Bluesky error: ${blueskyError})`
					: `🔒 Saved to private server only (${accessLevel} access)`
		};

		if (atProtocolUri) {
			response.atProtocolUri = atProtocolUri;
			response.blueskyUrl = `https://bsky.app/profile/${user.handle}/post/${atProtocolUri.split('/').pop()}`;
		}

		return reply.code(201).send(response);
	} catch (error) {
		app.log.error('❌ Error creating post:', error);
		return reply.code(500).send({
			error: 'Failed to create post',
			details: error instanceof Error ? error.message : 'Unknown error'
		});
	}
});

// Get posts
app.get('/posts', { preHandler: authenticate }, async (request: any, reply) => {
	const user = request.user;

	try {
		const userPosts = Array.from(posts.values()).filter(post => {
			if (post.did === user.did) return true;
			if (post.accessLevel === 'public') return true;
			return false;
		});

		const formattedPosts = userPosts.map(post => ({
			id: post.id,
			title: post.title,
			content: post.content,
			author: post.did,
			accessLevel: post.accessLevel,
			privacyScore: post.privacyScore,
			privacyTechnique: post.privacyTechnique,
			isOwn: post.did === user.did,
			createdAt: post.createdAt,
			atProtocolUri: post.atProtocolUri
		}));

		return {
			posts: formattedPosts,
			totalPosts: posts.size,
			accessiblePosts: formattedPosts.length,
			userDid: user.did
		};
	} catch (error) {
		app.log.error('Error fetching posts:', error);
		return reply.code(500).send({ error: 'Failed to fetch posts' });
	}
});

// DM Routes (keeping existing functionality)
app.get('/dm', { preHandler: authenticate }, async (request: any) => {
	const userDid = request.user.did;

	const userConversations = Array.from(conversations.values())
		.filter(conv => conv.participants.includes(userDid))
		.sort((a, b) => {
			const aTime = a.lastMessage?.timestamp || a.createdAt;
			const bTime = b.lastMessage?.timestamp || b.createdAt;
			return new Date(bTime).getTime() - new Date(aTime).getTime();
		});

	const result = userConversations.map(conv => {
		const otherParticipant = conv.participants.find(p => p !== userDid);
		const otherUser = otherParticipant ? users.get(otherParticipant) : null;

		return {
			id: conv.id,
			participantDid: otherParticipant || 'unknown',
			participantHandle: otherUser?.handle || 'Unknown User',
			lastMessage: conv.lastMessage ? {
				text: conv.lastMessage.content,
				timestamp: conv.lastMessage.timestamp,
				isEncrypted: true
			} : null,
			unreadCount: 0
		};
	});

	return result;
});

app.post('/dm', { preHandler: authenticate }, async (request: any, reply) => {
	const { recipientDid, content } = request.body;
	const senderDid = request.user.did;

	if (!recipientDid || !content) {
		return reply.code(400).send({ error: 'recipientDid and content required' });
	}

	const participants = [senderDid, recipientDid].sort();
	let conversation = Array.from(conversations.values())
		.find(conv =>
			conv.participants.length === 2 &&
			conv.participants.every(p => participants.includes(p))
		);

	if (!conversation) {
		const conversationId = crypto.randomUUID();
		conversation = {
			id: conversationId,
			participants,
			createdAt: new Date().toISOString()
		};
		conversations.set(conversationId, conversation);
	}

	const messageId = crypto.randomUUID();
	const message: Message = {
		id: messageId,
		conversationId: conversation.id,
		senderId: senderDid,
		recipientId: recipientDid,
		content,
		timestamp: new Date().toISOString(),
		encrypted: true
	};

	messages.set(messageId, message);
	conversation.lastMessage = message;
	conversations.set(conversation.id, conversation);

	return reply.code(201).send({
		success: true,
		messageId,
		conversationId: conversation.id,
		timestamp: message.timestamp
	});
});

app.get('/dm/:did', { preHandler: authenticate }, async (request: any, reply) => {
	const recipientDid = request.params.did;
	const senderDid = request.user.did;

	// Find conversation
	const participants = [senderDid, recipientDid].sort();
	const conversation = Array.from(conversations.values())
		.find(conv =>
			conv.participants.length === 2 &&
			conv.participants.every(p => participants.includes(p))
		);

	if (!conversation) {
		return [];
	}

	// Get messages
	const conversationMessages = Array.from(messages.values())
		.filter(msg => msg.conversationId === conversation.id)
		.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

	const result = conversationMessages.map(msg => ({
		id: msg.id,
		from: msg.senderId,
		to: msg.recipientId,
		content: msg.content,
		timestamp: msg.timestamp
	}));

	return result;
});

app.delete('/dm/:conversationId', { preHandler: authenticate }, async (request: any, reply) => {
	const conversationId = request.params.conversationId;
	const userDid = request.user.did;

	const conversation = conversations.get(conversationId);
	if (!conversation || !conversation.participants.includes(userDid)) {
		return reply.code(404).send({ error: 'Conversation not found' });
	}

	// Delete messages
	const conversationMessages = Array.from(messages.entries())
		.filter(([_, msg]) => msg.conversationId === conversationId);

	conversationMessages.forEach(([msgId, _]) => messages.delete(msgId));
	conversations.delete(conversationId);

	return { success: true, deletedMessages: conversationMessages.length };
});

// Error handlers
app.setErrorHandler((error, request, reply) => {
	app.log.error(error);

	// Add CORS headers even to error responses
	const origin = request.headers.origin;
	if (origin) {
		reply.header('Access-Control-Allow-Origin', origin);
		reply.header('Access-Control-Allow-Credentials', 'true');
	}

	reply.status(500).send({ error: 'Internal Server Error' });
});

export default app;