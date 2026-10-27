# Que-Filの自動更新

Cloudflare Cron → GitHub workflow_dispatch → 収集・検証 → Workers Static Assetsへ直接デプロイする。PCの常時稼働や生成JSONのコミットは不要。Cloudflare・GitHubとも未設定・未公開で、現在はローカル実装のみ。

## ファイルと初期状態

- `wrangler.scheduler.jsonc` / `scheduler/index.ts` は起動専用の別Worker。画面用Workerと分離し、HTTP受付は404。D1やHTML解析は使わない。
- UTC 00:17 / 12:17（日本時間09:17 / 21:17）に実行する設定。ただし `SCHEDULER_ENABLED=false` で起動は無効。
- `.github/workflows/collect.yml` はworkflow_dispatchのみ。GitHub scheduleには依存しない。標準Ubuntuランナーを使い、公開リポジトリの無料実行を想定する。リポジトリの公開状態は今回変更していない。
- `COLLECTION_MODE=probe` が初期値。人気順3ページだけを検証し、公開JSONは差し替えない。
- 実行中・待機中のジョブ、または直近11時間の手動/API起動があればCronからの起動をスキップする。失敗していても連続再試行はしない。Actions側にも同時実行制御を置く。
- Actionsには100分の上限を設定。フル収集時のキャッシュは6時間で、12時間後に同じデータを使い続けない。Actionsのキャッシュ・成果物アップロードは現時点では使わない。

## 有効化する手順

1. 変更をGitHubのmainへ反映し、Actions画面からmode=probeで実行。GitHubの環境から3ページ取得できることを確認する。
2. 対象リポジトリだけに限定したGitHub Fine-grained PATを作る。Actionsの読み書き権限を付ける。トークン期限を記録する。
3. `npx wrangler secret put GITHUB_DISPATCH_TOKEN --config wrangler.scheduler.jsonc` で起動用WorkerのSecretに保存する。チャット・コード・公開JSONには貼らない。
4. 起動用Workerは `npx wrangler deploy --config wrangler.scheduler.jsonc` で別途公開する。SCHEDULER_ENABLEDをtrueにして再デプロイすると定期起動を開始する。COLLECTION_MODEは検証中probeを維持。
5. 全件テストへ進む段階で、GitHub Repository variable `ALLOW_FULL_COLLECTION=true` を設定し、手動でmode=fullを実行する。この時点では公開しない。
6. 公開条件・共有用D1の設定等が整った後、GitHub Secretsへ `CLOUDFLARE_API_TOKEN` と `CLOUDFLARE_ACCOUNT_ID` を設定する。APIトークンの対象アカウント・権限を必要範囲に絞る。D1の実DB IDはRepository variable SHARES_DATABASE_IDに設定する。最初のサイト公開はGitHub ActionsのQue-Fil initial deployで実施し、Repository variable `CATALOG_SITE_URL` にそのHTTPS originを設定する。`ENABLE_CATALOG_DEPLOY=true` にするとfull成功時だけ公開する。
7. 最後に起動用WorkerのCOLLECTION_MODEをfullへ変更して再デプロイする。12時間更新の目標となるが、起動・完了時刻の保証はない。

API起動受付と収集・公開の成功は別。起動用WorkerのエラーはCloudflare側、収集・公開の失敗はActions履歴で確認する。GitHubのActions通知設定・Cloudflareのエラー監視は有効化時に確認する。独立した通知先への自動通知・更新遅延の自動警報は未実装。トークン期限切れや権限変更も停止原因になる。

収集失敗時は公開処理へ進まず、Cloudflareの前回配信を維持する。公開を有効にしたジョブは、収集前に公開中のmanifestと商品JSONを取得・検証し、件数減少チェックの基準にする。取得できなければ停止する。初回公開は専用Actionsワークフローで行い、以後の定期更新でこの基準取得を利用する。

## 停止・閉鎖

BOOTH運営から指摘を受けた場合は直ちにサイトを閉鎖し、収集と提供を停止する。Cronだけを止めてもStatic Assetsの公開は続くので、起動用WorkerのCron/起動を停止し、実行中Actionsをキャンセルし、サイト用Workerの公開経路（workers.dev・独自ドメイン）も停止する。ローカルからの再公開も停止中は行わない。閉鎖連絡先・担当者は公開前に確定する。

## 根拠

- [GitHub workflow_dispatch API](https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event)
- [Cloudflare Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
- [GitHub Actions料金](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
