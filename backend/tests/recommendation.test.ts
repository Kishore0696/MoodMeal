import { describe, it, expect } from 'vitest';
import { catalog } from '../prisma/catalog.js';
import { rankRecipes, parseWeights, compatible } from '../src/services/recommendation.js';
import { preferencesSchema, recipeSchema } from '../src/validators/index.js';
import { calculateAnalytics } from '../src/services/analytics.js';
const recipes = catalog.map((r, i) => ({ ...r, id: String(i), ingredients: r.ingredients.map(i => ({ ingredient: { name: i.name }, quantity: i.quantity })) }));
const preferences = preferencesSchema.parse({});
describe('editorial recipe catalog', () => {
  it('contains at least 40 valid and distinct recipes with consistent energy totals', () => {
    expect(catalog.length).toBeGreaterThanOrEqual(40); expect(new Set(catalog.map(r => r.slug)).size).toBe(catalog.length);
    for (const r of catalog) { expect(recipeSchema.safeParse(r).success, r.name).toBe(true); expect(r.calories).toBe(r.protein * 4 + r.carbs * 4 + r.fat * 9); expect(r.sugar).toBeLessThanOrEqual(r.carbs); }
  });
});
describe('transparent deterministic recommendations', () => {
  it('normalizes scores and returns stable descending order', () => {
    const a = rankRecipes(recipes, 'HAPPY', ['rice', 'tomato'], preferences);
    expect(a).toEqual(rankRecipes(recipes, 'HAPPY', ['rice', 'tomato'], preferences));
    for (const [i, r] of a.entries()) { expect(r.score).toBeGreaterThanOrEqual(0); expect(r.score).toBeLessThanOrEqual(100); for (const s of Object.values(r.components)) expect(s).toBeGreaterThanOrEqual(0); if (i) expect(a[i - 1].score).toBeGreaterThanOrEqual(r.score); }
  });
  it('pantry-only scoring prefers fully available recipes and identifies missing ingredients', () => {
    const r = recipes[0], pantry = r.ingredients.map(i => i.ingredient.name);
    const ranked = rankRecipes(recipes, 'HAPPY', pantry, preferences, [0,1,0,0]);
    const match = ranked.find(v => v.id === r.id)!; expect(match.score).toBe(100); expect(match.missing).toEqual([]); expect(ranked[0].score).toBe(100);
    const empty = rankRecipes([r], 'HAPPY', [], preferences)[0]; expect(empty.availableCount).toBe(0); expect(empty.missing.length).toBe(r.ingredients.length);
  });
  it('hard restrictions exclude violating recipes even with better scores', () => {
    const p = preferencesSchema.parse({ diet: 'vegan', restrictions: ['gluten-free', 'nut-free'] });
    const result = rankRecipes(recipes, 'STRESSED', [], p); expect(result.length).toBeGreaterThan(0);
    expect(result.every(r => r.dietaryTags.includes('vegan') && !r.allergens.some(a => ['dairy','egg','gluten','nuts'].includes(a)))).toBe(true);
    expect(compatible(recipes.find(r => r.name === 'Grilled Chicken')!, preferencesSchema.parse({ diet: 'vegetarian' }))).toBe(false);
  });
  it('honors maximum total time and makes calorie/protein preferences soft scores', () => {
    const p = preferencesSchema.parse({ maxTime: 15, caloriePreference: 500, proteinPreference: 'high' });
    const result = rankRecipes(recipes, 'LOW_ENERGY', [], p); expect(result.length).toBeGreaterThan(0); expect(result.every(r => r.prepTime + r.cookTime <= 15)).toBe(true);
  });
  it('validates configurable weights', () => { expect(parseWeights()).toEqual([.35,.3,.2,.15]); expect(() => parseWeights('1,1,1,1')).toThrow(); expect(() => parseWeights('NaN,0,0,1')).toThrow(); });
});
describe('analytics from saved records', () => {
  it('has honest empty states', () => { const a = calculateAnalytics([], []); expect(a.totalMeals).toBe(0); expect(a.trends).toEqual([]); expect(a.moodFrequency).toEqual([]); });
  it('counts moods and meals independently, averaging saved comfort/energy by UTC day', () => {
    const meals = [{ mood: 'HAPPY', createdAt: new Date('2026-10-01T10:00:00Z'), recipe: { name: 'Dal' }, recipeId: 'r', snapshot: { comfort: 90, energy: 70 } }, { mood: 'HAPPY', createdAt: new Date('2026-10-01T15:00:00Z'), recipe: { name: 'Dal' }, recipeId: 'r', snapshot: { comfort: 70, energy: 90 } }];
    const a = calculateAnalytics([{ mood: 'HAPPY' }, { mood: 'STRESSED' }, { mood: 'HAPPY' }], meals);
    expect(a.totalMoods).toBe(3); expect(a.totalMeals).toBe(2); expect(a.topRecipes).toEqual([{ name: 'Dal', count: 2 }]); expect(a.trends).toEqual([{ date: '2026-10-01', meals: 2, comfort: 80, energy: 80 }]);
  });
});
