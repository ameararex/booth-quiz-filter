import { readFile, writeFile } from 'node:fs/promises';

// 配信するReact系ランタイム、Viteのpreload補助コード、共有APIのHono。
// 配信ライブラリを追加した場合は、この一覧と同梱コードの権利表記を確認する。
const packages = [
  ['react', 'LICENSE'],
  ['react-dom', 'LICENSE'],
  ['scheduler', 'LICENSE'],
  ['vite', 'LICENSE.md'],
  ['hono', 'LICENSE'],
];
const root = new URL('../', import.meta.url);
const sections = ['Que-Fil — Third-party notices\n\n各ソフトウェアの著作権表示・ライセンス原文です。\nViteの項には配布パッケージに同梱された依存コードの権利表記も含みます。\nQue-Fil独自のコードやBOOTHの商品情報・画像に、これらのライセンスを適用するものではありません。'];
for (const [name, licensePath] of packages) {
  const base = new URL(`node_modules/${name}/`, root);
  const metadata = JSON.parse(await readFile(new URL('package.json', base), 'utf8'));
  const license = await readFile(new URL(licensePath, base), 'utf8');
  sections.push(`${name} ${metadata.version}\n${'='.repeat(60)}\n\n${license.trim()}`);
}
sections.push(`M PLUS Rounded 1c\n${'='.repeat(60)}\n\n${(await readFile(new URL('public/fonts/LICENSE', root), 'utf8')).trim()}`);
await writeFile(new URL('public/third-party-notices.txt', root), `${sections.join('\n\n\n')}\n`, 'utf8');
console.log('第三者ライセンスを public/third-party-notices.txt に出力しました。');
