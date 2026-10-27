# 検索エンジンへの登録

## 用意したファイル

- `public/sitemap.xml`：Que-Filのトップページ1件を記載。BOOTHの商品ページ、API、共有URLは掲載しない。
- `public/robots.txt`：サイトマップの絶対URLを記載。APIはクロール対象外。アクセス制御の代わりにはならない。
- `index.html`：canonical、OGP、Twitter Cardを記載。画像はfaviconと同じ180×180の `apple-touch-icon.png`。JavaScript実行前のHTMLから読める。

## ユーザー側の操作（画面を公開した後）

1. GitHub Actionsの **Que-Fil site deploy** を実行する。商品データの更新は不要。
2. `https://que-fil.ameararex.com/sitemap.xml` を開き、XMLが表示されることを確認する。
3. Google Search Consoleで対象プロパティを選ぶ。既に所有権確認済みの `ameararex.com` のドメインプロパティがあれば、サブドメインもその対象。URLプレフィックス型を使う場合は `https://que-fil.ameararex.com/` を登録して所有権を確認する。
4. 左メニューの **サイトマップ** → **新しいサイトマップの追加** で `https://que-fil.ameararex.com/sitemap.xml` を送信する。入力欄にサイトURLが既に表示されている場合は `sitemap.xml` だけ入力する。
5. 処理後にステータスを確認する。必要ならURL検査でトップページのインデックス登録をリクエストする。

サイトマップの取得成功は、検索結果への掲載を保証しない。Que-Filには商品ごとの独立ページがないため、商品数が増えてもサイトマップは1件のまま。

SNSカードは各サービスがHTMLを再取得してから反映される。以前のカードがキャッシュされる場合があり、実際の表示はサービス側でも確認する。

公式資料：[サイトマップレポート](https://support.google.com/webmasters/answer/7451001?hl=ja)、[サイトマップの作成と送信](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap?hl=ja)、[Open Graph protocol](https://ogp.me/)。
