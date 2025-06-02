// src/app.ts - Fixed version without problematic imports
import Fastify from "fastify";
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import formbody from '@fastify/formbody';
import crypto from 'crypto';

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
	logger: {
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

// Register plugins
await app.register(cors, {
	origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
	credentials: true,
	methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
});

await app.register(cookie);
await app.register(formbody);

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
	request.sessionData = session.blueskySession || user; // Include Bluesky session data if available
	app.log.info(`Authenticated: ${user.handle}`);
};

// Routes
app.get('/health', async () => ({
	status: 'ok',
	timestamp: new Date().toISOString(),
	server: 'Enhanced Bluesky Messenger',
	features: ['E2EE DMs', 'Privacy-Aware Posts', 'AT Protocol Integration'],
	stats: {
		users: users.size,
		sessions: sessions.size,
		conversations: conversations.size,
		messages: messages.size,
		posts: posts.size
	}
}));

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

	// Set cookie
	reply.setCookie('bluesky_session_id', sessionId, {
		httpOnly: true,
		secure: false,
		sameSite: 'lax',
		path: '/',
		maxAge: 60 * 60 * 24 * 7
	});

	app.log.info(`Enhanced session created: ${sessionId.substring(0, 8)}... for ${handle}`);

	return {
		success: true,
		user: { did, handle },
		hasBlueskySession: !!accessJwt,
		features: ['access_control', 'privacy_enhancement', 'at_protocol_integration']
	};
});

// Add this right after your /auth/logout route in app.ts (around line 150)

app.post('/auth/logout', { preHandler: authenticate }, async (request, reply) => {
	const sessionId = request.cookies?.bluesky_session_id;
	if (sessionId) {
		sessions.delete(sessionId);
		reply.clearCookie('bluesky_session_id');
	}
	return { success: true };
});

// ADD THIS NEW DEBUG ENDPOINT RIGHT HERE:
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
		tokenInfo: {
			accessJwtLength: user.accessJwt?.length || 0,
			refreshJwtLength: user.refreshJwt?.length || 0,
			accessJwtPreview: user.accessJwt ? user.accessJwt.substring(0, 50) + '...' : 'none',
			refreshJwtPreview: user.refreshJwt ? user.refreshJwt.substring(0, 50) + '...' : 'none'
		},
		sessionAge: Math.floor((Date.now() - new Date(session.createdAt).getTime()) / 1000),
		blueskySession: !!session.blueskySession
	};
});

// ADD THIS TEST ENDPOINT TOO:
app.get('/posts/test-bluesky', { preHandler: authenticate }, async (request: any, reply) => {
	const user = request.user;

	if (!user.accessJwt || !user.refreshJwt) {
		return {
			success: false,
			error: 'No AT Protocol tokens available',
			hasTokens: false,
			message: 'Session exists but missing Bluesky tokens - cannot post to Bluesky',
			user: {
				did: user.did,
				handle: user.handle
			}
		};
	}

	try {
		// Import BskyAgent dynamically to avoid import issues
		const { BskyAgent } = await import('@atproto/api');

		// Test by creating a Bluesky agent and getting profile
		const agent = new BskyAgent({
			service: 'https://bsky.social'
		});

		// Resume the session with stored tokens
		await agent.resumeSession({
			did: user.did,
			handle: user.handle,
			accessJwt: user.accessJwt,
			refreshJwt: user.refreshJwt,
			active: true
		});

		// Test by getting the user's profile
		const profile = await agent.getProfile({ actor: user.did });

		return {
			success: true,
			message: '🎉 AT Protocol integration is working! You can post to Bluesky!',
			profile: {
				handle: profile.data.handle,
				displayName: profile.data.displayName,
				followersCount: profile.data.followersCount,
				followsCount: profile.data.followsCount,
				postsCount: profile.data.postsCount
			},
			tokens: {
				hasAccessJwt: !!user.accessJwt,
				hasRefreshJwt: !!user.refreshJwt,
				accessJwtLength: user.accessJwt.length,
				refreshJwtLength: user.refreshJwt.length
			}
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error',
			details: 'Failed to connect to AT Protocol - tokens may be invalid or expired',
			hasTokens: !!(user.accessJwt && user.refreshJwt),
			tokenLengths: {
				accessJwt: user.accessJwt?.length || 0,
				refreshJwt: user.refreshJwt?.length || 0
			}
		};
	}
});

// Replace your existing /posts POST route in app.ts with this updated version:

app.post('/posts', { preHandler: authenticate }, async (request: any, reply) => {
	const {
		title,
		content,
		accessLevel = 'public',
		privacyTechnique = 'None',
		privacyScore = 0,
		allowedDids = []
	} = request.body as {
		title: string;
		content: string;
		accessLevel?: 'public' | 'followers' | 'friends' | 'private';
		privacyTechnique?: string;
		privacyScore?: number;
		allowedDids?: string[];
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

		// Save to local storage first
		posts.set(postId, post);

		let atProtocolUri = null;
		let blueskyError = null;

		// Only publish public posts to Bluesky
		if (accessLevel === 'public' && user.accessJwt && user.refreshJwt) {
			app.log.info('🚀 Attempting to publish to Bluesky...');

			try {
				// Import BskyAgent dynamically
				const { BskyAgent } = await import('@atproto/api');

				// Create Bluesky agent
				const agent = new BskyAgent({
					service: 'https://bsky.social'
				});

				// Resume the session with stored tokens
				await agent.resumeSession({
					did: user.did,
					handle: user.handle,
					accessJwt: user.accessJwt,
					refreshJwt: user.refreshJwt,
					active: true
				});

				// Prepare the post text (combine title and content)
				const postText = title ? `${title}\n\n${content}` : content;

				// Ensure we don't exceed Bluesky's character limit (300 chars)
				const truncatedText = postText.length > 300 ?
					postText.substring(0, 297) + '...' : postText;

				app.log.info(`📝 Publishing to Bluesky: "${truncatedText.substring(0, 50)}..."`);

				// Actually post to Bluesky!
				const blueskyResult = await agent.post({
					text: truncatedText,
					createdAt: new Date().toISOString()
				});

				atProtocolUri = blueskyResult.uri;
				app.log.info(`✅ SUCCESS! Posted to Bluesky! URI: ${atProtocolUri}`);

				// Update our local post with the Bluesky URI
				post.atProtocolUri = atProtocolUri;
				posts.set(postId, post);

			} catch (publishError) {
				blueskyError = publishError instanceof Error ? publishError.message : 'Unknown error';
				app.log.error('❌ Error publishing to Bluesky:', publishError);
			}
		} else if (accessLevel === 'public') {
			blueskyError = 'No AT Protocol tokens available';
			app.log.warn('⚠️ Cannot publish to Bluesky: No tokens');
		} else {
			app.log.info(`🔒 Post marked as ${accessLevel}, not publishing to Bluesky`);
		}

		app.log.info(`Created post with access level: ${accessLevel}, Privacy: ${privacyTechnique}`);

		// Build response message
		let message = '';
		if (accessLevel === 'public') {
			if (atProtocolUri) {
				message = '🎉 Published to Bluesky AND saved to private server!';
			} else {
				message = `⚠️ Saved to private server only (Bluesky error: ${blueskyError})`;
			}
		} else {
			message = `🔒 Saved to private server only (${accessLevel} access)`;
		}

		const response: any = {
			id: postId,
			accessLevel,
			privacyScore,
			message,
			success: true
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
app.get('/posts', { preHandler: authenticate }, async (request: any, reply) => {
	const user = request.user;

	try {
		// For now, return all posts the user has access to
		const userPosts = Array.from(posts.values()).filter(post => {
			// User can see their own posts
			if (post.did === user.did) return true;

			// Public posts are visible to everyone
			if (post.accessLevel === 'public') return true;

			// For now, private/followers/friends posts are only visible to owner
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
			createdAt: post.createdAt
		}));

		app.log.info(`Returning ${formattedPosts.length} posts for user ${user.handle}`);

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

app.get('/posts/:id', { preHandler: authenticate }, async (request: any, reply) => {
	const { id } = request.params as { id: string };
	const user = request.user;

	try {
		const post = posts.get(id);
		if (!post) {
			return reply.code(404).send({ error: 'Post not found' });
		}

		// Check access control
		const hasAccess = post.did === user.did || post.accessLevel === 'public';

		if (!hasAccess) {
			return reply.code(403).send({
				error: 'Access denied',
				message: 'You do not have permission to view this post',
				accessLevel: post.accessLevel
			});
		}

		return {
			id: post.id,
			title: post.title,
			content: post.content,
			author: post.did,
			accessLevel: post.accessLevel,
			privacyScore: post.privacyScore,
			privacyTechnique: post.privacyTechnique,
			isOwn: post.did === user.did,
			createdAt: post.createdAt
		};

	} catch (error) {
		app.log.error('Error fetching post:', error);
		return reply.code(500).send({ error: 'Failed to fetch post' });
	}
});

app.delete('/posts/:id', { preHandler: authenticate }, async (request: any, reply) => {
	const { id } = request.params as { id: string };
	const user = request.user;

	try {
		const post = posts.get(id);
		if (!post || post.did !== user.did) {
			return reply.code(404).send({ error: 'Post not found or unauthorized' });
		}

		posts.delete(id);
		app.log.info(`Deleted post ${id} by ${user.handle}`);

		return { success: true };

	} catch (error) {
		app.log.error('Error deleting post:', error);
		return reply.code(500).send({ error: 'Failed to delete post' });
	}
});

// Legacy DM endpoints (keep for backward compatibility)
app.get('/dm', { preHandler: authenticate }, async (request: any) => {
	const userDid = request.user.did;

	// Get conversations for user
	const userConversations = Array.from(conversations.values())
		.filter(conv => conv.participants.includes(userDid))
		.sort((a, b) => {
			const aTime = a.lastMessage?.timestamp || a.createdAt;
			const bTime = b.lastMessage?.timestamp || b.createdAt;
			return new Date(bTime).getTime() - new Date(aTime).getTime();
		});

	// Convert to frontend format
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

	app.log.info(`Returning ${result.length} conversations for ${request.user.handle}`);
	return result;
});

app.post('/dm', { preHandler: authenticate }, async (request: any, reply) => {
	const { recipientDid, content } = request.body;
	const senderDid = request.user.did;

	if (!recipientDid || !content) {
		return reply.code(400).send({ error: 'recipientDid and content required' });
	}

	app.log.info(`Message: ${request.user.handle} → ${recipientDid}`);

	// Find or create conversation
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
		app.log.info(`New conversation: ${conversationId.substring(0, 8)}...`);
	}

	// Create message
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

	app.log.info(`Message sent: ${messageId.substring(0, 8)}...`);

	return reply.code(201).send({
		success: true,
		messageId,
		conversationId: conversation.id,
		timestamp: message.timestamp
	});
});

app.get('/dm/:did', { preHandler: authenticate }, async (request: any) => {
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

	app.log.info(`Returning ${result.length} messages for conversation`);
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

	app.log.info(`Deleted conversation ${conversationId} (${conversationMessages.length} messages)`);

	return { success: true, deletedMessages: conversationMessages.length };
});

// Error handlers
app.setErrorHandler((error, request, reply) => {
	app.log.error(error);
	reply.status(500).send({ error: 'Internal Server Error' });
});

app.setNotFoundHandler((request, reply) => {
	app.log.warn(`404: ${request.method} ${request.url}`);
	reply.status(404).send({ error: 'Route not found' });
});

// Startup
app.ready().then(() => {
	app.log.info('🚀 Enhanced server ready! Features:');
	app.log.info('  📱 End-to-End Encrypted DMs');
	app.log.info('  🔒 Privacy-Aware Posts with Access Control');
	app.log.info('  🌐 In-Memory Storage (Demo Mode)');
	app.log.info('Routes:');
	console.log(app.printRoutes());
});

export default app;