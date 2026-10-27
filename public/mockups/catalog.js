// デザイン確認専用。元のReact版のlocalStorageは読み書きしない。
const samples = [
  ['001', '春のクイズ大会 問題と記録', 'a', 'ことばのクイズ工房', '¥800', 'spring'],
  ['002', '早押しクイズ はじめの300問', 'b', '青空クイズ研究所', '¥500', 'questions'],
  ['003', '週末のパズルノート', 'c', 'ひらめき文庫', '¥300〜', 'puzzle'],
  ['004', '学生オープン 大会記録集', 'd', '架空大会実行委員会', '¥1,000', 'open'],
  ['005', '日々のクイズ100問 お試し版', 'a', 'ことばのクイズ工房', '無料', 'daily'],
  ['006', 'まちがい探しの小さな本', 'c', 'ひらめき文庫', '¥400', 'puzzle'],
  ['007', 'テーマ別・文学クイズ集', 'b', '青空クイズ研究所', '価格未確認', 'literature'],
  ['008', '夏のペーパークイズ 記録集', 'e', 'クイズの庭', '¥600', 'open'],
];
const hiddenItems = new Set();
const hiddenShops = new Set();
const products = document.querySelector('#products');
const query = document.querySelector('#query');
const message = document.querySelector('#message');
const dialog = document.querySelector('#hidden-dialog');
const normalize = (text) => text.normalize('NFKC').toLocaleLowerCase('ja').trim();
// 操作確認用に決めた順番。日付・売上・BOOTH上の順位から推測しない。
const sampleOrders = {
  new: ['001', '002', '003', '004', '005', '006', '007', '008'],
  popular: ['004', '002', '007', '001', '008', '005', '003', '006'],
};
const sortOrder = document.querySelector('#sort-order');

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function renderHidden() {
  for (const [selector, set, shop] of [['#hidden-items', hiddenItems, false], ['#hidden-shops', hiddenShops, true]]) {
    const list = document.querySelector(selector);
    list.replaceChildren();
    if (!set.size) list.append(element('li', '登録されていません'));
    for (const id of set) {
      const product = samples.find((item) => item[shop ? 2 : 0] === id);
      const row = element('li');
      row.append(element('span', product[shop ? 3 : 1]));
      const restore = element('button', '解除');
      restore.setAttribute('aria-label', `${product[shop ? 3 : 1]}の非表示を解除`);
      restore.addEventListener('click', () => { set.delete(id); render(); document.querySelector('#close-hidden').focus(); });
      row.append(restore);
      list.append(row);
    }
  }
}

function render() {
  const words = normalize(query.value).split(/\s+/u);
  const available = samples.filter((item) => !hiddenItems.has(item[0]) && !hiddenShops.has(item[2]));
  const visible = available.filter((item) => words.every((word) => normalize(`${item[1]} ${item[3]}`).includes(word)));
  const order = sampleOrders[sortOrder.value];
  visible.sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));
  products.replaceChildren();
  for (const [id, name, shopId, shop, price, cover] of visible) {
    const card = element('article');
    const thumbnail = element('div', '', 'thumbnail');
    const image = document.createElement('img');
    image.src = `./covers/${cover}.svg`;
    image.alt = `${name}の仮表紙`;
    image.width = 360;
    image.height = 360;
    image.loading = 'lazy';
    thumbnail.append(image, element('small', '仮の表紙'));
    const body = element('div', '', 'card-body');
    const title = element('div', '', 'item-title');
    const shopName = element('p', shop, 'shop');
    shopName.title = shop;
    const productName = element('h2', name);
    productName.title = name;
    const priceLabel = element('p', price, 'price');
    priceLabel.title = price;
    title.append(shopName, productName);
    body.append(title, priceLabel);
    const actions = element('div', '', 'item-actions');
    function hideButton(label, set, key, displayName) {
      const button = element('button');
      button.setAttribute('aria-label', `${label}：${displayName}`);
      button.title = `${label}：${displayName}`;
      button.addEventListener('click', () => {
        set.add(key); render(); message.textContent = `${displayName}を非表示にしました。非表示リストから解除できます。`; query.focus();
      });
      return button;
    }
    const hideShop = hideButton('ショップを非表示', hiddenShops, shopId, shop);
    hideShop.className = 'hide-shop';
    hideShop.append(element('span', 'ショップを非表示', 'full-label'), element('span', '非表示', 'short-label'));
    const more = element('details', '', 'secondary-actions');
    const summary = element('summary', '…');
    summary.setAttribute('aria-label', `${name}のその他の操作`);
    summary.title = 'その他の操作';
    const hideItem = hideButton('商品を非表示', hiddenItems, id, name);
    hideItem.textContent = 'この商品を非表示';
    more.append(summary, hideItem);
    actions.append(hideShop, more);
    body.append(actions);
    card.append(thumbnail, body);
    products.append(card);
  }
  document.querySelector('#result-count').textContent = visible.length;
  document.querySelector('#hidden-count').textContent = hiddenItems.size + hiddenShops.size;
  document.querySelector('#hidden-summary').textContent = `非表示 ${samples.length - available.length}件`;
  document.querySelector('#empty').hidden = visible.length !== 0;
  renderHidden();
}

document.querySelector('#search-form').addEventListener('submit', (event) => { event.preventDefault(); render(); });
query.addEventListener('input', render);
sortOrder.addEventListener('change', render);
document.querySelector('#open-hidden').addEventListener('click', () => dialog.showModal());
document.querySelector('#close-hidden').addEventListener('click', () => dialog.close());
for (const [id, list] of [['#grid-view', false], ['#list-view', true]]) {
  document.querySelector(id).addEventListener('click', () => {
    products.classList.toggle('list', list);
    document.querySelector('#grid-view').setAttribute('aria-pressed', String(!list));
    document.querySelector('#list-view').setAttribute('aria-pressed', String(list));
  });
}
render();
