import { Migration } from '@mikro-orm/migrations';

export class Migration20250529174043 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table \`message\` (\`id\` integer not null primary key autoincrement, \`sender_did\` text not null, \`recipient_did\` text not null, \`content\` text not null, \`iv\` text not null, \`created_at\` datetime not null);`);

    this.addSql(`create table \`post\` (\`id\` integer not null primary key autoincrement, \`did\` text not null, \`title\` text not null, \`content\` text not null);`);
  }

}
