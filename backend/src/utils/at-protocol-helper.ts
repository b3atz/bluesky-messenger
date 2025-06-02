// utils/at-protocol-helper.ts
import { BskyAgent, AtpSessionData, AtpSessionEvent } from '@atproto/api';

export interface BlueskySession {
    did: string;
    handle: string;
    accessJwt: string;
    refreshJwt: string;
    email?: string;
    active?: boolean;
}

export interface FollowRelationship {
    isFollowing: boolean;
    isFollowedBy: boolean;
    isMutual: boolean;
}

export class ATProtocolHelper {
    private static agents = new Map<string, BskyAgent>();

    /**
     * Create or get a cached Bluesky agent for a user session
     */
    static async getAgent(session: BlueskySession): Promise<BskyAgent> {
        const cacheKey = `${session.did}-${session.accessJwt}`;

        if (this.agents.has(cacheKey)) {
            return this.agents.get(cacheKey)!;
        }

        const agent = new BskyAgent({
            service: 'https://bsky.social',
            persistSession: (evt: AtpSessionEvent, sess?: AtpSessionData) => {
                // In a real app, you'd want to update the stored session
                console.log('Session event:', evt, sess);
            }
        });

        try {
            const sessionData: AtpSessionData = {
                did: session.did,
                handle: session.handle,
                accessJwt: session.accessJwt,
                refreshJwt: session.refreshJwt,
                active: session.active ?? true
            };

            await agent.resumeSession(sessionData);

            this.agents.set(cacheKey, agent);
            return agent;
        } catch (error) {
            console.error('Failed to resume Bluesky session:', error);
            throw new Error('Failed to authenticate with Bluesky');
        }
    }

    /**
     * Check the follow relationship between two users
     */
    static async checkFollowRelationship(
        agent: BskyAgent,
        userDid: string,
        targetDid: string
    ): Promise<FollowRelationship> {
        try {
            // Check if user follows target
            const userFollowsResponse = await agent.app.bsky.graph.getFollows({
                actor: userDid,
                limit: 100 // In production, implement pagination
            });

            const isFollowing = userFollowsResponse.data.follows.some(
                follow => follow.did === targetDid
            );

            // Check if target follows user
            const targetFollowsResponse = await agent.app.bsky.graph.getFollows({
                actor: targetDid,
                limit: 100
            });

            const isFollowedBy = targetFollowsResponse.data.follows.some(
                follow => follow.did === userDid
            );

            return {
                isFollowing,
                isFollowedBy,
                isMutual: isFollowing && isFollowedBy
            };
        } catch (error) {
            console.error('Error checking follow relationship:', error);
            return {
                isFollowing: false,
                isFollowedBy: false,
                isMutual: false
            };
        }
    }

    /**
     * Get a user's followers (with pagination support)
     */
    static async getFollowers(
        agent: BskyAgent,
        userDid: string,
        limit: number = 100,
        cursor?: string
    ): Promise<{ followers: any[], cursor?: string }> {
        try {
            const response = await agent.app.bsky.graph.getFollowers({
                actor: userDid,
                limit,
                cursor
            });

            return {
                followers: response.data.followers,
                cursor: response.data.cursor
            };
        } catch (error) {
            console.error('Error fetching followers:', error);
            return { followers: [] };
        }
    }

    /**
     * Get users that a user is following
     */
    static async getFollowing(
        agent: BskyAgent,
        userDid: string,
        limit: number = 100,
        cursor?: string
    ): Promise<{ following: any[], cursor?: string }> {
        try {
            const response = await agent.app.bsky.graph.getFollows({
                actor: userDid,
                limit,
                cursor
            });

            return {
                following: response.data.follows,
                cursor: response.data.cursor
            };
        } catch (error) {
            console.error('Error fetching following:', error);
            return { following: [] };
        }
    }

    /**
     * Publish a post to Bluesky (for public posts only)
     */
    static async publishPost(
        agent: BskyAgent,
        title: string,
        content: string,
        accessLevel: string
    ): Promise<{ uri: string; cid: string } | null> {
        try {
            // Only publish public posts to the main Bluesky network
            if (accessLevel !== 'public') {
                return null;
            }

            const postText = title ? `${title}\n\n${content}` : content;

            // Ensure we don't exceed AT Protocol limits
            const truncatedText = postText.length > 300 ? postText.substring(0, 297) + '...' : postText;

            const response = await agent.post({
                text: truncatedText,
                createdAt: new Date().toISOString()
            });

            return {
                uri: response.uri,
                cid: response.cid
            };
        } catch (error) {
            console.error('Error publishing to Bluesky:', error);
            return null;
        }
    }

    /**
     * Get a user's profile information
     */
    static async getProfile(agent: BskyAgent, userDid: string) {
        try {
            const response = await agent.getProfile({ actor: userDid });
            return response.data;
        } catch (error) {
            console.error('Error fetching profile:', error);
            return null;
        }
    }

    /**
     * Check if a user has access to view a post based on access rules
     */
    static async checkPostAccess(
        agent: BskyAgent,
        postAuthorDid: string,
        viewerDid: string,
        accessLevel: 'public' | 'followers' | 'friends' | 'private',
        allowedDids: string[] = []
    ): Promise<boolean> {
        // Author can always see their own posts
        if (postAuthorDid === viewerDid) {
            return true;
        }

        // Private posts - only author
        if (accessLevel === 'private') {
            return false;
        }

        // Public posts - everyone
        if (accessLevel === 'public') {
            return true;
        }

        // Check explicit access list
        if (allowedDids.includes(viewerDid)) {
            return true;
        }

        // Check follow relationships for followers/friends access
        if (accessLevel === 'followers' || accessLevel === 'friends') {
            const relationship = await this.checkFollowRelationship(agent, viewerDid, postAuthorDid);

            if (accessLevel === 'followers') {
                return relationship.isFollowing;
            }

            if (accessLevel === 'friends') {
                return relationship.isMutual;
            }
        }

        return false;
    }

    /**
     * Batch check access for multiple posts
     */
    static async batchCheckPostAccess(
        agent: BskyAgent,
        posts: Array<{
            id: string;
            authorDid: string;
            accessLevel: 'public' | 'followers' | 'friends' | 'private';
            allowedDids?: string[];
        }>,
        viewerDid: string
    ): Promise<{ [postId: string]: boolean }> {
        const results: { [postId: string]: boolean } = {};

        // Group posts by author to optimize API calls
        const postsByAuthor = new Map<string, typeof posts>();

        posts.forEach(post => {
            if (!postsByAuthor.has(post.authorDid)) {
                postsByAuthor.set(post.authorDid, []);
            }
            postsByAuthor.get(post.authorDid)!.push(post);
        });

        // Check relationships once per author
        const relationships = new Map<string, FollowRelationship>();

        for (const [authorDid, authorPosts] of postsByAuthor) {
            if (authorDid !== viewerDid) {
                const relationship = await this.checkFollowRelationship(agent, viewerDid, authorDid);
                relationships.set(authorDid, relationship);
            }

            // Check each post from this author
            for (const post of authorPosts) {
                let hasAccess = false;

                // Author's own posts
                if (post.authorDid === viewerDid) {
                    hasAccess = true;
                }
                // Private posts
                else if (post.accessLevel === 'private') {
                    hasAccess = false;
                }
                // Public posts
                else if (post.accessLevel === 'public') {
                    hasAccess = true;
                }
                // Explicit access list
                else if (post.allowedDids?.includes(viewerDid)) {
                    hasAccess = true;
                }
                // Follow-based access
                else {
                    const rel = relationships.get(post.authorDid);
                    if (rel) {
                        if (post.accessLevel === 'followers') {
                            hasAccess = rel.isFollowing;
                        } else if (post.accessLevel === 'friends') {
                            hasAccess = rel.isMutual;
                        }
                    }
                }

                results[post.id] = hasAccess;
            }
        }

        return results;
    }

    /**
     * Clean up cached agents (call periodically to prevent memory leaks)
     */
    static clearAgentCache() {
        this.agents.clear();
    }

    /**
     * Validate that a session is still active
     */
    static async validateSession(session: BlueskySession): Promise<boolean> {
        try {
            const agent = await this.getAgent(session);
            const profile = await agent.getProfile({ actor: session.did });
            return !!profile.data;
        } catch (error) {
            return false;
        }
    }

    /**
     * Resolve a handle to a DID
     */
    static async resolveHandle(agent: BskyAgent, handle: string): Promise<string | null> {
        try {
            const response = await agent.resolveHandle({ handle });
            return response.data.did;
        } catch (error) {
            console.error('Error resolving handle:', error);
            return null;
        }
    }

    /**
     * Get multiple profiles efficiently
     */
    static async getProfiles(agent: BskyAgent, actors: string[]) {
        try {
            const response = await agent.getProfiles({ actors });
            return response.data.profiles;
        } catch (error) {
            console.error('Error fetching profiles:', error);
            return [];
        }
    }

    /**
     * Search for users by handle/name
     */
    static async searchUsers(agent: BskyAgent, query: string, limit: number = 25) {
        try {
            const response = await agent.searchActors({
                term: query,
                limit
            });
            return response.data.actors;
        } catch (error) {
            console.error('Error searching users:', error);
            return [];
        }
    }

    /**
     * Get post thread (for context/replies)
     */
    static async getPostThread(agent: BskyAgent, uri: string) {
        try {
            const response = await agent.getPostThread({ uri });
            return response.data.thread;
        } catch (error) {
            console.error('Error fetching post thread:', error);
            return null;
        }
    }

    /**
     * Delete a post from Bluesky
     */
    static async deletePost(agent: BskyAgent, uri: string) {
        try {
            await agent.deletePost(uri);
            return true;
        } catch (error) {
            console.error('Error deleting post:', error);
            return false;
        }
    }

    /**
     * Get timeline/feed
     */
    static async getTimeline(agent: BskyAgent, limit: number = 50, cursor?: string) {
        try {
            const response = await agent.getTimeline({
                limit,
                cursor
            });
            return {
                feed: response.data.feed,
                cursor: response.data.cursor
            };
        } catch (error) {
            console.error('Error fetching timeline:', error);
            return { feed: [], cursor: undefined };
        }
    }

    /**
     * Like a post
     */
    static async likePost(agent: BskyAgent, uri: string, cid: string) {
        try {
            const response = await agent.like(uri, cid);
            return !!response.uri;
        } catch (error) {
            console.error('Error liking post:', error);
            return false;
        }
    }

    /**
     * Unlike a post
     */
    static async unlikePost(agent: BskyAgent, likeUri: string) {
        try {
            await agent.deleteLike(likeUri);
            return true;
        } catch (error) {
            console.error('Error unliking post:', error);
            return false;
        }
    }

    /**
     * Repost a post
     */
    static async repost(agent: BskyAgent, uri: string, cid: string) {
        try {
            const response = await agent.repost(uri, cid);
            return response.uri;
        } catch (error) {
            console.error('Error reposting:', error);
            return null;
        }
    }

    /**
     * Follow a user
     */
    static async followUser(agent: BskyAgent, did: string) {
        try {
            const response = await agent.follow(did);
            return response.uri;
        } catch (error) {
            console.error('Error following user:', error);
            return null;
        }
    }

    /**
     * Unfollow a user
     */
    static async unfollowUser(agent: BskyAgent, followRecordUri: string) {
        try {
            await agent.deleteFollow(followRecordUri);
            return true;
        } catch (error) {
            console.error('Error unfollowing user:', error);
            return false;
        }
    }
}