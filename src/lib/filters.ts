export const STORAGE_KEY = 'booth-quiz-filter:hidden:v1';
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
export type HiddenEntry = { id: string; name: string };
// itemsは旧形式との互換性のため保管・再出力するだけ。現在の絞り込みには使わない。
export type HiddenList = { version: 1; items: HiddenEntry[]; shops: HiddenEntry[] };
export type ImportMode = 'merge' | 'replace';
export const emptyList = (): HiddenList => ({ version: 1, items: [], shops: [] });

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function validId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
}

export function validText(value: unknown, max = 500): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}

function entries(value: unknown): HiddenEntry[] {
  if (!Array.isArray(value)) throw new Error('商品・ショップのリストが配列ではありません。');
  const unique = new Map<string, HiddenEntry>();
  for (const entry of value) {
    if (!isRecord(entry) || !validId(entry.id) || !validText(entry.name)) {
      throw new Error('IDまたは名前の形式が正しくありません。');
    }
    if (!unique.has(entry.id)) unique.set(entry.id, { id: entry.id, name: entry.name });
  }
  return [...unique.values()];
}

export function parseList(text: string): HiddenList {
  if (new TextEncoder().encode(text).byteLength > MAX_IMPORT_BYTES) {
    throw new Error('ファイルは2MiB以下にしてください。件数の固定上限ではなく、読み込み容量の制限です。');
  }
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error('JSONとして読み込めませんでした。'); }
  if (!isRecord(value) || value.version !== 1) throw new Error('対応していないファイル形式です。Que-Filから書き出したJSONファイルを選んでください。');
  return { version: 1, items: entries(value.items), shops: entries(value.shops) };
}

export function combineLists(current: HiddenList, incoming: HiddenList, mode: ImportMode): HiddenList {
  // 画面で置換する対象はショップのみ。表示しない互換データを意図せず失わないよう保管する。
  if (mode === 'replace') return { version: 1, items: entries([...current.items, ...incoming.items]), shops: [...incoming.shops] };
  return {
    version: 1,
    items: entries([...current.items, ...incoming.items]),
    shops: entries([...current.shops, ...incoming.shops]),
  };
}

export function normalizeSearch(text: string): string {
  return text.normalize('NFKC').toLocaleLowerCase('ja').trim();
}

export function matchesSearch(name: string, shop: string, query: string): boolean {
  const haystack = normalizeSearch(`${name} ${shop}`);
  return normalizeSearch(query).split(/\s+/u).every((word) => haystack.includes(word));
}

export type StorageReader = { getItem(key: string): string | null };
export type StorageState = { list: HiddenList; error: string; raw: string | null };

export function readStoredList(getStorage: () => StorageReader): StorageState {
  let raw: string | null = null;
  try {
    raw = getStorage().getItem(STORAGE_KEY);
    return { list: raw === null ? emptyList() : parseList(raw), error: '', raw: null };
  } catch (error) {
    return {
      list: emptyList(), raw,
      error: `保存済み設定を読み込めませんでした。${error instanceof Error ? error.message : 'ブラウザの保存設定をご確認ください。'}`,
    };
  }
}
