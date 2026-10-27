import 'dotenv/config';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../src/app.js';
import { catalog } from '../prisma/catalog.js';
// An isolated database is mandatory. Tests only remove accounts created by this run.
const url = process.env.TEST_DATABASE_URL;
const db = new PrismaClient({ ...(url ? { datasourceUrl: url } : {}) });
const app = createApp(db), origin = 'http://localhost:5173';
const run = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const email = `test-${run}@moodmeal.example`, second = `other-${run}@moodmeal.example`;
let cookie: string, csrf: string, cookie2: string, csrf2: string, moodId: string, pantryId: string, recipeId: string;
const mutation = (method: 'post'|'patch'|'delete'|'put', path: string, other = false) => request(app)[method](path).set('Origin', origin).set('Cookie', other ? cookie2 : cookie).set('X-CSRF-Token', other ? csrf2 : csrf);
const get = (path: string, other = false) => request(app).get(path).set('Cookie', other ? cookie2 : cookie);
describe.skipIf(!url)('PostgreSQL-backed API workflow and security', () => {
  beforeAll(async () => { if (!new URL(url!).pathname.endsWith('_test')) throw new Error('TEST_DATABASE_URL must end in _test'); await db.$connect(); });
  afterAll(async () => { await db.recipe.deleteMany({ where: { slug: `test-recipe-${run}` } }); await db.user.deleteMany({ where: { email: { in: [email, second] } } }); await db.$disconnect(); });
  it('registers securely and persists a hashed password with a hashed session token', async () => {
    const res = await request(app).post('/api/auth/register').set('Origin', origin).send({ name: 'Test Cook', email, password: 'a long unique test passphrase' });
    expect(res.status).toBe(201); cookie = res.headers['set-cookie'][0].split(';')[0]; csrf = res.body.csrfToken;
    expect(res.headers['set-cookie'][0]).toContain('HttpOnly'); expect(res.body.user.passwordHash).toBeUndefined();
    const user = await db.user.findUniqueOrThrow({ where: { email } }); expect(user.passwordHash).not.toBe('a long unique test passphrase');
    const session = await db.session.findFirstOrThrow({ where: { userId: user.id } }); expect(cookie).not.toContain(session.tokenHash);
  });
  it('rejects duplicate registration, invalid input, bad credentials, and cross-site mutations', async () => {
    expect((await request(app).post('/api/auth/register').set('Origin', origin).send({ name: 'Again', email, password: 'a long unique test passphrase' })).status).toBe(409);
    expect((await request(app).post('/api/auth/register').set('Origin', origin).send({ name: '', email: 'bad', password: 'short' })).status).toBe(400);
    expect((await request(app).post('/api/auth/login').set('Origin', origin).send({ email, password: 'wrong password here' })).status).toBe(401);
    expect((await request(app).post('/api/moods').set('Origin', 'https://evil.example').set('Cookie', cookie).send({ mood: 'HAPPY' })).status).toBe(403);
    expect((await request(app).post('/api/moods').set('Origin', origin).set('Cookie', cookie).send({ mood: 'HAPPY' })).status).toBe(403);
  });
  it('logs in and rotates the session', async () => {
    const old = cookie; const res = await request(app).post('/api/auth/login').set('Origin', origin).set('Cookie', old).send({ email, password: 'a long unique test passphrase' });
    expect(res.status).toBe(200); cookie = res.headers['set-cookie'][0].split(';')[0]; csrf = res.body.csrfToken;
    expect((await request(app).get('/api/auth/me').set('Cookie', old)).status).toBe(401); expect((await get('/api/auth/me')).body.user.email).toBe(email);
  });
  it('logs a mood and persists it', async () => { const r = await mutation('post','/api/moods').send({ mood: 'STRESSED' }); expect(r.status).toBe(201); moodId = r.body.id; expect((await get('/api/moods')).body[0].id).toBe(moodId); });
  it('adds, edits and retrieves pantry ingredients', async () => {
    const r = await mutation('post','/api/pantry').send({ name: 'Rice', quantity: '1 kg' }); expect(r.status).toBe(201); pantryId = r.body.id;
    expect((await mutation('patch',`/api/pantry/${pantryId}`).send({ quantity: '500 g' })).status).toBe(200);
    const list = await get('/api/pantry'); expect(list.body[0].quantity).toBe('500 g'); expect(list.body[0].ingredient.name).toBe('rice');
  });
  it('retrieves seeded recipes and validates the API schema', async () => {
    const r = await request(app).get('/api/recipes?limit=60'); expect(r.status).toBe(200); expect(r.body.total).toBeGreaterThanOrEqual(40); recipeId = r.body.recipes[0].id;
    const detail = await request(app).get(`/api/recipes/${recipeId}`); expect(detail.body.ingredients.length).toBeGreaterThan(0); expect(detail.body.moodTags).toHaveLength(5);
    expect((await request(app).get('/api/recipes/no-such-recipe')).status).toBe(404);
  });
  it('ranks with saved preferences and enforces dietary filtering', async () => {
    expect((await mutation('patch','/api/profile').send({ preferences: { diet: 'vegan', proteinPreference: 'high', restrictions: ['gluten-free'] } })).status).toBe(200);
    const r = await mutation('post','/api/recommendations').send({ moodLogId: moodId }); expect(r.status).toBe(200); expect(r.body.recipes.length).toBeGreaterThan(0);
    expect(r.body.recipes.every((v: { dietaryTags: string[] }) => v.dietaryTags.includes('vegan') && v.dietaryTags.includes('gluten-free'))).toBe(true); recipeId = r.body.recipes[0].id;
  });
  it('persists a meal snapshot and computes actual analytics', async () => {
    expect((await mutation('post','/api/history').send({ recipeId, moodLogId: moodId })).status).toBe(201);
    const h = await get('/api/history?mood=STRESSED'); expect(h.body.total).toBe(1); expect(h.body.history[0].snapshot.name).toBeTruthy();
    const a = await get('/api/analytics'); expect(a.body.totalMeals).toBe(1); expect(a.body.totalMoods).toBe(1); expect(a.body.mealsByMood).toEqual([{ name: 'STRESSED', count: 1 }]);
    expect((await get('/api/history?mood=HAPPY')).body.total).toBe(0);
  });
  it('isolates user data and prevents ordinary catalog mutations', async () => {
    const r = await request(app).post('/api/auth/register').set('Origin', origin).send({ name: 'Other Cook', email: second, password: 'another unique test passphrase' });
    cookie2 = r.headers['set-cookie'][0].split(';')[0]; csrf2 = r.body.csrfToken;
    expect((await get('/api/pantry',true)).body).toEqual([]); expect((await get('/api/history',true)).body.total).toBe(0); expect((await get('/api/moods',true)).body).toEqual([]); expect((await get('/api/analytics',true)).body.totalMeals).toBe(0);
    expect((await mutation('delete',`/api/pantry/${pantryId}`,true)).status).toBe(404);
    expect((await mutation('post','/api/history',true).send({ recipeId, moodLogId: moodId })).status).toBe(404);
    expect((await mutation('post','/api/recommendations',true).send({ moodLogId: moodId })).status).toBe(404);
    expect((await mutation('post','/api/admin/recipes').send({})).status).toBe(403);
    expect((await get('/api/admin/recipes')).status).toBe(403);
  });
  it('removes pantry items and ends sessions on logout', async () => {
    expect((await mutation('delete',`/api/pantry/${pantryId}`)).status).toBe(204); expect((await get('/api/pantry')).body).toEqual([]);
    expect((await mutation('post','/api/auth/logout').send({})).status).toBe(204); expect((await get('/api/auth/me')).status).toBe(401);
  });
  it('allows administrator catalog CRUD and excludes archived recipes from discovery', async () => {
    await db.user.update({ where: { email: second }, data: { role: 'ADMIN' } });
    const payload = { ...catalog[0], slug: `test-recipe-${run}`, name: 'Test Catalog Meal' };
    const created = await mutation('post','/api/admin/recipes',true).send(payload); expect(created.status).toBe(201);
    const id = created.body.id;
    expect((await mutation('put',`/api/admin/recipes/${id}`,true).send({ ...payload, name: 'Updated Catalog Meal' })).status).toBe(200);
    expect((await request(app).get(`/api/recipes/${id}`)).body.name).toBe('Updated Catalog Meal');
    expect((await mutation('delete',`/api/admin/recipes/${id}`,true)).status).toBe(204);
    expect((await request(app).get(`/api/recipes/${id}`)).status).toBe(404);
  });
});
