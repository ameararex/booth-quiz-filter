# Que-Fil（キューフィル）

BOOTHのクイズ商品を好みに合わせて整理する非公式検索補助サイト。React + TypeScript + Viteで検索・ショップ非表示をブラウザ内処理し、商品JSONをWorkers Static Assetsで配信します。

現在のJSONは実BOOTHの5つの並び順を先頭60件ずつ取得した246商品です。全件ではありません。サムネイルは検証済みの公開URLを直接参照し、画像ファイルは保存していません。価格・販売状況はBOOTHで最終確認してください。画像利用条件等の公開前確認は継続中です。

## 起動

Node.js 24.13以上。

```powershell
npm ci
npm run check
npm run dev
```

共有APIも使うローカル環境：

```powershell
npm run build
npm run db:local
npm run dev:worker
```

共有込みは http://127.0.0.1:4175/ 。静的Viteだけでは共有APIは動きません。ポートの違いでlocalStorageも別になります。WindowsでWranglerのログ保存先が制限される場合は XDG_CONFIG_HOME を作業ディレクトリ内 .wrangler/config に設定してください。

## 機能

- 商品名・ショップ名のAND検索、人気順・新着順・スキ順・価格の高い順/低い順。取得した各順序の範囲内で検索。
- サムネイル付き画像表示と細い一覧。ショップ非表示・解除、localStorage保存。
- JSON移行：version 1、追加/置換、重複除去、内容確認、不正データ時の保護。2MiBまで。固定200件制限なし。
- Hono + D1の短い共有URL：7日期限、64KiB、サイト全体100リンク/UTC日。送信対象は明示操作で選んだショップID・名前。削除用秘密鍵は共有URLと分離。URLを開くだけで設定を適用しない。
- 商品単位の非表示は撤去。旧JSONのitemsは保管・再出力のみ。端末間の自動同期はしません。

## 収集

npm run collect:booth で全ページ収集を試行します。10秒間隔・既定6時間キャッシュ、各並び順最大100ページ/5,000商品で停止。403/429・通信失敗・HTML異常で再試行を続けず、直近の正常JSONを維持します。最終ページまでの実測は未完了で、現在は2ページ目の通信失敗で停止しています。10秒間隔を公式に保証された安全な頻度とは扱いません。ショップIDには実測したサブドメインを使っており、変更時の同一性は保証できません。

## 公開

Cloudflareには未公開。wrangler.jsonc のD1 IDはプレースホルダーです。共有用D1作成・ID設定・リモートマイグレーション、本番CPU/行読み書きの測定が必要です。通常閲覧をWorkerに通さず、/api/* だけ動的処理します。

npm run deploy:check は公開しないドライラン、npm run deploy は公開操作です。Freeを維持し、有料プランへの変更を前提にしません。

[作業状況](docs/TODO.md)・[構成](docs/architecture.md)・[共有の無料枠と利用例](docs/sharing-budget.md)・[画像とデザイン](docs/sharing-and-thumbnails.md)

自動更新はCloudflare Cron → GitHub Actions方式を採用しました。コードは追加済みですが、認証設定・公開・定期起動の有効化は未実施です。[設定手順](docs/automation.md)を参照してください。
