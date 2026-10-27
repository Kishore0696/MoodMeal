import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { catalog } from './catalog.js';
const db = new PrismaClient();
try {
  for (const item of catalog) {
    const { ingredients, moodTags, ...data } = item;
    const linked: { ingredientId: string; quantity: string }[] = [];
    for (const i of ingredients) {
      const ingredient = await db.ingredient.upsert({ where: { name: i.name }, create: { name: i.name }, update: {} });
      linked.push({ ingredientId: ingredient.id, quantity: i.quantity });
    }
    await db.$transaction(async tx => {
      const recipe = await tx.recipe.upsert({ where: { slug: data.slug }, create: data, update: data });
      await tx.recipeIngredient.deleteMany({ where: { recipeId: recipe.id } });
      await tx.recipeMoodTag.deleteMany({ where: { recipeId: recipe.id } });
      await tx.recipeIngredient.createMany({ data: linked.map(i => ({ ...i, recipeId: recipe.id })) });
      await tx.recipeMoodTag.createMany({ data: moodTags.map(t => ({ ...t, recipeId: recipe.id })) });
    });
  }
  console.log(`Seeded ${catalog.length} recipes; user records were not changed.`);
} finally { await db.$disconnect(); }
