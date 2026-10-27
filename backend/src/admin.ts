import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
const email = z.string().email().parse(process.argv[2]).toLowerCase();
const db = new PrismaClient();
try { await db.user.update({ where: { email }, data: { role: 'ADMIN' } }); console.log('Registered account promoted to catalog administrator.'); }
finally { await db.$disconnect(); }
