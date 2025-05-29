import { SqliteDriver } from '@mikro-orm/sqlite';
import { Migrator } from '@mikro-orm/migrations'
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const entitiesTSPath = path.join(__dirname,"db" ,"entities");
const entitiesJSPath = path.join(__dirname, "..", "dist", "db", "entities");
const migrationsJSPath = path.join(__dirname,  "..", "dist", "db", "migrations");
const migrationsTSPath = path.join(__dirname, "db", "migrations");

export default {
  driver: SqliteDriver,
  dbName: path.join(__dirname, '..', 'data', 'db.sqlite'), // SQLite file path
  entities: [entitiesJSPath],
  entitiesTs: [entitiesTSPath],
  allowGlobalContext: true,
  migrations: {
    path: migrationsJSPath,
    pathTs: migrationsTSPath,
    glob: '!(*.d).{js,ts}',
  },
  seeder: {
    path: './db/seeder',
    defaultSeeder: 'PlayerSeeder',
  },
  debug: true,
  extensions: [ Migrator],
};

