import { Seeder } from '@mikro-orm/seeder';
import { EntityManager } from '@mikro-orm/core';
import { Post } from '../entities/Post.js';

export class PostSeeder extends Seeder {
  async run(em: EntityManager): Promise<void> {
    const posts = [
      new Post(
        'did:example:alice',
        'Encrypted Message 1',
        'U2FsdGVkX1+...',
      ),
      new Post(
        'did:example:bob',
        'Encrypted Message 2',
        'U2FsdGVkX1+...',
      ),
      new Post(
        'did:example:carol',
        'Encrypted Message 3',
        'U2FsdGVkX1+...',
      ),
    ];

    for (const post of posts) {
      em.persist(post);
    }
  }
}