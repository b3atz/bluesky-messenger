import { Migration } from '@mikro-orm/migrations';

export class Migration20250529165317 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table \`post\` drop column \`iv\`;`);
    this.addSql(`alter table \`post\` drop column \`tag\`;`);
  }

}
