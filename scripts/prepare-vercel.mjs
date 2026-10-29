import { accessSync, copyFileSync, readFileSync } from 'node:fs';

const frontend = new URL('../frontend/', import.meta.url);
accessSync(new URL('dist/index.html', frontend));
const config = readFileSync(new URL('vercel.json', frontend), 'utf8');
if (config.includes('REPLACE_WITH_')) throw new Error('Configure the actual backend URL before publishing.');
JSON.parse(config);
copyFileSync(new URL('vercel.json', frontend), new URL('dist/vercel.json', frontend));
console.log('Prepared frontend/dist with the API proxy and SPA routes for Vercel.');
