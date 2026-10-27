type Meal = { mood: string; createdAt: Date; snapshot: unknown; recipe: { name: string }; recipeId: string };
export function calculateAnalytics(moods: { mood: string }[], meals: Meal[]) {
  const counts = (values: string[]) => [...new Set(values)].map(name => ({ name, count: values.filter(v => v === name).length }));
  const daily = new Map<string, { date: string; meals: number; comfort: number; energy: number }>();
  for (const meal of meals) {
    const date = meal.createdAt.toISOString().slice(0, 10);
    const row = daily.get(date) ?? { date, meals: 0, comfort: 0, energy: 0 };
    const s = meal.snapshot as { comfort?: number; energy?: number };
    row.meals++; row.comfort += s.comfort ?? 0; row.energy += s.energy ?? 0; daily.set(date, row);
  }
  return {
    totalMoods: moods.length, totalMeals: meals.length,
    moodFrequency: counts(moods.map(m => m.mood)), mealsByMood: counts(meals.map(m => m.mood)),
    topRecipes: counts(meals.map(m => m.recipe.name)).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 5),
    trends: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)).map(d => ({ ...d, comfort: Math.round(d.comfort / d.meals), energy: Math.round(d.energy / d.meals) })),
  };
}
