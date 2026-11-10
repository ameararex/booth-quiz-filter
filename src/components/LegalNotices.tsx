const CONTACT_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSf6rMQ4ncOKFKU3fdr8FIkBPWeNgWFdVbPnCeDuHaFDRSpb7w/viewform';

export function LegalNotices() {
  return <>
    <details className="disclaimer" id="privacy">
      <summary>プライバシー・外部通信について</summary>
      <p>最終更新：2026年11月10日</p>
      <h3>検索・非表示設定とJSONファイル</h3>
      <p>検索語はブラウザ内で処理し、検索語や通常の非表示操作をサーバーへ送信しません。非表示設定は、このブラウザのlocalStorageに保存します。端末・ブラウザ間では自動同期されず、ブラウザのデータ消去などで失われることがあります。</p>
      <p>JSONファイルの取り込み・書き出しは端末内で行い、ファイルをサーバーへアップロードしません。非表示設定は設定画面から解除できます。バックアップにはJSONの書き出しをご利用ください。</p>
      <h3>URL共有で保存する情報</h3>
      <p>「共有リンクを作る」を押したときに限り、非表示ショップのID・名前をCloudflare D1に送信し、端末間の移行・共有のためにコピーを保存します。共有ID、作成日時、有効期限も保存します。検索語や旧形式の商品単位の設定は共有しません。</p>
      <p>共有URLを知っている人は、ログインなしでリストを閲覧・取り込みできます。公開したくないリストのURLを、不特定多数に公開しないでください。共有後に手元の設定を変更しても、共有済みのコピーは変わりません。</p>
      <p>共有リンクは作成から7日で失効し、APIから取得できなくなります。期限切れのデータは、新しい共有リンクの作成時に順次削除します。失効と同時の完全削除は保証しません。利用者が期限前に共有リンクを削除する機能はありません。</p>
      <h3>お問い合わせで送信する情報</h3>
      <p>お問い合わせにはGoogleフォームを利用します。お問い合わせの種類・内容と、任意で入力した対象の商品・ショップURL、返信先メールアドレスを、お問い合わせへの対応・事実確認・返信のために利用します。返信を希望する場合だけメールアドレスを入力してください。お問い合わせに不要な個人情報、パスワード、購入履歴、非表示リストや共有URLは入力しないでください。</p>
      <h3>通信先と送信される情報</h3>
      <ul className="privacy-destinations">
        <li><strong>Google LLC（お問い合わせフォーム）</strong><p>問い合わせ窓口のリンクを開くとGoogleへ移動し、IPアドレスやブラウザ等の通信情報が送信されます。フォームを送信すると、入力した内容がGoogleのサービスに保存され、Que-Filの運営者が確認します。Googleによる情報の取り扱いは<a href="https://policies.google.com/privacy?hl=ja" target="_blank" rel="noopener noreferrer">Googleのプライバシーポリシー</a>をご確認ください。</p></li>
        <li><strong>Cloudflare, Inc.（本サイトの配信・共有機能）</strong><p>ページ・商品データの配信、共有リストの保存・取得、安全な運用のため、IPアドレス、要求したURL、通信日時、ブラウザ等の通信情報がCloudflareへ送信されます。共有操作時には上記の共有データも送信されます。Cloudflareでの処理・ログ等の取り扱いは、同社のサービスと設定に依存します。詳しくは<a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener noreferrer">Cloudflareのプライバシーポリシー</a>をご確認ください。</p></li>
        <li><strong>ピクシブ株式会社（商品画像の配信：booth.pximg.net）</strong><p>商品画像を表示する際、ブラウザから画像配信先へ直接通信し、IPアドレス、画像のURL、ブラウザ等の通信情報が送信されます。画像の要求には参照元URLを付けない設定にしています。商品画像ファイルをQue-Filのサーバーへ複製保存する方式ではありません。通信先での情報の取り扱いは<a href="https://policies.pixiv.net/#privacy" target="_blank" rel="noopener noreferrer">ピクシブのプライバシーポリシー</a>をご確認ください。</p></li>
      </ul>
      <p>本サイトのコードに広告・アクセス解析用のタグや、追跡用Cookieを設定する処理は組み込んでいません。フォントは本サイトから配信し、Google Fontsなどからは読み込みません。BOOTH等の外部リンクを開いた後は、移動先の規約・プライバシーポリシーが適用されます。</p>
    </details>
    <details className="disclaimer" id="licenses">
      <summary>第三者ライセンス</summary>
      <p>本サービスはReact、React DOM、Scheduler、Viteの補助コード、Honoなどのオープンソースソフトウェアと、M PLUS Rounded 1cフォントを利用しています。</p>
      <p><a href="/third-party-notices.txt" target="_blank" rel="noopener noreferrer">著作権表示・ライセンス全文</a> ／ <a href="/fonts/LICENSE" target="_blank" rel="noopener noreferrer">フォントのライセンス（SIL Open Font License 1.1）</a></p>
      <p>これらのライセンスは各ソフトウェア・フォントに適用されます。掲載商品の画像・文章などを自由に利用できることを示すものではありません。</p>
    </details>
    <p><a className="footer-contact" href={CONTACT_FORM_URL} target="_blank" rel="noopener noreferrer">お問い合わせ・掲載停止のご連絡（Googleフォーム）</a></p>
  </>;
}
