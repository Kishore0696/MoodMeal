import type { Mood } from '@prisma/client';
import type { Preferences } from '../validators/index.js';
export interface ScorableRecipe {
  id: string; name: string; prepTime: number; cookTime: number; calories: number; protein: number; comfort: number; energy: number; vegetarian: boolean; dietaryTags: string[]; allergens: string[];
  ingredients: { ingredient: { name: string }; quantity: string }[];
  moodTags: { mood: string; score: number }[];
}
export type Weights = [number, number, number, number];
export const DEFAULT_WEIGHTS: Weights = [0.35, 0.30, 0.20, 0.15];
export function parseWeights(value?: string): Weights {
  if (!value) return DEFAULT_WEIGHTS;
  const a = value.split(',').map(Number);
  if (a.length !== 4 || a.some(n => !Number.isFinite(n) || n < 0) || Math.abs(a.reduce((s, n) => s + n, 0) - 1) > 0.000001) throw new Error('RECOMMENDATION_WEIGHTS must contain four nonnegative numbers summing to 1');
  return a as Weights;
}
export function compatible(r: ScorableRecipe, p: Preferences) {
  if (p.diet === 'vegetarian' && !r.vegetarian) return false;
  if (p.diet === 'vegan' && !r.dietaryTags.includes('vegan')) return false;
  // Explicit restrictions use positive catalog certification as well as allergen checks.
  const allergens: Record<string, string> = { 'gluten-free': 'gluten', 'dairy-free': 'dairy', 'nut-free': 'nuts', 'egg-free': 'egg', 'soy-free': 'soy' };
  return p.restrictions.every(t => r.dietaryTags.includes(t) && !r.allergens.includes(allergens[t]));
}
const clamp = (n: number) => Math.max(0, Math.min(1, n));
export function rankRecipes<T extends ScorableRecipe>(recipes: T[], mood: Mood, pantry: string[], p: Preferences, weights: Weights = DEFAULT_WEIGHTS) {
  const owned = new Set(pantry.map(s => s.trim().toLowerCase()));
  return recipes.filter(r => compatible(r, p) && (!p.maxTime || r.prepTime + r.cookTime <= p.maxTime)).map(r => {
    const available = r.ingredients.filter(i => owned.has(i.ingredient.name.toLowerCase()));
    const missing = r.ingredients.filter(i => !owned.has(i.ingredient.name.toLowerCase())).map(i => i.ingredient.name);
    const M = clamp((r.moodTags.find(t => t.mood === mood)?.score ?? 0) / 100);
    const I = r.ingredients.length ? available.length / r.ingredients.length : 0;
    const calorieFit = p.caloriePreference ? clamp(1 - Math.abs(r.calories - p.caloriePreference) / p.caloriePreference) : 1;
    const proteinFit = p.proteinPreference === 'high' ? clamp(r.protein / 30) : 1;
    const N = (calorieFit + proteinFit) / 2;
    const comfort = r.comfort / 100, energy = r.energy / 100;
    const quick = clamp(1 - (r.prepTime + r.cookTime) / 90);
    const C = clamp(mood === 'STRESSED' ? comfort * .75 + quick * .25 : mood === 'LOW_ENERGY' ? energy * .65 + quick * .25 + clamp(1 - r.calories / 1000) * .1 : mood === 'CELEBRATORY' ? comfort * .8 + energy * .2 : mood === 'NEUTRAL' ? N : 1 - Math.abs(comfort - energy));
    const components = { mood: M, ingredients: I, nutrition: N, comfortEnergy: C };
    const score = Math.round(100 * (weights[0] * M + weights[1] * I + weights[2] * N + weights[3] * C));
    const explanation = `${Math.round(M * 100)}% suitability for ${mood.toLowerCase().replace('_', ' ')}, ${available.length} of ${r.ingredients.length} ingredients in your pantry, and ${Math.round(N * 100)}% nutrition preference fit. ${mood === 'STRESSED' ? 'Comfort and shorter preparation contribute to this match.' : mood === 'LOW_ENERGY' ? 'Energy suitability and simple preparation contribute to this match.' : 'Comfort and energy ratings contribute to this match.'}`;
    return { ...r, score, components, availableCount: available.length, ingredientPercentage: Math.round(I * 100), missing, explanation };
  }).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}
