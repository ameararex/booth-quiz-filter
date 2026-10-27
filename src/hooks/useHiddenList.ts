import { useState } from 'react';
import { readStoredList, STORAGE_KEY } from '../lib/filters.ts';
import type { HiddenList } from '../lib/filters.ts';

export function useHiddenList() {
  const [initial] = useState(() => readStoredList(() => window.localStorage));
  const [list, setList] = useState(initial.list);
  const [blocked, setBlocked] = useState(Boolean(initial.error));
  const [status, setStatus] = useState(initial.error || 'このブラウザに保存できます。');
  const [saved, setSaved] = useState(!initial.error);

  function update(next: HiddenList): boolean {
    if (blocked) return false;
    setList(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setStatus('このブラウザに保存しました。');
      setSaved(true);
    } catch {
      setStatus('保存できませんでした。変更はこの画面だけに反映されています。JSONを書き出して保管してください。');
      setSaved(false);
    }
    return true;
  }

  function recover() {
    try {
      // 読み込めなかった元データは、利用者が明示的に選ぶまで書き換えない。
      window.localStorage.removeItem(STORAGE_KEY);
      setBlocked(false);
      setSaved(true);
      setStatus('保存領域を初期化しました。設定を保存できる状態です。');
    } catch { setStatus('保存領域を初期化できませんでした。ブラウザの保存設定をご確認ください。'); }
  }

  return { list, update, blocked, status, saved, recover, raw: initial.raw };
}
