// entities/Post.ts - Enhanced with access control fields
import { Entity, PrimaryKey, Property } from '@mikro-orm/core';

@Entity()
export class Post {
    @PrimaryKey()
    id!: number;

    @Property()
    did!: string;

    @Property()
    title!: string;

    @Property()
    content!: string;

    // Access control properties
    @Property({ type: 'json', nullable: true })
    accessRules?: {
        accessLevel: 'public' | 'followers' | 'friends' | 'private';
        allowedDids?: string[];
        requireMutualFollow?: boolean;
        followerTiers?: string[];
    };

    // Privacy enhancement properties
    @Property({ nullable: true, default: 0 })
    privacyScore?: number;

    @Property({ nullable: true, default: 'None' })
    privacyTechnique?: string;

    @Property({ nullable: true, default: false })
    isEncrypted?: boolean;

    @Property({ nullable: true })
    originalContent?: string; // Store original before privacy transformations

    @Property({ nullable: true })
    atProtocolUri?: string; // URI if published to main Bluesky network

    @Property()
    createdAt: Date = new Date();

    @Property({ onUpdate: () => new Date() })
    updatedAt: Date = new Date();

    constructor(
        did: string,
        title: string,
        content: string,
        accessLevel: 'public' | 'followers' | 'friends' | 'private' = 'public',
        privacyTechnique: string = 'None',
        privacyScore: number = 0
    ) {
        this.did = did;
        this.title = title;
        this.content = content;
        this.accessRules = {
            accessLevel,
            allowedDids: [],
            requireMutualFollow: accessLevel === 'friends'
        };
        this.privacyScore = privacyScore;
        this.privacyTechnique = privacyTechnique;
        this.isEncrypted = privacyTechnique !== 'None';
        this.originalContent = content;
    }
}