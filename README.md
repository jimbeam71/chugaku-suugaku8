# 中学数学 レベル8（式の計算と連立方程式）

公開URL: https://chugaku-suugaku8.senta1111.workers.dev/

- 配信するのは `public/index.html` の1枚だけ（KaTeXの式表示も中に入っている）。
- 内容: 式の計算 / 連立方程式。全7ステップ・49問。
- 問題を直す・足すとき: `tools/gen8.js` を直す。
  1. `cd tools`
  2. `node gen8.js`（`src/data.js` を作る）
  3. `node check.js`（ALL OK が出ること）
  4. `node build.js --repo`（`tools/public/index.html` を作る）→ `public/index.html` に置きかえる
