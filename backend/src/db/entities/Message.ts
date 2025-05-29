import { Entity, PrimaryKey, Property } from '@mikro-orm/core';

@Entity()
export class Message {
  @PrimaryKey()
  id!: number;

  @Property()
  senderDid!: string;

  @Property()
  recipientDid!: string;

  @Property()
  content!: string; // encrypted

  @Property()
  iv!: string; // hex string

  @Property()
  createdAt: Date = new Date();

  constructor(senderDid: string, recipientDid: string, content: string, iv: string) {
    this.senderDid = senderDid;
    this.recipientDid = recipientDid;
    this.content = content;
    this.iv = iv;
  }
}
