import { mkdir, writeFile } from 'node:fs/promises';
const ids = ['photo-1512621776951-a57141f2eefd','photo-1547592180-85f173990554','photo-1546069901-ba9599a7e63c','photo-1511690743698-d9d85f2fbf38','photo-1490645935967-10de6ba17061','photo-1476224203421-9ac39bcb3327'];
await mkdir('frontend/public/images', { recursive: true });
for (const [i, id] of ids.entries()) {
  try {
    const res = await fetch(`https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&q=85`, { signal: AbortSignal.timeout(15000) });
    if (!res.ok || !res.headers.get('content-type')?.startsWith('image/')) throw new Error(`HTTP ${res.status}`);
    await writeFile(`frontend/public/images/food-${i}.jpg`, Buffer.from(await res.arrayBuffer()));
    console.log(`Saved licensed illustrative food photo ${i}.`);
  } catch (e) { console.log(`Photo ${i} unavailable: ${e.message}`); }
}
