import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { createRequire } from 'node:module';
const root = path.resolve(import.meta.dirname, '..');
const require = createRequire(path.join(root, 'backend/package.json'));
const password = readFileSync(path.join(root, '.local/postgres-password'), 'utf8');
const url = `postgresql://moodmeal:${password}@127.0.0.1:54329/moodmeal_utf8_test?schema=public`;
const env = { ...process.env, DATABASE_URL: url, DIRECT_URL: url, TEST_DATABASE_URL: url, NODE_ENV: 'test', FRONTEND_ORIGIN: 'http://localhost:5173' };
for (const args of [[path.join(path.dirname(require.resolve('prisma/package.json')), 'build/index.js'),'migrate','deploy','--schema','backend/prisma/schema.prisma'], [path.join(path.dirname(require.resolve('tsx/package.json')), 'dist/cli.mjs'),'backend/prisma/seed.ts'], [path.join(path.dirname(require.resolve('vitest/package.json')), 'vitest.mjs'),'run','--config',path.join(root,'backend/vitest.config.ts'),'--root','backend']]) {
  const result = spawnSync(process.execPath, args, { cwd: root, env, stdio: 'inherit' }); if (result.status !== 0) process.exit(result.status ?? 1);
}
