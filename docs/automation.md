# Que-Filの自動更新

Cloudflare Cron → GitHub workflow_dispatch → 収集・検証 → Workers Static Assetsへ直接デプロイする。PCの常時稼働や生成JSONのコミットは不要。本番の4,447商品取得は確認済み。定期起動は未有効化。

## ファイルと初期状態

- `wrangler.scheduler.jsonc` / `scheduler/index.ts` は起動専用の別Worker。画面用Workerと分離し、HTTP受付は404。D1やHTML解析は使わない。
- 起動用WorkerのWorkers Logsは有効。起動ログとconsoleログをCloudflareダッシュボードに保存し、次回のCron結果をObservabilityで確認できる。無効だった期間のログは後から復元できない。
- UTC 01:00 / 07:00 / 13:00 / 19:00（日本時間04:00 / 10:00 / 16:00 / 22:00）に実行する設定。ただし `SCHEDULER_ENABLED=false` で起動は無効。
- `.github/workflows/collect.yml` はworkflow_dispatchのみ。GitHub scheduleには依存しない。標準Ubuntuランナーを使い、公開リポジトリの無料実行を想定する。リポジトリの公開状態は今回変更していない。
- `COLLECTION_MODE=probe` が初期値。「クイズ」のキーワード検索の新着順3ページだけを検証し、公開JSONは差し替えない。
- 実行中・待機中のジョブ、または直近5時間の手動/API起動があればCronからの起動をスキップする。失敗していても連続再試行はしない。Actions側にも同時実行制御を置く。
- Actionsには100分の上限を設定。フル収集時のHTMLキャッシュは最大6時間。各Actionsは新規ランナーで起動し、実行間のHTMLキャッシュの復元はしない。Actionsのキャッシュ・成果物アップロードは現時点では使わない。

## 有効化する手順（PCのコマンド不要）

1. GitHub個人設定 → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token。Resource ownerはameararex、Repository accessはOnly select repositoriesでbooth-quiz-filterだけを選ぶ。Repository permissionsのActionsをRead and writeにする。自動付与のMetadata以外の追加権限は不要。名前はQue-Fil schedulerなど、有効期限は運用できる日数（例90日）を選び、期限を控える。
2. リポジトリSettings → Secrets and variables → Actions → SecretsのNew repository secretで、GH_WORKFLOW_DISPATCH_TOKENに作成したトークンを保存。トークンはチャットやVariableへ貼らない。既存のCLOUDFLARE_API_TOKEN/CLOUDFLARE_ACCOUNT_ID/SHARES_DATABASE_IDは再作成不要。
3. 同じ画面のVariablesに次を登録（既存なら確認）する。

| Repository Variable | 値 |
| --- | --- |
| CATALOG_SITE_URL | https://que-fil.ameararex.com |
| ALLOW_FULL_COLLECTION | true |
| ENABLE_CATALOG_DEPLOY | true |

4. Actions → Que-Fil scheduler deploy → Run workflow → mainを選び、enabledはチェックしたまま実行。起動用Workerを一旦無効で公開し、GitHubトークンをCloudflareのGITHUB_DISPATCH_TOKENへ登録後、fullモードで有効化する。トークン登録失敗時は有効化へ進まない。既存のサイト・D1はこのジョブでは変更しない。
5. 成功したら次の日本時間04:00/10:00/16:00/22:00でQue-Fil collectionが自動起動し、mode=fullで収集→公開することを確認。起動用Workerの公開直後に収集は開始しない。すぐ収集パイプラインだけ確認したい場合はQue-Fil collectionをmode=fullで手動実行できるが、直近5時間の手動実行があると次のCronはスキップする。Cron経由の動作は次の対象時刻で別途確認する。

標準ランナーを使う公開リポジトリを前提にする。トークン期限切れ前には新トークンを同じRepository Secretへ保存し、Que-Fil scheduler deployをenabled付きで再実行する。GitHub側のSecret更新だけではCloudflare側のトークンは置き換わらない。

## 起動エラーを確認する

`que-fil-scheduler` のObservabilityでCronのログを確認する。`Invalid redirect value ... error` は2026-10-28に修正したWorkers非対応のfetchオプションが原因。修正を反映するには **Que-Fil scheduler deploy** をenabled付きで実行する。再公開後に `accepted` ならGitHubが起動要求を受理、`skipped` なら実行中または直近5時間以内の起動による抑制、`disabled` なら起動無効。acceptedは収集・公開完了を意味しない。

管理画面で一時追加したCronはActionsでの再デプロイにより設定ファイルの時刻へ戻る。毎時テストを続ける場合は再デプロイ後に追加し、確認後に除去する。ログ有効化前のエラー詳細は復元できない。

## 自動更新だけを止める

Que-Fil scheduler deployをenabledのチェックを外して実行する。サイト公開や保存済み共有リンクは継続する。実行中の収集は別途Actionsでキャンセルする。Cron設定自体は残るが、起動用WorkerはGitHubへ通信しない。再開はenabled付きで同じワークフローを実行する。

API起動受付と収集・公開の成功は別。起動用WorkerのエラーはCloudflare側、収集・公開の失敗はActions履歴で確認する。GitHubのActions通知設定・Cloudflareのエラー監視は有効化時に確認する。独立した通知先への自動通知・更新遅延の自動警報は未実装。トークン期限切れや権限変更も停止原因になる。

収集失敗時は公開処理へ進まず、Cloudflareの前回配信を維持する。公開を有効にしたジョブは、収集前に公開中のmanifestと商品JSONを取得・検証し、件数減少チェックの基準にする。取得できなければ停止する。初回公開は専用Actionsワークフローで行い、以後の定期更新でこの基準取得を利用する。

## 停止・閉鎖

BOOTH運営から指摘を受けた場合は直ちにサイトを閉鎖し、収集と提供を停止する。Cronだけを止めてもStatic Assetsの公開は続くので、起動用WorkerのCron/起動を停止し、実行中Actionsをキャンセルし、サイト用Workerの公開経路（workers.dev・独自ドメイン）も停止する。ローカルからの再公開も停止中は行わない。閉鎖連絡先・担当者は公開前に確定する。

## 根拠

- [GitHub workflow_dispatch API](https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event)
- [Cloudflare Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
- [GitHub Actions料金](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
