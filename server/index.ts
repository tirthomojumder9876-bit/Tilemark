import { join } from 'node:path';
import { createApp } from './app.ts';
import { MemoryRepo } from './memory-repo.ts';
import { PgRepo } from './pg-repo.ts';
import type { Repo } from './repo.ts';

const PORT = Number(process.env.PORT ?? 3001);
const DATABASE_URL = process.env.DATABASE_URL;

async function createRepo(): Promise<Repo> {
  if (DATABASE_URL) {
    const repo = new PgRepo(DATABASE_URL);
    await repo.init();
    console.log('storage: postgres');
    return repo;
  }

  console.log('storage: in-memory (set DATABASE_URL to use Postgres)');
  return new MemoryRepo();
}

const repo = await createRepo();
const app = createApp(repo, { dist: join(import.meta.dirname, '..', 'dist') });

app.listen(PORT, () => {
  console.log(`api listening on http://localhost:${PORT}`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void repo.close().finally(() => process.exit(0));
  });
}
