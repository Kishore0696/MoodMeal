import 'dotenv/config';
import { parseWeights } from '../services/recommendation.js';
import { z } from 'zod';
const env = z.object({ NODE_ENV: z.enum(['development', 'test', 'production']).default('development'), PORT: z.coerce.number().int().min(1).max(65535).default(4000), FRONTEND_ORIGIN: z.string().url().default('http://localhost:5173'), COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'), SESSION_DAYS: z.coerce.number().int().min(1).max(30).default(7) }).parse(process.env);
if (env.NODE_ENV === 'production' && !env.FRONTEND_ORIGIN.startsWith('https://')) throw new Error('Production frontend must use HTTPS');
if (env.COOKIE_SAME_SITE === 'none' && env.NODE_ENV !== 'production') throw new Error('SameSite=None requires production HTTPS');
export const config = { ...env, weights: parseWeights(process.env.RECOMMENDATION_WEIGHTS) };
