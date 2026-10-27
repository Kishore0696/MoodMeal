import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { Prisma, PrismaClient, type User, type Session } from '@prisma/client';
import { z, ZodError } from 'zod';
import { config } from './config/index.js';
import { registerSchema, loginSchema, moodSchema, pantrySchema, preferencesSchema, recipeSchema } from './validators/index.js';
import { rankRecipes } from './services/recommendation.js';
import { calculateAnalytics } from './services/analytics.js';
declare global { namespace Express { interface Request { user?: User; session?: Session } } }
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const token = () => randomBytes(32).toString('hex');
const safeUser = (u: User) => ({ id: u.id, name: u.name, email: u.email, role: u.role, preferences: preferencesSchema.parse(u.preferences), createdAt: u.createdAt });
const recipeInclude = { ingredients: { include: { ingredient: true } }, moodTags: true } satisfies Prisma.RecipeInclude;
const cookieOptions = { httpOnly: true, secure: config.NODE_ENV === 'production', sameSite: config.COOKIE_SAME_SITE, path: '/' } as const;
class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
const equal = (a: string, b: string) => { const left = Buffer.from(a), right = Buffer.from(b); return left.length === right.length && timingSafeEqual(left, right); };
export function createApp(db: PrismaClient) {
  const app = express();
  app.disable('x-powered-by'); app.set('trust proxy', 1);
  app.use(helmet(), cors({ origin: config.FRONTEND_ORIGIN, credentials: true }), express.json({ limit: '100kb' }), cookieParser());
  app.use('/api/auth', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  const limitHandler = (_req: Request, res: Response) => { res.status(429).json({ error: { message: 'Too many requests. Please wait and try again.' } }); };
  app.use('/api', rateLimit({ windowMs: 60_000, limit: 180, standardHeaders: 'draft-8', legacyHeaders: false, handler: limitHandler }));
  app.use('/api', (req, _res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.get('origin') !== config.FRONTEND_ORIGIN) return next(new HttpError(403, 'Request origin is not allowed'));
    next();
  });
  const requireAuth = async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const raw = req.cookies.mm_session;
      if (typeof raw !== 'string' || raw.length !== 64) throw new HttpError(401, 'Please sign in to continue');
      const session = await db.session.findUnique({ where: { tokenHash: hash(raw) }, include: { user: true } });
      if (!session || session.expiresAt < new Date()) throw new HttpError(401, 'Your session has expired. Please sign in again');
      req.user = session.user; req.session = session;
      if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !equal(req.get('x-csrf-token') ?? '', session.csrfToken)) throw new HttpError(403, 'Invalid CSRF token. Refresh and try again');
      next();
    } catch (e) { next(e); }
  };
  const requireAdmin = (req: Request, _res: Response, next: NextFunction) => req.user?.role === 'ADMIN' ? next() : next(new HttpError(403, 'Administrator access required'));
  async function startSession(user: User, req: Request, res: Response) {
    const old = req.cookies.mm_session;
    const raw = token(), csrfToken = token();
    const expiresAt = new Date(Date.now() + config.SESSION_DAYS * 86400000);
    await db.$transaction(async tx => {
      if (typeof old === 'string') await tx.session.deleteMany({ where: { tokenHash: hash(old) } });
      await tx.session.deleteMany({ where: { userId: user.id, expiresAt: { lt: new Date() } } });
      await tx.session.create({ data: { userId: user.id, tokenHash: hash(raw), csrfToken, expiresAt } });
    });
    res.cookie('mm_session', raw, { ...cookieOptions, expires: expiresAt });
    return { user: safeUser(user), csrfToken };
  }
  app.get('/api/health', async (_req, res) => { await db.$queryRaw`SELECT 1`; res.json({ status: 'ok' }); });
  const authLimit = rateLimit({ windowMs: 15 * 60_000, limit: 25, standardHeaders: 'draft-8', legacyHeaders: false, handler: limitHandler });
  app.post('/api/auth/register', authLimit, async (req, res) => {
    const input = registerSchema.parse(req.body);
    const user = await db.user.create({ data: { name: input.name, email: input.email, passwordHash: await bcrypt.hash(input.password, 12) } });
    res.status(201).json(await startSession(user, req, res));
  });
  // A fixed-cost dummy hash avoids skipping password work for an unknown email.
  const dummyHash = bcrypt.hashSync(randomBytes(32).toString('hex'), 12);
  app.post('/api/auth/login', authLimit, async (req, res) => {
    const input = loginSchema.parse(req.body);
    const user = await db.user.findUnique({ where: { email: input.email } });
    const valid = await bcrypt.compare(input.password, user?.passwordHash ?? dummyHash);
    if (!user || !valid) throw new HttpError(401, 'Email or password is incorrect');
    res.json(await startSession(user, req, res));
  });
  app.get('/api/auth/me', requireAuth, (req, res) => { res.set('Cache-Control', 'no-store'); res.json({ user: safeUser(req.user!), csrfToken: req.session!.csrfToken }); });
  app.post('/api/auth/logout', requireAuth, async (req, res) => { await db.session.delete({ where: { id: req.session!.id } }); res.clearCookie('mm_session', cookieOptions); res.status(204).end(); });
  app.get('/api/recipes', async (req, res) => {
    const input = z.object({ search: z.string().max(100).default(''), diet: z.enum(['any', 'vegetarian', 'vegan']).default('any'), page: z.coerce.number().int().min(1).max(10000).default(1), limit: z.coerce.number().int().min(1).max(60).default(12) }).parse(req.query);
    const where: Prisma.RecipeWhereInput = { active: true, name: { contains: input.search, mode: 'insensitive' }, ...(input.diet === 'vegetarian' ? { vegetarian: true } : input.diet === 'vegan' ? { dietaryTags: { has: 'vegan' } } : {}) };
    const [recipes, total] = await Promise.all([db.recipe.findMany({ where, include: recipeInclude, orderBy: { name: 'asc' }, skip: (input.page - 1) * input.limit, take: input.limit }), db.recipe.count({ where })]);
    res.json({ recipes, total, page: input.page });
  });
  app.get('/api/recipes/:id', async (req, res) => {
    const recipe = await db.recipe.findFirst({ where: { active: true, OR: [{ id: req.params.id as string }, { slug: req.params.id as string }] }, include: recipeInclude });
    if (!recipe) throw new HttpError(404, 'Recipe not found'); res.json(recipe);
  });
  app.get('/api/ingredients', async (req, res) => {
    const search = z.string().max(60).parse(req.query.search ?? '');
    res.json(await db.ingredient.findMany({ where: { name: { contains: search, mode: 'insensitive' } }, orderBy: { name: 'asc' }, take: 30 }));
  });
  app.use('/api', requireAuth, (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.get('/api/profile', (req, res) => res.json(safeUser(req.user!)));
  app.patch('/api/profile', async (req, res) => {
    const input = z.object({ name: z.string().trim().min(2).max(80).optional(), preferences: preferencesSchema.optional() }).strict().parse(req.body);
    res.json(safeUser(await db.user.update({ where: { id: req.user!.id }, data: input })));
  });
  app.post('/api/moods', async (req, res) => {
    const { mood } = z.object({ mood: moodSchema }).parse(req.body);
    res.status(201).json(await db.moodLog.create({ data: { mood, userId: req.user!.id } }));
  });
  app.get('/api/moods', async (req, res) => res.json(await db.moodLog.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: 'desc' }, take: 365 })));
  app.get('/api/pantry', async (req, res) => res.json(await db.pantryItem.findMany({ where: { userId: req.user!.id }, include: { ingredient: true }, orderBy: { ingredient: { name: 'asc' } } })));
  app.post('/api/pantry', async (req, res) => {
    const input = pantrySchema.parse(req.body);
    const ingredient = await db.ingredient.upsert({ where: { name: input.name }, create: { name: input.name }, update: {} });
    res.status(201).json(await db.pantryItem.upsert({ where: { userId_ingredientId: { userId: req.user!.id, ingredientId: ingredient.id } }, create: { userId: req.user!.id, ingredientId: ingredient.id, quantity: input.quantity }, update: { quantity: input.quantity }, include: { ingredient: true } }));
  });
  app.patch('/api/pantry/:id', async (req, res) => {
    const data = z.object({ quantity: z.string().trim().max(60) }).parse(req.body);
    const result = await db.pantryItem.updateMany({ where: { id: req.params.id as string, userId: req.user!.id }, data });
    if (!result.count) throw new HttpError(404, 'Pantry item not found'); res.json({ updated: true });
  });
  app.delete('/api/pantry/:id', async (req, res) => {
    const result = await db.pantryItem.deleteMany({ where: { id: req.params.id as string, userId: req.user!.id } });
    if (!result.count) throw new HttpError(404, 'Pantry item not found'); res.status(204).end();
  });
  async function recommendations(user: User, mood: z.infer<typeof moodSchema>) {
    const [recipes, pantry] = await Promise.all([db.recipe.findMany({ where: { active: true }, include: recipeInclude }), db.pantryItem.findMany({ where: { userId: user.id }, include: { ingredient: true } })]);
    return rankRecipes(recipes, mood, pantry.map(i => i.ingredient.name), preferencesSchema.parse(user.preferences), config.weights);
  }
  app.post('/api/recommendations', async (req, res) => {
    const { moodLogId } = z.object({ moodLogId: z.string().min(1) }).parse(req.body);
    const log = await db.moodLog.findFirst({ where: { id: moodLogId, userId: req.user!.id } });
    if (!log) throw new HttpError(404, 'Select and save your mood first');
    res.json({ recipes: await recommendations(req.user!, log.mood), weights: config.weights });
  });
  app.post('/api/history', async (req, res) => {
    const input = z.object({ recipeId: z.string().min(1), moodLogId: z.string().min(1) }).parse(req.body);
    const log = await db.moodLog.findFirst({ where: { id: input.moodLogId, userId: req.user!.id } });
    if (!log) throw new HttpError(404, 'Mood log not found');
    const recipe = (await recommendations(req.user!, log.mood)).find(r => r.id === input.recipeId);
    if (!recipe) throw new HttpError(422, 'This meal does not fit your saved dietary restrictions or time limit');
    const snapshot = { name: recipe.name, image: recipe.image, calories: recipe.calories, protein: recipe.protein, carbs: recipe.carbs, fat: recipe.fat, sugar: recipe.sugar, comfort: recipe.comfort, energy: recipe.energy, score: recipe.score, components: recipe.components, missing: recipe.missing, preferences: req.user!.preferences, weights: config.weights };
    res.status(201).json(await db.mealHistory.create({ data: { userId: req.user!.id, recipeId: recipe.id, moodLogId: log.id, mood: log.mood, snapshot } }));
  });
  app.get('/api/history', async (req, res) => {
    const q = z.object({ mood: moodSchema.optional(), from: z.string().date().optional(), to: z.string().date().optional(), page: z.coerce.number().int().min(1).default(1) }).parse(req.query);
    const where: Prisma.MealHistoryWhereInput = { userId: req.user!.id, mood: q.mood, createdAt: { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lt: new Date(new Date(q.to).getTime() + 86400000) } : {}) } };
    const [history, total] = await Promise.all([db.mealHistory.findMany({ where, include: { recipe: true }, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * 30, take: 30 }), db.mealHistory.count({ where })]);
    res.json({ history, total });
  });
  app.get('/api/analytics', async (req, res) => {
    const [moods, meals] = await Promise.all([db.moodLog.findMany({ where: { userId: req.user!.id } }), db.mealHistory.findMany({ where: { userId: req.user!.id }, include: { recipe: true } })]);
    res.json(calculateAnalytics(moods, meals));
  });
  app.use('/api/admin', requireAdmin);
  app.get('/api/admin/recipes', async (_req, res) => res.json(await db.recipe.findMany({ include: recipeInclude, orderBy: { name: 'asc' } })));
  async function recipeData(input: z.infer<typeof recipeSchema>) {
    const { ingredients, moodTags, ...data } = input;
    const linked = [];
    for (const item of ingredients) {
      const ingredient = await db.ingredient.upsert({ where: { name: item.name }, create: { name: item.name }, update: {} });
      linked.push({ ingredientId: ingredient.id, quantity: item.quantity });
    }
    return { ...data, ingredients: { create: linked }, moodTags: { create: moodTags } };
  }
  app.post('/api/admin/recipes', async (req, res) => res.status(201).json(await db.recipe.create({ data: await recipeData(recipeSchema.parse(req.body)), include: recipeInclude })));
  app.put('/api/admin/recipes/:id', async (req, res) => {
    const data = await recipeData(recipeSchema.parse(req.body));
    res.json(await db.$transaction(async tx => {
      await tx.recipeIngredient.deleteMany({ where: { recipeId: req.params.id as string } });
      await tx.recipeMoodTag.deleteMany({ where: { recipeId: req.params.id as string } });
      return tx.recipe.update({ where: { id: req.params.id as string }, data, include: recipeInclude });
    }));
  });
  // Archive instead of deleting referenced meals, preserving historical integrity.
  app.delete('/api/admin/recipes/:id', async (req, res) => { await db.recipe.update({ where: { id: req.params.id as string }, data: { active: false } }); res.status(204).end(); });
  app.use((_req, _res, next) => next(new HttpError(404, 'Endpoint not found')));
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) return res.status(400).json({ error: { message: 'Please check your input', details: err.flatten() } });
    if (err instanceof HttpError) return res.status(err.status).json({ error: { message: err.message } });
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2002') return res.status(409).json({ error: { message: 'This record already exists' } });
      if (err.code === 'P2025') return res.status(404).json({ error: { message: 'Record not found' } });
    }
    if (err instanceof SyntaxError) return res.status(400).json({ error: { message: 'Invalid JSON request' } });
    console.error('Request failed:', err instanceof Error ? err.name : 'Unknown error');
    return res.status(503).json({ error: { message: 'Service temporarily unavailable. Please try again shortly' } });
  });
  return app;
}
