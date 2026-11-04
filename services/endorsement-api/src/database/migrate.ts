import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { DataSource } from 'typeorm';
import { createDataSource } from './data-source';

const SEEDS_DIR = path.resolve(__dirname, '../../database/seeds');

export async function migrateAndSeed(dataSource: DataSource): Promise<void> {
  await dataSource.runMigrations({ transaction: 'each' });

  const files = (await readdir(SEEDS_DIR)).filter((file) => file.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = await readFile(path.join(SEEDS_DIR, file), 'utf8');
    await dataSource.transaction((manager) => manager.query(sql));
  }
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('Falta la variable de entorno DATABASE_URL');
  }

  const dataSource = createDataSource(databaseUrl);
  await dataSource.initialize();
  try {
    await migrateAndSeed(dataSource);
    console.log('Migraciones y seeds aplicados.');
  } finally {
    await dataSource.destroy();
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
