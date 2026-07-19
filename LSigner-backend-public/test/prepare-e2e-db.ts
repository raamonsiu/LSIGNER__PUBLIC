/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import * as dotenv from 'dotenv';
import { Client } from 'pg';
import { DataSource } from 'typeorm';

function loadEnvironment(): void {
  process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
  process.env.APP_ENV = process.env.APP_ENV ?? 'test';

  const env = process.env.APP_ENV;
  dotenv.config({ path: '.env.local' });
  dotenv.config({ path: `.env.${env}` });
  dotenv.config();
}

function parseSslOption(): false | { rejectUnauthorized: boolean } {
  const sslEnabled = (process.env.DB_SSL ?? 'false') === 'true';
  if (!sslEnabled) {
    return false;
  }

  return {
    rejectUnauthorized:
      (process.env.DB_SSL_REJECT_UNAUTHORIZED ?? 'true') === 'true',
  };
}

async function recreateDatabase(): Promise<void> {
  const host = process.env.DB_HOST ?? 'localhost';
  const port = parseInt(process.env.DB_PORT ?? '5432', 10);
  const user = process.env.DB_USER ?? 'postgres';
  const password = process.env.DB_PASSWORD ?? 'postgres';
  const database = process.env.DB_NAME ?? 'lsigner_test';

  const adminClient = new Client({
    host,
    port,
    user,
    password,
    database: 'postgres',
    ssl: parseSslOption(),
  });

  await adminClient.connect();

  try {
    await adminClient.query(
      `
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = $1
          AND pid <> pg_backend_pid()
      `,
      [database],
    );

    const safeDatabaseName = `"${database.replace(/"/g, '""')}"`;
    await adminClient.query(`DROP DATABASE IF EXISTS ${safeDatabaseName}`);
    await adminClient.query(`CREATE DATABASE ${safeDatabaseName}`);
  } finally {
    await adminClient.end();
  }
}

async function run(): Promise<void> {
  loadEnvironment();
  await recreateDatabase();

  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    database: process.env.DB_NAME ?? 'lsigner_test',
    ssl: parseSslOption(),
    migrations: ['src/migrations/*.ts'],
    synchronize: false,
    logging: false,
  });

  await dataSource.initialize();
  try {
    await dataSource.runMigrations();
  } finally {
    await dataSource.destroy();
  }
}

void run();
