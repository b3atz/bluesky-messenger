// Fixed src/db/entities/Message.ts

import { Entity, PrimaryKey, Property } from '@mikro-orm/core';

@Entity()
export class Message {
  @PrimaryKey({ type: 'number' })
  id!: number;

  @Property({ type: 'string' })
  senderDid!: string;

  @Property({ type: 'string' })
  recipientDid!: string;

  @Property({ type: 'string' })
  content!: string; // encrypted

  @Property({ type: 'string' })
  iv!: string; // hex string

  @Property({ type: 'datetime' })
  createdAt: Date = new Date();

  constructor(senderDid: string, recipientDid: string, content: string, iv: string) {
    this.senderDid = senderDid;
    this.recipientDid = recipientDid;
    this.content = content;
    this.iv = iv;
  }
}