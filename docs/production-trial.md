# 本番環境での動作確認

## 決定事項

- 初回の収集・D1初期化・デプロイからGitHub Actionsを使う。PCのWranglerログインやPCからの公開は不要。
- ドメインはque-fil.ameararex.com。DNSはCloudflare管理。URLはまだ告知しないが、第三者の閲覧は許容する。ログイン制限なし。
- サイトのworkers.dev・プレビューURLは無効。独自ドメインの接続設定はコードへ追加済み。まだCloudflareへデプロイしていない。
- 初回は人気順の3ページを実際に取得し、新しいJSONへ反映してから公開する。他の4順序は既存の取得済みデータを維持。全件検索とは表示しない。

## ユーザーが管理画面で行う準備

### 1. CloudflareでD1を作成

Workers Freeを利用。Cloudflare管理画面のD1で名前booth-quiz-sharesのデータベースを作成し、Database IDを控える。既存なら再作成せず既存IDを使う。テーブルはActionsでマイグレーションするので管理画面からSQLを実行する必要はない。

### 2. CloudflareのAPIトークンを作成

Edit Cloudflare Workersテンプレートを基に、対象アカウントとameararex.comのゾーンに範囲を絞る。D1初期化にも使うため、Account → D1 → Editの権限も付ける。Account IDも控える。トークンはGitHub Secretsに入力し、チャット・コードに貼らない。

### 3. GitHubへ登録

リポジトリのSettings → Secrets and variables → Actionsに登録する。

| 種別 | 名前 | 内容 |
| --- | --- | --- |
| Secret | CLOUDFLARE_API_TOKEN | 作成したCloudflare APIトークン |
| Secret | CLOUDFLARE_ACCOUNT_ID | CloudflareアカウントID |
| Variable | SHARES_DATABASE_ID | D1のDatabase ID |

DB IDはActions内でwrangler.jsoncに設定するので、PCでのファイル編集は不要。

初回はALLOW_FULL_COLLECTIONとENABLE_CATALOG_DEPLOYを設定しない。定期起動用のGitHub PATもまだ不要。

## 初回に実行するワークフロー

コードをGitHubのmainへ反映した後、Actions → Que-Fil initial deploy → Run workflowでmainを選ぶ。

処理順：依存導入 → D1 ID反映 → テスト・ビルド → 人気順3ページ取得 → 配信用JSON生成・再ビルド → D1初期テーブル作成 → que-fil.ameararex.comへデプロイ。

失敗した段階で停止する。人気順の取得が失敗した場合、デプロイへ進めない。GitHubのランナーからの取得が制限されたら停止し、回避しない。D1マイグレーションは適用済みのものを繰り返し適用しない。

Custom DomainはCloudflareにDNSレコード・証明書を管理させる。対象サブドメインに既存レコードがあれば内容を確認し、別サービスのものを置き換えない。設定衝突で失敗した場合にforce指定などで強制しない。

初回用ワークフローは定期デプロイ有効化後は実行できない。全件データを3ページに戻さないため、以後の更新はQue-Fil collectionを使う。

## サイトで確認すること

HTTPS・画像・検索・5種類の並び順、ショップ非表示・解除・保持、共有リンク発行/取り込み/削除を確認。人気順が180件程度に増え、取得範囲と最終更新日時が更新されていることも確認する。localStorageはlocalhostとは別で、必要ならJSONで設定を移す。

## 続いて全件取得を試す

初回サイトの動作確認後、GitHubのVariablesに次を登録する。

| 名前 | 内容 |
| --- | --- |
| CATALOG_SITE_URL | https://que-fil.ameararex.com |
| ALLOW_FULL_COLLECTION | true |
| ENABLE_CATALOG_DEPLOY | true |

Actions → Que-Fil collection → Run workflowでmode=fullを選ぶ。公開中データを比較基準にし、全件収集・検証・ビルドが成功した場合だけ公開を更新する。取得中は現在のサイトが使える。所要時間は約50〜60分の見込みで、実測は未完了。

## 最後に12時間更新

データ取得から検索まで確認できてから、Cloudflare Cron → GitHub workflow_dispatchの起動を有効化する。これは初回テストとは別の最後の作業。[automation.md](automation.md)を参照。

## 公式資料

- [Workers Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)
- [D1の作成](https://developers.cloudflare.com/d1/get-started/)
- [D1のAPI権限](https://developers.cloudflare.com/d1/configuration/local-development/)
