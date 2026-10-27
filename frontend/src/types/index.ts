export type Mood = 'HAPPY' | 'STRESSED' | 'LOW_ENERGY' | 'CELEBRATORY' | 'NEUTRAL';
export type Preferences = { diet: 'any' | 'vegetarian' | 'vegan'; caloriePreference?: number | null; proteinPreference: 'balanced' | 'high'; restrictions: string[]; maxTime?: number | null };
export type User = { id: string; name: string; email: string; role: string; preferences: Preferences };
export type Recipe = { id: string; slug: string; name: string; description: string; image: string; imageCredit: string; prepTime: number; cookTime: number; servings: number; calories: number; protein: number; carbs: number; fat: number; sugar: number; comfort: number; energy: number; vegetarian: boolean; dietaryTags: string[]; allergens: string[]; instructions: string[]; ingredients: { ingredient: { id: string; name: string }; quantity: string }[]; moodTags: { mood: Mood; score: number }[]; score?: number; components?: { mood: number; ingredients: number; nutrition: number; comfortEnergy: number }; availableCount?: number; missing?: string[]; explanation?: string; active?: boolean };
export type PantryItem = { id: string; ingredient: { id: string; name: string }; quantity: string };
export type MoodLog = { id: string; mood: Mood; createdAt: string };
export type Meal = { id: string; mood: Mood; createdAt: string; recipe: Recipe; snapshot: { name: string; image: string; calories: number; protein: number; comfort: number; energy: number } };
export type Analytics = { totalMoods: number; totalMeals: number; moodFrequency: { name: string; count: number }[]; mealsByMood: { name: string; count: number }[]; topRecipes: { name: string; count: number }[]; trends: { date: string; meals: number; comfort: number; energy: number }[] };
export const moods: { id: Mood; label: string; emoji: string; hint: string; color: string }[] = [
  { id: 'HAPPY', label: 'Happy', emoji: '😊', hint: 'Keep the good going', color: '#fff0bb' },
  { id: 'STRESSED', label: 'Stressed', emoji: '😮‍💨', hint: 'A little comfort', color: '#f8e4dc' },
  { id: 'LOW_ENERGY', label: 'Low Energy', emoji: '😴', hint: 'Something uplifting', color: '#e9e6f7' },
  { id: 'CELEBRATORY', label: 'Celebratory', emoji: '🥳', hint: 'Make it special', color: '#fce3e8' },
  { id: 'NEUTRAL', label: 'Neutral', emoji: '😌', hint: 'Find your balance', color: '#e3eedf' },
];
export const moodLabel = (id: string) => moods.find(m => m.id === id)?.label ?? id;
