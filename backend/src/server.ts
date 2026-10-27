import { PrismaClient } from '@prisma/client';
import { createApp } from './app.js';
import { config } from './config/index.js';
const db = new PrismaClient();
await db.$connect();
const server = createApp(db).listen(config.PORT, '0.0.0.0', () => console.log(`MoodMeal API listening on port ${config.PORT}`));
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => { server.close(() => { void db.$disconnect().finally(() => process.exit(0)); }); setTimeout(() => process.exit(1), 10000).unref(); });
