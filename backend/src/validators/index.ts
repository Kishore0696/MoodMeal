import { z } from 'zod';
export const moodSchema = z.enum(['HAPPY', 'STRESSED', 'LOW_ENERGY', 'CELEBRATORY', 'NEUTRAL']);
export const preferencesSchema = z.object({
  diet: z.enum(['any', 'vegetarian', 'vegan']).default('any'),
  caloriePreference: z.number().int().min(200).max(1500).nullable().optional(),
  proteinPreference: z.enum(['balanced', 'high']).default('balanced'),
  restrictions: z.array(z.enum(['gluten-free', 'dairy-free', 'nut-free', 'egg-free', 'soy-free'])).max(5).default([]),
  maxTime: z.number().int().min(5).max(240).nullable().optional(),
});
export type Preferences = z.infer<typeof preferencesSchema>;
export const registerSchema = z.object({ name: z.string().trim().min(2).max(80), email: z.string().trim().email().max(254).transform(s => s.toLowerCase()), password: z.string().min(10).max(72).refine(s => Buffer.byteLength(s, 'utf8') <= 72, 'Password must fit within 72 UTF-8 bytes') });
export const loginSchema = registerSchema.pick({ email: true, password: true });
export const pantrySchema = z.object({ name: z.string().trim().min(1).max(60).regex(/^[\p{L}\p{N} '\-]+$/u).transform(s => s.toLowerCase()), quantity: z.string().trim().max(60).default('') });
export const recipeSchema = z.object({
  slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/), name: z.string().trim().min(2).max(120), description: z.string().trim().min(10).max(2000),
  image: z.string().url().refine(s => s.startsWith('https://'), 'Use an HTTPS image'), imageCredit: z.string().min(1).max(300),
  prepTime: z.number().int().min(0).max(480), cookTime: z.number().int().min(0).max(480), servings: z.number().int().min(1).max(20),
  instructions: z.array(z.string().min(5).max(1000)).min(2).max(30), calories: z.number().min(1).max(3000), protein: z.number().min(0).max(300), carbs: z.number().min(0).max(500), fat: z.number().min(0).max(300), sugar: z.number().min(0).max(300),
  comfort: z.number().min(0).max(100), energy: z.number().min(0).max(100), vegetarian: z.boolean(),
  dietaryTags: z.array(z.enum(['vegan', 'gluten-free', 'dairy-free', 'nut-free', 'egg-free', 'soy-free'])).max(6),
  allergens: z.array(z.enum(['gluten', 'dairy', 'nuts', 'egg', 'soy'])).max(5),
  ingredients: z.array(pantrySchema.extend({ quantity: z.string().min(1).max(60) })).min(1).max(40).refine(a => new Set(a.map(i => i.name)).size === a.length, 'Duplicate ingredients'),
  moodTags: z.array(z.object({ mood: moodSchema, score: z.number().min(0).max(100) })).length(5).refine(a => new Set(a.map(t => t.mood)).size === 5, 'All five moods required'),
}).superRefine((r, ctx) => {
  const mapping: Record<string, string> = { 'gluten-free': 'gluten', 'dairy-free': 'dairy', 'nut-free': 'nuts', 'egg-free': 'egg', 'soy-free': 'soy' };
  for (const tag of r.dietaryTags) if (r.allergens.includes(mapping[tag] as typeof r.allergens[number])) ctx.addIssue({ code: 'custom', message: 'Dietary tags conflict with allergens', path: ['dietaryTags'] });
  if (r.dietaryTags.includes('vegan') && (!r.vegetarian || r.allergens.some(a => ['egg', 'dairy'].includes(a)))) ctx.addIssue({ code: 'custom', message: 'Vegan metadata conflicts', path: ['dietaryTags'] });
});
