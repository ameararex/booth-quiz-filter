import { collectSearchCatalog } from './collect-search-booth.mjs';
await collectSearchCatalog({ pageLimit: 3, publish: process.argv.includes('--publish') });
