// db/migrations/Migration[TIMESTAMP]_AddAccessControl.ts
import { Migration } from '@mikro-orm/migrations';

export class Migration20250601000000_AddAccessControl extends Migration {

    override async up(): Promise<void> {
        // Add access control and privacy fields to posts table
        this.addSql(`ALTER TABLE \`post\` ADD COLUMN \`access_rules\` TEXT NULL;`);
        this.addSql(`ALTER TABLE \`post\` ADD COLUMN \`privacy_score\` INTEGER NULL DEFAULT 0;`);
        this.addSql(`ALTER TABLE \`post\` ADD COLUMN \`privacy_technique\` TEXT NULL DEFAULT 'None';`);
        this.addSql(`ALTER TABLE \`post\` ADD COLUMN \`is_encrypted\` BOOLEAN NULL DEFAULT 0;`);
        this.addSql(`ALTER TABLE \`post\` ADD COLUMN \`original_content\` TEXT NULL;`);
        this.addSql(`ALTER TABLE \`post\` ADD COLUMN \`at_protocol_uri\` TEXT NULL;`);
        this.addSql(`ALTER TABLE \`post\` ADD COLUMN \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;`);
        this.addSql(`ALTER TABLE \`post\` ADD COLUMN \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;`);

        // Update existing posts to have default access control
        this.addSql(`UPDATE \`post\` SET \`access_rules\` = '{"accessLevel":"public","allowedDids":[],"requireMutualFollow":false}' WHERE \`access_rules\` IS NULL;`);
        this.addSql(`UPDATE \`post\` SET \`original_content\` = \`content\` WHERE \`original_content\` IS NULL;`);
    }

    override async down(): Promise<void> {
        // Remove the added columns
        this.addSql(`ALTER TABLE \`post\` DROP COLUMN \`access_rules\`;`);
        this.addSql(`ALTER TABLE \`post\` DROP COLUMN \`privacy_score\`;`);
        this.addSql(`ALTER TABLE \`post\` DROP COLUMN \`privacy_technique\`;`);
        this.addSql(`ALTER TABLE \`post\` DROP COLUMN \`is_encrypted\`;`);
        this.addSql(`ALTER TABLE \`post\` DROP COLUMN \`original_content\`;`);
        this.addSql(`ALTER TABLE \`post\` DROP COLUMN \`at_protocol_uri\`;`);
        this.addSql(`ALTER TABLE \`post\` DROP COLUMN \`created_at\`;`);
        this.addSql(`ALTER TABLE \`post\` DROP COLUMN \`updated_at\`;`);
    }
}