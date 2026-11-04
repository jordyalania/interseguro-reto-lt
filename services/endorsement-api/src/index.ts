import { loadConfig } from './config/env';
import { createDataSource } from './database/data-source';
import { TypeOrmTemplateRepository } from './repositories/template.repository';
import { createServer } from './server';

async function main(): Promise<void> {
  const config = loadConfig();

  const dataSource = createDataSource(config.databaseUrl);
  await dataSource.initialize();

  const server = await createServer({
    config,
    templateRepository: new TypeOrmTemplateRepository(dataSource),
  });
  await server.start();
  console.log(`endorsement-api escuchando en ${server.info.uri}`);

  const shutdown = async (): Promise<void> => {
    await server.stop({ timeout: 10_000 });
    await dataSource.destroy();
    process.exit(0);
  };
  process.once('SIGTERM', () => void shutdown());
  process.once('SIGINT', () => void shutdown());
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
