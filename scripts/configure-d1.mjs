import { readFile, writeFile } from 'node:fs/promises';
const id = process.env.SHARES_DATABASE_ID;
if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) || /^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(id)) throw new Error('GitHub variable SHARES_DATABASE_IDに実際のD1 database IDを設定してください。');
const path = 'wrangler.jsonc';
const config = JSON.parse(await readFile(path, 'utf8'));
const binding = config.d1_databases.find((entry) => entry.binding === 'SHARES_DB');
if (!binding) throw new Error('SHARES_DB binding missing');
binding.database_id = id;
await writeFile(path, JSON.stringify(config, null, 2) + '\n');
