// entities/Post.js
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
    
    constructor(did: string, title: string, content: string,) {
        this.did = did;
        this.title = title;
        this.content = content; 
    }

}
