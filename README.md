# Que-Fil（キューフィル）

BOOTHのクイズ商品を好みに合わせて整理する非公式検索補助サイト。React + TypeScript + Viteで検索・ショップ非表示をブラウザ内処理し、商品JSONをWorkers Static Assetsで配信します。

現在のローカルJSONは実BOOTHの「クイズ」タグを新着順で先頭1ページ取得した60商品で、価格数値・公開スキ数を保存しています。全件ではありません。サムネイルは検証済みの公開URLを直接参照し、画像ファイルは保存していません。価格・販売状況はBOOTHで最終確認してください。画像利用条件等の公開前確認は継続中です。

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

- 商品名・ショップ名のAND検索、新着順・スキ順・価格の高い順/低い順。新着順で収集した共通の商品群を検索し、価格・スキ数はブラウザ内でソート。同値は新着順、不明値は末尾。人気順は提供しません。
- サムネイル付き画像表示と細い一覧。ショップ非表示・解除、localStorage保存。
- JSON移行：version 1、追加/置換、重複除去、内容確認、不正データ時の保護。画面では2MBまでと案内（受付上限2MiB）。固定200件制限なし。
- Hono + D1の短い共有URL：7日期限、128KB、サイト全体500リンク/UTC日。送信対象は明示操作で選んだショップID・名前。期限で管理し、削除用管理情報は不要。URLを開くだけで設定を適用しない。
- 商品単位の非表示は撤去。旧JSONのitemsは保管・再出力のみ。端末間の自動同期はしません。

## 収集

npm run collect:booth で「クイズ」タグの新着順を最後のページまで収集します。HTMLとページ単位でまとめたスキ数取得を5秒間隔で実行し、HTMLは既定6時間キャッシュ。固定5,000商品・100ページ制限はありません。1実行80分・800通信・JSON20MiBの予算で停止します。403/429・通信失敗・HTML異常では再試行を続けず、直近正常JSONを維持します。現在、全件取得はユーザー意向により停止中で、タグ全件の所要時間・完走は未確認です。5秒間隔を公式に保証された安全な頻度とは扱いません。ショップIDには実測したサブドメインを使っており、変更時の同一性は保証できません。

## 公開

本番Actionsでの動作確認中。今回のタグ収集・ソート変更は未デプロイ。wrangler.jsonc のD1 IDはプレースホルダーです。共有用D1作成・ID設定・リモートマイグレーション、本番CPU/行読み書きの測定が必要です。通常閲覧をWorkerに通さず、/api/* だけ動的処理します。

npm run deploy:check は公開しないドライラン、npm run deploy は公開操作です。Freeを維持し、有料プランへの変更を前提にしません。

[作業状況](docs/TODO.md)・[構成](docs/architecture.md)・[共有の無料枠と利用例](docs/sharing-budget.md)・[画像とデザイン](docs/sharing-and-thumbnails.md)

自動更新はCloudflare Cron → GitHub Actions方式を採用しました。コードは追加済みですが、定期起動は無効のままです。[設定手順](docs/automation.md)を参照してください。

商品データを更新せず画面だけ公開する場合は、Actionsの **Que-Fil site deploy** を手動実行してください。本番で配信中のJSONと取得日時を引き継ぎ、BOOTHへは収集に行きません。[手順](docs/production-trial.md)
