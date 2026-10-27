import { isRecord, parseList } from './filters.ts';
import type { HiddenList } from './filters.ts';

export const SHARE_ID_PATTERN = /^[a-zA-Z0-9_-]{24}$/;
export function shareIdFromUrl(text: string): string {
  let url: URL;
  try { url = new URL(text); } catch { throw new Error('共有URLを入力してください。'); }
  const id = url.searchParams.get('share');
  if (!['https:', 'http:'].includes(url.protocol) || !id || !SHARE_ID_PATTERN.test(id)) throw new Error('対応している共有URLではありません。');
  return id;
}

export async function shareRequest(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(`/api/shares${path}`, { ...init, cache: 'no-store' });
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('共有APIを利用できません。Workers版で開くか、JSONファイルを使ってください。');
  const value: unknown = await response.json();
  if (!response.ok) throw new Error(isRecord(value) && typeof value.error === 'string' ? value.error : '共有機能を利用できません。');
  return value;
}

export async function loadSharedList(id: string, signal?: AbortSignal): Promise<{ list: HiddenList; expiresAt: string }> {
  if (!SHARE_ID_PATTERN.test(id)) throw new Error('共有URLの形式が正しくありません。');
  // 貼り付けられたURLへはアクセスせず、現在のサイトのAPIからIDで取得する。
  const value = await shareRequest(`/${id}`, { signal });
  if (!isRecord(value) || value.version !== 1 || typeof value.expiresAt !== 'string' || !Number.isFinite(Date.parse(value.expiresAt))) throw new Error('共有データを確認できません。');
  const list = parseList(JSON.stringify(value.list));
  if (list.items.length) throw new Error('共有対象はショップ設定のみです。');
  return { list, expiresAt: value.expiresAt };
}
