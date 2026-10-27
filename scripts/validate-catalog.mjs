import { readFile } from 'node:fs/promises';
import { parseCatalog } from '../src/lib/catalog.ts';
const manifest = JSON.parse(await readFile('public/data/manifest.json', 'utf8'));
if (!/^\/data\/catalog\.[a-zA-Z0-9._-]+\.json$/.test(manifest.catalog)) throw new Error('Invalid catalog path');
const catalog = parseCatalog(JSON.parse(await readFile(`public${manifest.catalog}`, 'utf8')));
if (catalog.mode !== 'live' || Object.keys(catalog.sorts ?? {}).length !== 5 || Object.values(catalog.sorts).some((sort) => sort.hasMore)) throw new Error('全5順序の全ページ取得を確認できません。');
console.log(`公開前検証: ${catalog.products.length}商品`);
