// レベル8の問題データ生成: node gen8.js -> src/data.js
// 手書き10問（src/handmade.js）＋ 計算で作る問題。誤答は「よくあるまちがい」から作り、理由も一緒に付ける。
const fs = require('fs'), path = require('path');

let seed = 20261020;
function R() { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const MINUS = '−';
const lab = v => (v < 0 ? MINUS + (-v) : String(v));
const T = v => String(v);
const fr = (n, d) => '\\dfrac{' + n + '}{' + d + '}';
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
function lcmBrute(a, b) { for (let x = Math.max(a, b); ; x++) if (x % a === 0 && x % b === 0) return x; }
const key = v => (v == null ? 'null:' + Math.random() : Array.isArray(v) ? v.map(x => x.toFixed(9)).join(',') : v.toFixed(9));

/* 問題を組み立てる。truth={v,tex}, cands=[{v,tex,why}]（先のものほど優先） */
function build(o) {
  const unit = o.unit || '';
  const wrap = (tex, raw) => (raw ? tex : '$' + tex + '$' + unit);
  const seen = [o.truth.tex], seenV = [key(o.truth.v)], wrongs = [];
  for (const c of o.cands) {
    if (wrongs.length >= 3) break;
    if (seen.includes(c.tex)) continue;
    if (!c.same && seenV.includes(key(c.v))) continue;
    seen.push(c.tex); seenV.push(key(c.v)); wrongs.push(c);
  }
  if (wrongs.length < 3) throw new Error(o.id + ': 誤答の候補が足りない');
  const all = shuffle([{ t: wrap(o.truth.tex, o.truth.raw), v: o.truth.v, ok: true }].concat(wrongs.map(c => (c.same ? { t: wrap(c.tex, c.raw), v: c.v, why: c.why, same: true } : { t: wrap(c.tex, c.raw), v: c.v, why: c.why }))));
  const ans = all.findIndex(x => x.ok);
  all.forEach(x => delete x.ok);
  const q = { id: o.id, expr: o.expr, p: o.p, ch: all, ans, steps: o.steps, point: o.point };
  if (o.fig) q.fig = o.fig;
  if (o.figAfter) q.figAfter = o.figAfter;
  return q;
}

/* ---------- 共通の小物 ---------- */
const LT = a => a.join(',\\ ');                                  // 数のならび（TeX）
const dfmt = x => String(+x.toFixed(8));                         // 小数の表示
const divisors = n => { const r = []; for (let i = 1; i <= n; i++) if (n % i === 0) r.push(i); return r; };
const reduceF = (n, d) => { const g = gcd(n, d); return [n / g, d / g]; };
const frT = (n, d) => (d === 1 ? String(n) : fr(n, d));           // 分母1なら整数で表示
const Fv = (n, d) => { const [a, b] = reduceF(n, d); return { v: n / d, tex: frT(a, b) }; };
const C = (n, d, why, same) => { const o = { v: n / d, tex: (n * d < 0 ? '-' : '') + frT(Math.abs(n), Math.abs(d)), why }; if (same) o.same = true; return o; };
const mixT = (w, n, d) => String(w) + fr(n, d);
function fracOfDec(x) { const s = Math.round(x * 10000); const g = gcd(s, 10000); return [s / g, 10000 / g]; }
const RAWQ = (id, p, truth, wrongs, steps, point, extra) => build(Object.assign({
  id, expr: '1', p, raw: true, truth: { v: 1, tex: truth, raw: true },
  cands: wrongs.map(([t, why]) => ({ v: null, raw: true, tex: t, why })), steps, point
}, extra || {}));
const lcmOf = (a, b) => a / gcd(a, b) * b;

/* ---------- 共通の小物（レベル8） ---------- */
const fp = n => (n < 0 ? '(' + n + ')' : String(n));       // かっこつきで表示
const sgnWord = s => (s < 0 ? 'マイナス' : 'プラス');
const cnt = a => a.filter(x => x < 0).length;


/* ---------- 文字式の道具 ---------- */
const D = s => (String(s).includes('$') || /[ぁ-んァ-ヶ一-龥]/.test(String(s)) ? s : '$' + s + '$');
// RQ: 4択（式が選択肢）。texはそのまま渡すと $…$ で包む
const RQ = (id, p, t, ws, steps, point, extra) => RAWQ(id, p, D(t), ws.map(([w, why]) => [D(w), why]), steps, point, extra);
// 1次式 a x + b を TeX に
const xt = (a, v) => (a === 1 ? v : a === -1 ? '-' + v : a + v);
const lin = (a, b, v) => { v = v || 'x'; if (a === 0) return String(b); let s = xt(a, v); if (b > 0) s += '+' + b; else if (b < 0) s += '-' + (-b); return s; };
const sgn = n => (n < 0 ? '-' + (-n) : '+' + n);
const num = n => String(n);
// 数値問題（答えがひとつの数）
const NQ = (id, p, t, ws, steps, point, unit) => build({ id, expr: String(t), p, truth: { v: t, tex: dfmt(t) }, cands: ws.map(([v, why]) => ({ v, tex: dfmt(v), why })), steps, point, unit });


/* ---------- 座標グラフの図（SVG） ---------- */
const GR = 6, GS = 22, GC = 150;
const gx = x => GC + GS * x, gy = y => GC - GS * y;
function graph(o) {
  o = o || {};
  const st = (s) => ' style="' + s + '"';
  let s = '<svg viewBox="0 0 300 300" role="img" aria-label="座標平面"' + st('width:100%;max-width:340px;height:auto;display:block;margin:8px auto') + '>';
  for (let i = -GR; i <= GR; i++) {
    if (i === 0) continue;
    s += '<line x1="' + gx(i) + '" y1="' + gy(-GR) + '" x2="' + gx(i) + '" y2="' + gy(GR) + '"' + st('stroke:var(--line);stroke-width:1') + '/>';
    s += '<line x1="' + gx(-GR) + '" y1="' + gy(i) + '" x2="' + gx(GR) + '" y2="' + gy(i) + '"' + st('stroke:var(--line);stroke-width:1') + '/>';
  }
  s += '<line x1="' + gx(-GR - .4) + '" y1="' + GC + '" x2="' + gx(GR + .4) + '" y2="' + GC + '"' + st('stroke:var(--fg);stroke-width:2') + '/>';
  s += '<line x1="' + GC + '" y1="' + gy(-GR - .4) + '" x2="' + GC + '" y2="' + gy(GR + .4) + '"' + st('stroke:var(--fg);stroke-width:2') + '/>';
  const tx = 'font:700 10px sans-serif;fill:var(--muted);text-anchor:middle';
  for (let i = -GR; i <= GR; i++) {
    if (i === 0) continue;
    s += '<text x="' + gx(i) + '" y="' + (GC + 13) + '"' + st(tx) + '>' + i + '</text>';
    s += '<text x="' + (GC - 9) + '" y="' + (gy(i) + 3.5) + '"' + st(tx) + '>' + i + '</text>';
  }
  s += '<text x="' + (GC - 8) + '" y="' + (GC + 13) + '"' + st(tx) + '>O</text>';
  s += '<text x="' + gx(GR + .4) + '" y="' + (GC + 24) + '"' + st('font:700 12px sans-serif;fill:var(--fg);text-anchor:end') + '>x</text>';
  s += '<text x="' + (GC + 10) + '" y="' + (gy(GR + .4) + 8) + '"' + st('font:700 12px sans-serif;fill:var(--fg)') + '>y</text>';
  (o.lines || []).forEach(a => {                       // y = a x
    const xm = Math.min(GR, GR / Math.abs(a));
    s += '<line x1="' + gx(-xm) + '" y1="' + gy(-a * xm) + '" x2="' + gx(xm) + '" y2="' + gy(a * xm) + '"' + st('stroke:var(--neg);stroke-width:2.5;stroke-linecap:round') + '/>';
  });
  (o.hyper || []).forEach(a => {                       // y = a / x
    [1, -1].forEach(sg => {
      let pts = [];
      for (let x = Math.abs(a) / GR; x <= GR + 1e-9; x += 0.05) pts.push(gx(sg * x).toFixed(1) + ',' + gy(a / (sg * x)).toFixed(1));
      s += '<polyline points="' + pts.join(' ') + '" fill="none"' + st('stroke:var(--neg);stroke-width:2.5;stroke-linecap:round') + '/>';
    });
  });
  (o.pts || []).forEach(p => {
    s += '<circle cx="' + gx(p.x) + '" cy="' + gy(p.y) + '" r="4.5"' + st('fill:var(--pos);stroke:var(--card);stroke-width:1.5') + '/>';
    if (p.l) s += '<text x="' + (gx(p.x) + 7) + '" y="' + (gy(p.y) - 6) + '"' + st('font:700 13px sans-serif;fill:var(--pos)') + '>' + p.l + '</text>';
  });
  return { type: 'svg', html: s + '</svg>' };
}
const ct = (x, y) => '(' + x + ',' + y + ')';
const rdc = (n, d) => { const g = gcd(n, d); n /= g; d /= g; if (d < 0) { n = -n; d = -d; } return [n, d]; };
const slope = (n, d) => { [n, d] = rdc(n, d); return d === 1 ? (n === 1 ? '' : n === -1 ? '-' : String(n)) + 'x' : (n < 0 ? '-' : '') + '\\dfrac{' + Math.abs(n) + '}{' + d + '}x'; };
const yEq = (n, d) => 'y=' + slope(n, d);
const hyEq = a => 'y=' + (a < 0 ? '-' : '') + '\\dfrac{' + Math.abs(a) + '}{x}';
const QN = ['第1象限', '第2象限', '第3象限', '第4象限'];

const PI = n => (n === 1 ? '\\pi' : n + '\\pi');

const PU = (n, u) => '$' + PI(n) + '$ ' + u;
const S_ = s => ' style="' + s + '"';
const svgW = (h, inner) => '<svg viewBox="0 0 260 ' + h + '" role="img" aria-label="図"' + S_('width:100%;max-width:320px;height:auto;display:block;margin:8px auto') + '>' + inner + '</svg>';
const ln = (x1, y1, x2, y2, c, w, dash) => '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '"' + S_('stroke:var(' + c + ');stroke-width:' + (w || 2) + ';stroke-linecap:round' + (dash ? ';stroke-dasharray:5 4' : '')) + '/>';
const tx = (x, y, t, a) => '<text x="' + x + '" y="' + y + '"' + S_('font:700 13px sans-serif;fill:var(--fg);text-anchor:' + (a || 'middle')) + '>' + t + '</text>';
const circ = (cx, cy, r) => '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="var(--card)"' + S_('stroke:var(--fg);stroke-width:2.5') + '/>';
const exXY = (a, b) => { let s = a === 0 ? '' : xt(a, 'x'); if (b !== 0) { const t = xt(Math.abs(b), 'y'); s += s === '' ? (b < 0 ? '-' : '') + t : (b < 0 ? '-' : '+') + t; } return s || '0'; };
const cases = (e1, e2) => '\\begin{cases} ' + e1 + ' \\\\ ' + e2 + ' \\end{cases}';
const ansXY = (x, y) => 'x=' + x + ',\\ y=' + y;
const TT = s => '$' + s + '$';

/* ================= パートA: 式の計算 ================= */
function addQ(id, A, B, op, m) {
  m = m || [1, 1]; const s = op === '-' ? -1 : 1;
  const ra = m[0] * A[0] + s * m[1] * B[0], rb = m[0] * A[1] + s * m[1] * B[1];
  const mm = (k, e) => (k === 1 ? '(' + e + ')' : k + '(' + e + ')');
  const p = '$' + (m[0] === 1 && m[1] === 1 ? '(' + exXY(...A) + ')' + (s < 0 ? '-' : '+') + '(' + exXY(...B) + ')' : mm(m[0], exXY(...A)) + (s < 0 ? '-' : '+') + mm(m[1], exXY(...B))) + '$ を計算しよう。';
  const nf = [m[0] * A[0] - s * m[1] * B[0], m[0] * A[1] - s * m[1] * B[1]];
  const wr = [];
  wr.push([TT(exXY(...nf)), s < 0 ? 'かっこの前がマイナスのとき、かっこの中の符号が、ぜんぶ変わるよ。' : 'たし算だよ。かっこの中の符号は、そのまま。']);
  wr.push([TT(exXY(ra, -rb)), '符号に気をつけて、$y$ の項をもう一度計算しよう。']);
  wr.push([TT(exXY(-ra, rb)), '符号に気をつけて、$x$ の項をもう一度計算しよう。']);
  if (ra && rb) wr.push([TT((ra + rb) + 'xy'), '$x$ と $y$ は、ちがう文字。まとめられないよ。']);
  wr.push([TT(exXY(rb, ra)), '$x$ と $y$ の係数が、入れかわっているよ。']);
  const st = [];
  if (m[0] !== 1 || m[1] !== 1) st.push('かっこをはずす：' + (m[0] !== 1 ? '$' + m[0] + '$ を、かっこの中の全部にかける。' : '') + (m[1] !== 1 ? '$' + m[1] + '$ も同じ。' : ''));
  if (s < 0) st.push('かっこの前がマイナスなので、かっこの中の符号を、ぜんぶ変える。');
  st.push('$x$ の項どうし、$y$ の項どうしを、まとめる。');
  st.push('答え：$' + exXY(ra, rb) + '$。');
  return RAWQ(id, p, TT(exXY(ra, rb)), wr, st, '同類項（文字が同じ項）だけを、まとめる。');
}
function genKeisan() {
  return [
    RQ('ks-1', '$3x$ と同類項なのは？', '$-5x$', [['$3x^2$', '$x^2$ は、$x$ とは、ちがう項（次数がちがう）。同類項は、文字も次数も同じ。'], ['$3y$', '$y$ は、$x$ とは、ちがう文字。'], ['$3$', '数だけの項は、文字の項とは、ちがう。']], ['同類項は、文字の部分が同じ項。', '$3x$ と $-5x$ は、どちらも $x$。'], '同類項 ＝ 文字の部分が、まったく同じ項。', null),
    addQ('ks-2', [2, 3], [4, -5], '+'),
    addQ('ks-3', [5, -2], [3, 4], '-'),
    addQ('ks-4', [3, -2], [1, -5], '-'),
    addQ('ks-5', [1, 3], [2, -1], '+', [2, 3]),
    addQ('ks-6', [2, -1], [1, -3], '-', [3, 2]),
    NQ('ks-7', '$2(x+y)-(x-3y)$ を計算して、$x=3,\\ y=-1$ を代入すると？', -2, [[2, '$x+5y$ ではなく、まちがった式に代入しているかも。かっこをはずして、もう一度。'], [8, '$y$ の符号を、まちがえているよ。$x+5y$ に $x=3,\\ y=-1$ を入れる。'], [-8, '$3+5\\times(-1)$ を、もう一度計算しよう。']], ['かっこをはずす：$2x+2y-x+3y=x+5y$。', '代入：$3+5\\times(-1)=3-5=-2$。'], 'まず式を、かんたんにしてから、代入する。')
  ];
}
function genJoJo() {
  return [
    RQ('kj-1', '$3a\\times4b$ を計算すると？', '$12ab$', [['$7ab$', '係数どうしは、かけ算。$3\\times4=12$。'], ['$12a+b$', '文字は、足さずに、かけ合わせて $ab$ と書く。'], ['$12a^2b^2$', '文字は、それぞれ1つずつ。2乗にはならない。']], ['係数：$3\\times4=12$。', '文字：$a\\times b=ab$。'], '単項式のかけ算は、係数どうし・文字どうし。'),
    RQ('kj-2', '$(-2x)\\times3x^2$ を計算すると？', '$-6x^3$', [['$-6x^2$', '$x\\times x^2=x^3$。指数は、足す。'], ['$-5x^3$', '係数は、足さずに、かける。$-2\\times3=-6$。'], ['$6x^3$', '符号に注意。負の数×正の数は、負。']], ['係数：$(-2)\\times3=-6$。', '文字：$x\\times x^2=x^3$。'], '同じ文字のかけ算は、指数を足す。'),
    RQ('kj-3', '$12ab\\div3a$ を計算すると？', '$4b$', [['$4ab$', '$a$ も、$a$ でわれて、消える。'], ['$4a$', '消えるのは $a$。残るのは $b$。'], ['$9b$', '係数は、わり算。$12\\div3=4$。']], ['係数：$12\\div3=4$。', '文字：$a$ と $a$ が約分されて、$b$ が残る。'], '単項式のわり算は、係数どうし・文字は約分。'),
    RQ('kj-4', '$8x^2y\\div(-2x)$ を計算すると？', '$-4xy$', [['$4xy$', '符号に注意。正の数 ÷ 負の数は、負。'], ['$-4x^2y$', '$x^2\\div x=x$。1つ減る。'], ['$-6xy$', '係数は、わり算。$8\\div(-2)=-4$。']], ['係数：$8\\div(-2)=-4$。', '文字：$x^2\\div x=x$。$y$ はそのまま。'], '同じ文字のわり算は、指数を引く。'),
    RQ('kj-5', '$(2x)^2$ を計算すると？', '$4x^2$', [['$2x^2$', '2乗は、$2$ にもかかる。$2^2=4$。'], ['$4x$', '$x$ も2乗される。$x^2$。'], ['$4x^3$', '$(2x)^2=2x\\times2x=4x^2$。指数は3にならない。']], ['$(2x)^2=2x\\times2x$。', '$=4x^2$。'], '$(ab)^2=a^2b^2$。かっこの中ぜんぶが2乗。'),
    RQ('kj-6', '$(-3a)^2$ を計算すると？', '$9a^2$', [['$-9a^2$', '$(-3)\\times(-3)=9$。かっこの中のマイナスも、2乗されて、正になる。'], ['$6a^2$', '$3\\times3=9$。$3\\times2$ ではない。'], ['$-6a^2$', '$(-3)\\times(-3)=9$。']], ['$(-3a)\\times(-3a)=9a^2$。'], '負の数の2乗は、正。かっこの中ぜんぶが2乗。'),
    RQ('kj-7', '$6x^2\\div3x\\times2x$ を計算すると？', '$4x^2$', [['$4x$', '左から順に。$6x^2\\div3x=2x$。それに $2x$ をかける。'], ['$1$', '$6x^2\\div(3x\\times2x)$ ではなく、左から順に計算。'], ['$x^2$', '$6x^2\\div3x=2x$、$2x\\times2x=4x^2$。']], ['左から順に。$6x^2\\div3x=2x$。', '$2x\\times2x=4x^2$。'], 'かけ算とわり算は、左から順に。')
  ];
}
function genRiyo() {
  return [
    NQ('ml-1', '$x=-2$ のとき、$3x^2-x$ の値は？', 14, [[10, '$x^2=(-2)^2=4$、$-x=+2$。$12+2$。'], [-10, '$(-2)^2$ は、$+4$。マイナスにならないよ。'], [2, '$3\\times4=12$ に、$-x=2$ を足す。']], ['$x^2=(-2)\\times(-2)=4$、$3x^2=12$。', '$-x=-(-2)=2$。$12+2=14$。'], '負の数を代入するときは、かっこをつける。'),
    RQ('ml-2', '$2x+y=7$ を、$y$ について解くと？', '$y=7-2x$', [['$y=2x-7$', '$2x$ を移項すると、符号が変わる。$y=7-2x$。'], ['$y=7+2x$', '$2x$ を、移項すると、$-2x$ になる。'], ['$y=\\dfrac{7}{2x}$', '$2x$ は、わるのではなく、移項（引く）。']], ['$2x$ を右辺に移項して、$y=7-2x$。'], '$y$ について解く ＝ $y=\\sim$ の形にする。'),
    RQ('ml-3', '$3x-2y=6$ を、$y$ について解くと？', '$y=\\dfrac{3x-6}{2}$', [['$y=3x-6$', '両辺を $-2$ でわるのを、忘れているよ。'], ['$y=\\dfrac{3x+6}{2}$', '$6$ を移項すると、符号が変わる。$-2y=6-3x$ → $y=\\dfrac{3x-6}{2}$。'], ['$y=\\dfrac{6-3x}{2}$', '$-2y=6-3x$ の、両辺を $-2$ でわる。符号も変わる。']], ['$3x$ を移項：$-2y=6-3x$。', '両辺を $-2$ でわる：$y=\\dfrac{3x-6}{2}$。'], '両辺を、同じ数でわる（かける）。符号に注意。'),
    RQ('ml-4', '三角形の面積 $S=\\dfrac{1}{2}ah$ を、$h$ について解くと？', '$h=\\dfrac{2S}{a}$', [['$h=\\dfrac{Sa}{2}$', '両辺に $2$ をかけて、$a$ でわる。$a$ は、かけない。'], ['$h=\\dfrac{S}{2a}$', '両辺に $2$ をかける。わるのではない。'], ['$h=2Sa$', '$a$ は、かけるのではなく、わる。']], ['両辺に $2$ をかける：$2S=ah$。', '両辺を $a$ でわる：$h=\\dfrac{2S}{a}$。'], '等式の変形：かけ算・わり算で、$\\sim$ の形にする。'),
    RQ('ml-5', '$n$ を整数とするとき、奇数を表す式は？', '$2n+1$', [['$2n$', '$2n$ は、偶数。奇数は、それに1を足す。'], ['$2n-2$', '$2n-2$ は、偶数。'], ['$n+1$', '$n$ が偶数のとき、$n+1$ は奇数だが、いつも奇数とは限らない。']], ['偶数は $2n$。それに1を足した $2n+1$ が奇数。'], '偶数 ＝ $2n$、奇数 ＝ $2n+1$。'),
    RQ('ml-6', '連続する3つの整数の和は、何の倍数？（真ん中の整数を $n$ とする）', '3の倍数', [['2の倍数', '$(n-1)+n+(n+1)=3n$。2の倍数とは限らない。'], ['6の倍数', '$3n$ は、$n$ が奇数のとき、6の倍数にならない。'], ['4の倍数', '$3n$ は、4の倍数とは限らない。']], ['$(n-1)+n+(n+1)=3n$。', '$3\\times$（整数）なので、3の倍数。'], '連続する3つの整数の和 ＝ 真ん中の数の3倍。'),
    RQ('ml-7', '百の位が $a$、十の位が $b$、一の位が $c$ の3けたの自然数を、式で表すと？', '$100a+10b+c$', [['$abc$', '$abc$ は、$a\\times b\\times c$ の意味になる。'], ['$a+b+c$', '$a+b+c$ は、各位の数の和。'], ['$a+10b+100c$', '位が、逆になっているよ。百の位は、$100a$。']], ['百の位は $100a$、十の位は $10b$、一の位は $c$。', '$100a+10b+c$。'], '何の位かで、$100$、$10$、$1$ をかける。')
  ];
}
/* ================= パートB: 連立方程式 ================= */
function solveP(id, p, sol, steps, point) {
  const [x, y] = sol;
  const wr = [];
  wr.push([TT(ansXY(y, x)), '$x$ と $y$ が、入れかわっているよ。もとの式に代入して、たしかめよう。']);
  wr.push([TT(ansXY(x, -y)), '$y$ の符号が、ちがうよ。もとの式に代入して、たしかめよう。']);
  wr.push([TT(ansXY(-x, y)), '$x$ の符号が、ちがうよ。もとの式に代入して、たしかめよう。']);
  wr.push([TT(ansXY(x + 1, y - 1)), '1つの式にしか合っていないかも。2つの式の両方に代入してたしかめよう。']);
  wr.push([TT(ansXY(x - 1, y + 1)), '1つの式にしか合っていないかも。2つの式の両方に代入してたしかめよう。']);
  return RAWQ(id, p, TT(ansXY(x, y)), wr, steps, point || '解は、2つの式の両方に代入して、たしかめる。');
}
function solveQ(id, e1, e2, sol, steps, point) { return solveP(id, '連立方程式 $' + cases(e1, e2) + '$ を解こう。', sol, steps, point); }
function genKagen() {
  return [
    RQ('kg-1', '連立方程式 $\\begin{cases} x+y=5 \\\\ x-y=1 \\end{cases}$ で、2つの式をたすと？', '$2x=6$', [['$2y=4$', '$y$ と $-y$ が消えて、$x$ が残る。'], ['$2x=4$', '$5+1=6$。たすのは、右辺も。'], ['$0=6$', '$x+x=2x$。$x$ は消えない。']], ['左辺どうし：$(x+y)+(x-y)=2x$。', '右辺どうし：$5+1=6$。'], '加減法：たすかひくかして、1つの文字を消す。'),
    solveQ('kg-2', 'x+y=5', 'x-y=1', [3, 2], ['2式をたす：$2x=6$、$x=3$。', '$x=3$ を $x+y=5$ に代入：$y=2$。'], '加減法：1つの文字を消して、先に1つ求める。'),
    solveQ('kg-3', '2x+y=5', 'x-y=1', [2, 1], ['2式をたす：$3x=6$、$x=2$。', '$x=2$ を $x-y=1$ に代入：$y=1$。']),
    solveQ('kg-4', 'x+y=3', 'x-y=5', [4, -1], ['2式をたす：$2x=8$、$x=4$。', '$x=4$ を $x+y=3$ に代入：$y=-1$。']),
    solveQ('kg-5', '3x+2y=12', 'x+2y=8', [2, 3], ['2式をひく：$2x=4$、$x=2$。', '$x=2$ を $x+2y=8$ に代入：$y=3$。'], '同じ係数の文字が消えるように、ひく。'),
    solveQ('kg-6', 'x+2y=7', '3x-y=7', [3, 2], ['下の式を2倍：$6x-2y=14$。', '上の式とたす：$7x=21$、$x=3$。', '$x=3$ を $x+2y=7$ に代入：$y=2$。'], '係数をそろえるには、式を何倍かする。'),
    solveQ('kg-7', '2x+3y=16', '3x-2y=11', [5, 2], ['上の式を2倍、下の式を3倍：$4x+6y=32$、$9x-6y=33$。', 'たす：$13x=65$、$x=5$。', '$x=5$ を $2x+3y=16$ に代入：$y=2$。'], '両方の式を何倍かして、係数をそろえることもある。')
  ];
}
function genDainyu() {
  return [
    RQ('dn-1', '$\\begin{cases} y=2x-1 \\\\ x+y=8 \\end{cases}$ で、上の式を、下の式に代入すると？', '$x+(2x-1)=8$', [['$x+2x=8$', '$-1$ を、落としているよ。$2x-1$ を、まとめて入れる。'], ['$y+(2x-1)=8$', '$y$ のところに、$2x-1$ を入れる。$y$ は消える。'], ['$x+(2x+1)=8$', '符号を、まちがえているよ。$y=2x-1$ をそのまま入れる。']], ['$y$ のところに、$2x-1$ をそのまま入れる。', '$x+(2x-1)=8$。'], '代入法：$y=\\sim$ の式を、もう一方に代入。'),
    solveQ('dn-2', 'y=2x-1', 'x+y=8', [3, 5], ['$y=2x-1$ を $x+y=8$ に代入：$x+(2x-1)=8$。', '$3x=9$、$x=3$。$y=2\\times3-1=5$。'], '代入法：$y=\\sim$ の式を、もう一方に代入。'),
    solveQ('dn-3', 'x=y+2', '2x+y=10', [4, 2], ['$x=y+2$ を $2x+y=10$ に代入：$2(y+2)+y=10$。', '$3y=6$、$y=2$。$x=2+2=4$。']),
    solveQ('dn-4', 'y=x+3', '2x+y=9', [2, 5], ['$y=x+3$ を代入：$2x+(x+3)=9$。', '$3x=6$、$x=2$。$y=5$。']),
    solveQ('dn-5', 'x=3y', 'x+y=12', [9, 3], ['$x=3y$ を代入：$3y+y=12$。', '$4y=12$、$y=3$。$x=9$。']),
    solveQ('dn-6', 'y=-x+4', '3x-y=0', [1, 3], ['$y=-x+4$ を代入：$3x-(-x+4)=0$。', '$4x=4$、$x=1$。$y=3$。'], 'かっこの前がマイナスのとき、符号に注意。'),
    solveQ('dn-7', 'y=3x-2', 'y=x+4', [3, 7], ['$y$ が等しいので、$3x-2=x+4$。', '$2x=6$、$x=3$。$y=3+4=7$。'], '$y=\\sim$ が2つあるときは、右辺どうしを等しいとおく。')
  ];
}
function genIroiro() {
  return [
    solveQ('ir-1', '2(x+y)=10', 'x-y=1', [3, 2], ['かっこをはずす：$2x+2y=10$。または、両辺を2でわって $x+y=5$。', '加減法：$x=3$、$y=2$。'], 'まず、かっこをはずして、整理する。'),
    solveQ('ir-2', 'x+2(y-1)=7', '2x-y=3', [3, 3], ['かっこをはずす：$x+2y-2=7$、$x+2y=9$。', '$2x-y=3$ を2倍して、たす：$5x=15$、$x=3$。$y=3$。']),
    solveQ('ir-3', '\\dfrac{x}{2}+\\dfrac{y}{3}=3', 'x-y=1', [4, 3], ['上の式の両辺に6をかける：$3x+2y=18$。', '下の式を2倍して、たす：$5x=20$、$x=4$。$y=3$。'], '分数は、両辺に分母の最小公倍数をかけて、整数にする。'),
    solveQ('ir-4', '0.3x+0.2y=1.7', 'x+y=7', [3, 4], ['上の式の両辺に10をかける：$3x+2y=17$。', '下の式を2倍して、ひく：$x=3$。$y=4$。'], '小数は、両辺に10（100）をかけて、整数にする。'),
    solveP('ir-5', '方程式 $2x+y=3x-y=10$ を解こう。', [4, 2], ['$A=B=C$ の形は、$A=B$ と $B=C$ のように、2つの式にする。', '$2x+y=10$、$3x-y=10$ として、たすと、$5x=20$、$x=4$。$y=2$。'], '$A=B=C$ は、2つの式に分ける。'),
    RAWQ('ir-6', '連立方程式 $\\begin{cases} ax+y=7 \\\\ x-by=1 \\end{cases}$ の解が $x=2,\\ y=1$ のとき、$a,\\ b$ の値は？', TT('a=3,\\ b=1'), [[TT('a=3,\\ b=2'), '$2-b\\times1=1$ を解くと、$b=1$。'], [TT('a=2,\\ b=1'), '$2a+1=7$ を解くと、$a=3$。'], [TT('a=4,\\ b=1'), '$2a+1=7$ → $2a=6$。$a=3$。'], [TT('a=3,\\ b=3'), '$2-b=1$ → $b=1$。']], ['解を代入する。$2a+1=7$、$2-b=1$。', '$a=3$、$b=1$。'], '解がわかっているときは、その値を代入して、係数を求める。'),
    NQ('ir-7', '連立方程式 $\\begin{cases} x+y=7 \\\\ x-y=1 \\end{cases}$ の解を、$x,\\ y$ とするとき、$xy$ の値は？', 12, [[7, '7 は、$x+y$。$x$ と $y$ をかける。'], [4, '4 は、$x$ の値。$xy$ は、かけ算。'], [3, '3 は、$y$ の値。$xy$ は、かけ算。']], ['加減法：$x=4$、$y=3$。', '$xy=4\\times3=12$。'], '解を求めてから、問われた値を計算する。')
  ];
}
function genBunsho() {
  return [
    NQ('bt-1', 'ノート2冊とペン3本で520円、ノート3冊とペン1本で360円。ノート1冊の値段は？', 80, [[120, '120 は、ペン1本の値段。'], [160, '160 は、ノート2冊の値段。'], [90, '1冊の値段を、もう一度たしかめよう。連立方程式で解く。']], ['ノート1冊を $x$ 円、ペン1本を $y$ 円とする。', '$2x+3y=520$、$3x+y=360$。', '解くと、$x=80$、$y=120$。'], '求めるものを、$x$、$y$ とおいて、2つの式を作る。', '円'),
    NQ('bt-2', '大人2人と子ども3人で2700円、大人1人と子ども2人で1600円。大人1人の入場料は？', 600, [[500, '500 は、子ども1人の入場料。'], [1000, '2つの式を、もう一度解いてみよう。'], [800, '2つの式を、もう一度解いてみよう。']], ['大人1人を $x$ 円、子ども1人を $y$ 円とする。', '$2x+3y=2700$、$x+2y=1600$。', '解くと、$x=600$、$y=500$。'], '2つの式を作って、解く。', '円'),
    NQ('bt-3', '2つの数の和が25、差が7。大きい方の数は？', 16, [[9, '9 は、小さい方の数。'], [18, '大きい方 $x$、小さい方 $y$：$x+y=25$、$x-y=7$。'], [12.5, '12.5 は、和の半分。差を考える。']], ['大きい方を $x$、小さい方を $y$ とする。', '$x+y=25$、$x-y=7$。たして、$2x=32$、$x=16$。'], '和と差から、2つの数が求まる。'),
    RAWQ('bt-4', 'みかん3個とりんご2個で480円、みかん1個とりんご1個で190円。みかん1個を $x$ 円、りんご1個を $y$ 円として、正しい連立方程式は？', TT(cases('3x+2y=480', 'x+y=190')), [[TT(cases('2x+3y=480', 'x+y=190')), 'みかんが3個、りんごが2個。係数が入れかわっているよ。'], [TT(cases('3x+2y=190', 'x+y=480')), '合計金額が、入れかわっているよ。'], [TT(cases('3x+2y=480', 'x-y=190')), '「みかん1個とりんご1個で190円」は、たし算。$x+y=190$。']], ['みかん3個とりんご2個：$3x+2y=480$。', 'みかん1個とりんご1個：$x+y=190$。'], '文章を、式に直す。同じ種類のものは、同じ文字。'),
    NQ('bt-5', '鶴と亀が、あわせて10匹。足の数は、あわせて28本。鶴は何羽？（鶴の足は2本、亀の足は4本）', 6, [[4, '4 は、亀の数。鶴は、何羽？'], [10, '10 は、全部の数。'], [8, '$x+y=10$、$2x+4y=28$ を、もう一度解いてみよう。']], ['鶴を $x$ 羽、亀を $y$ 匹とする。', '$x+y=10$、$2x+4y=28$。', '解くと、$x=6$、$y=4$。'], '頭の数と、足の数で、2つの式を作る。', '羽'),
    NQ('bt-6', '長方形のまわりの長さが20 cm。たては、よこより2 cm 長い。たては？', 6, [[4, '4 は、よこの長さ。たては、それより2 cm 長い。'], [10, '10 は、たて＋よこ。'], [5, '$x-y=2$、$2(x+y)=20$ を、もう一度解いてみよう。']], ['たてを $x$、よこを $y$ とする。', '$x=y+2$、$2(x+y)=20$。', '$x+y=10$ に代入：$2y+2=10$、$y=4$、$x=6$。'], '文章を、2つの式にする。', 'cm'),
    NQ('bt-7', 'AさんとBさんの持っているお金の合計が5000円。AさんはBさんより600円多い。Aさんの金額は？', 2800, [[2200, '2200 は、Bさんの金額。'], [2500, '2500 は、合計の半分。'], [3300, '$x+y=5000$、$x-y=600$ を、もう一度解いてみよう。']], ['Aさんを $x$ 円、Bさんを $y$ 円とする。', '$x+y=5000$、$x-y=600$。たして、$2x=5600$、$x=2800$。'], '和と差から、2つの数が求まる。', '円')
  ];
}

/* ---------- 組み立て ---------- */
const RT = rows => '<table class="rtab">' + rows.map(r => '<tr>' + r.map(c => '<td>' + c + '</td>').join('') + '</tr>').join('') + '</table>';
const I = {
  ks: '<b>同類項</b>は、文字の部分が同じ項。$3x$ と $-5x$ は同類項。<br>同類項は、係数をたし算・ひき算して、<b>まとめる</b>。ちがう文字（$x$ と $y$）は、まとめられない。<br>かっこの前が<b>マイナス</b>のときは、かっこの中の<b>符号がぜんぶ変わる</b>。<br>$2(x+3y)$ のように数がかかるときは、かっこの中の全部にかける。',
  kj: '<b>単項式のかけ算</b>：係数どうし、文字どうしをかける。$3a\\times4b=12ab$。<br><b>わり算</b>：係数どうしをわり、同じ文字は約分。$12ab\\div3a=4b$。<br><b>指数</b>：かけ算は足す（$x\\times x^2=x^3$）、わり算は引く（$x^2\\div x=x$）。<br>$(2x)^2=4x^2$ のように、かっこの中ぜんぶが2乗される。',
  ml: '<b>代入</b>：負の数は、かっこをつけて入れる。<br><b>等式の変形</b>：求めたい文字が、$\\sim$ の形になるように、移項やわり算をする。<br><b>文字式で説明</b>：偶数 $2n$、奇数 $2n+1$、連続する3つの整数 $n-1,\\ n,\\ n+1$。<br>3けたの自然数は、$100a+10b+c$。',
  kg: '<b>連立方程式</b>は、2つの式を、どちらも成り立たせる $x,\\ y$ を求める。<br><b>加減法</b>：2つの式をたしたり、ひいたりして、1つの文字を消す。<br>係数がちがうときは、式を何倍かして、そろえる。<br>1つの文字が求まったら、もとの式に代入して、もう1つを求める。',
  dn: '<b>代入法</b>：$y=\\sim$ や $x=\\sim$ の式を、もう一方の式に代入して、1つの文字を消す。<br>代入するとき、<b>かっこ</b>をつける。$2x+(x+3)=9$。<br>$y=\\sim$ が2つあるときは、右辺どうしを等しいとおく。',
  ir: '<b>かっこ</b>：先にはずして、整理する。<br><b>分数</b>：両辺に分母の最小公倍数をかけて、整数にする。<br><b>小数</b>：両辺に10、100をかけて、整数にする。<br>$A=B=C$ の形は、$A=B$ と $B=C$（または $A=C$）の2つの式にする。<br>解がわかっているときは、代入して、係数を求める。',
  bt: '文章題の手順。<br>① 求めるものを、$x$、$y$ とおく。<br>② 文章から、<b>2つの式</b>を作る。<br>③ 連立方程式を解く。<br>④ 答えが、問題に合っているかを、たしかめる。<br>（人数や個数は、整数。長さは、正の数。）'
};
const ABOUT = {
  shiki: [
    { p: '<b>同類項</b>をまとめる。かっこの前がマイナスなら、符号が変わる。' },
    { p: RT([['$3x+5x$', '→', '$8x$'], ['$-(x-3y)$', '→', '$-x+3y$'], ['$3a\\times4b$', '→', '$12ab$']]) },
    { cap: '文字がちがう項は、まとめられない。' }
  ],
  renritsu: [
    { p: '<b>連立方程式</b>は、2つの式をどちらも成り立たせる。' },
    { p: RT([['加減法', '→', 'たす・ひくで、文字を消す'], ['代入法', '→', '式を代入して、文字を消す'], ['たしかめ', '→', '2つの式に代入']]) },
    { cap: '1つの文字が求まったら、代入して、もう1つ。' }
  ]
};
const PARTS = [
  {
    id: 'shiki', title: '式の計算', sub: '同類項・かけ算わり算・文字式の利用', about: ABOUT.shiki, aboutTitle: 'まず見てみよう：式の計算', aboutSub: '同類項',
    steps: [
      { id: 'shiki-1', title: '式のたし算・ひき算', sub: '同類項をまとめる', intro: I.ks, qs: genKeisan() },
      { id: 'shiki-2', title: '単項式のかけ算・わり算', sub: '係数と指数', intro: I.kj, qs: genJoJo() },
      { id: 'shiki-3', title: '文字式の利用', sub: '代入・等式の変形・説明', intro: I.ml, qs: genRiyo() }
    ]
  },
  {
    id: 'renritsu', title: '連立方程式', sub: '加減法・代入法・文章題', about: ABOUT.renritsu, aboutTitle: 'まず見てみよう：連立方程式', aboutSub: '2つの式を同時に',
    steps: [
      { id: 'renritsu-1', title: '加減法', sub: 'たす・ひくで消す', intro: I.kg, qs: genKagen() },
      { id: 'renritsu-2', title: '代入法', sub: '代入して消す', intro: I.dn, qs: genDainyu() },
      { id: 'renritsu-3', title: 'いろいろな形', sub: 'かっこ・分数・小数', intro: I.ir, qs: genIroiro() },
      { id: 'renritsu-4', title: '連立方程式の文章題', sub: '2つの式を作る', intro: I.bt, qs: genBunsho() }
    ]
  }
];
const RB = s => s.replace(/同類項/g, '<ruby>同類項<rt>どうるいこう</rt></ruby>').replace(/係数/g, '<ruby>係数<rt>けいすう</rt></ruby>').replace(/移項/g, '<ruby>移項<rt>いこう</rt></ruby>').replace(/代入/g, '<ruby>代入<rt>だいにゅう</rt></ruby>').replace(/連立/g, '<ruby>連立<rt>れんりつ</rt></ruby>').replace(/加減法/g, '<ruby>加減法<rt>かげんほう</rt></ruby>').replace(/約分/g, '<ruby>約分<rt>やくぶん</rt></ruby>').replace(/指数/g, '<ruby>指数<rt>しすう</rt></ruby>').replace(/解(?=[はがをにのと、。<」）＝ ]|$)/g, '<ruby>解<rt>かい</rt></ruby>');
const ruby = o => typeof o === 'string' ? o.split(/(<svg[\s\S]*?<\/svg>)/).map((t, k) => k % 2 ? t : RB(t)).join('')
  : Array.isArray(o) ? o.map(ruby) : (o && typeof o === 'object') ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, (k === 'expr' || k === 'id' || k === 'html') ? v : ruby(v)])) : o;
const out = '// 自動生成（node gen8.js）。手で直すときは gen8.js を直す。\nconst PARTS = ' + JSON.stringify(ruby(PARTS)) + ';\nif (typeof module !== \'undefined\') module.exports = PARTS;\n';
fs.writeFileSync(path.join(__dirname, 'src/data.js'), out);
let n = 0; PARTS.forEach(P => P.steps.forEach(s => { n += s.qs.length; }));
console.log('src/data.js を作成：' + n + '問、' + (out.length / 1024).toFixed(0) + 'KB');
