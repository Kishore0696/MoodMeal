import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Invoke Prisma as a normal Node child so settings loaded with --env-file
// reach both migrations and the API. Node's --run ignores those settings.
const require = createRequire(new URL('../backend/package.json', import.meta.url));
const prismaCli = join(dirname(require.resolve('prisma/package.json')), 'build/index.js');
const child = spawn(process.execPath, [prismaCli, 'migrate', 'deploy'], {
  cwd: fileURLToPath(new URL('../backend/', import.meta.url)),
  env: process.env,
  stdio: 'inherit',
});
const exitCode = await new Promise((resolve, reject) => {
  child.once('error', reject);
  child.once('exit', code => resolve(code ?? 1));
});
if (exitCode !== 0) process.exit(exitCode);
if (!process.argv.includes('--migrate-only')) await import('../backend/dist/src/server.js');
