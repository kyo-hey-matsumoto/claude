const pptxgen = require("pptxgenjs");

// ---- palette ----
const RED = "C8102E";      // Keikyu red
const RED_DARK = "8F0C20";
const NAVY = "1F2A44";     // ocean navy
const GOLD = "C9963C";     // tuna/warm accent
const OFFWHITE = "FAFAFA";
const COVER_BG = "DBDDDD"; // light gray cover bg
const PINKBEIGE = "E8C8B8";
const TEXT_DARK = "222222";
const TEXT_GRAY = "6E6E6E";
const CARD_BG = "F2F1EE";
const LINE_GRAY = "D8D8D6";

const SERIF = "Yu Mincho";
const GOTHIC = "Yu Gothic";

const DOC_LABEL = "みさきまぐろきっぷ SW販促プロモーション  Promotion Proposal 1.0";

function pres() {
  const p = new pptxgen();
  p.layout = "LAYOUT_WIDE"; // 13.333 x 7.5
  return p;
}

function addPersistentHeader(slide) {
  slide.addText(
    [
      { text: DOC_LABEL, options: { color: TEXT_GRAY, fontSize: 8, fontFace: GOTHIC } },
      { text: "    confidential", options: { color: TEXT_GRAY, fontSize: 8, fontFace: GOTHIC } },
    ],
    { x: 0.5, y: 0.22, w: 10, h: 0.25, margin: 0, align: "left" }
  );
}

function addChapterTitle(slide, title, opts = {}) {
  const y = opts.y !== undefined ? opts.y : 0.62;
  slide.addShape("rect", {
    x: 0.5, y: y + 0.03, w: 0.045, h: 0.28,
    fill: { color: opts.barColor || RED },
    line: { type: "none" },
  });
  slide.addText(title, {
    x: 0.62, y: y, w: 10, h: 0.34,
    fontFace: GOTHIC, fontSize: 15, bold: true, color: TEXT_DARK,
    margin: 0, align: "left", valign: "middle",
  });
  if (opts.sub) {
    slide.addText(opts.sub, {
      x: 0.62, y: y + 0.34, w: 10, h: 0.22,
      fontFace: GOTHIC, fontSize: 8.5, color: TEXT_GRAY, margin: 0,
    });
  }
}

function baseSlide(p, bg = "FFFFFF") {
  const s = p.addSlide();
  s.background = { color: bg };
  return s;
}

function statTile(slide, x, y, w, h, value, label, opts = {}) {
  slide.addShape("rect", {
    x, y, w, h, fill: { color: opts.fill || CARD_BG }, line: { type: "none" },
  });
  slide.addText(value, {
    x: x + 0.15, y: y + 0.12, w: w - 0.3, h: h - 0.55,
    fontFace: GOTHIC, fontSize: opts.valueSize || 26, bold: true,
    color: opts.valueColor || RED, align: "left", valign: "bottom", margin: 0,
  });
  slide.addText(label, {
    x: x + 0.15, y: y + h - 0.42, w: w - 0.3, h: 0.32,
    fontFace: GOTHIC, fontSize: 10.5, color: TEXT_GRAY, align: "left", valign: "top", margin: 0,
  });
}

const P = pres();

/* ============================================================
   SLIDE 1: 表紙
   ============================================================ */
{
  const s = baseSlide(P, COVER_BG);
  s.addShape("ellipse", {
    x: 9.6, y: -2.2, w: 7, h: 7, fill: { color: RED, transparency: 88 }, line: { type: "none" },
  });
  s.addShape("ellipse", {
    x: 10.6, y: 3.4, w: 5.2, h: 5.2, fill: { color: NAVY, transparency: 90 }, line: { type: "none" },
  });

  s.addText("京急アド newcalチーム 御中", {
    x: 0.9, y: 1.0, w: 8, h: 0.4, fontFace: GOTHIC, fontSize: 14, color: TEXT_DARK, margin: 0,
  });

  s.addText("みさきまぐろきっぷ\nシルバーウィーク販促プロモーション", {
    x: 0.85, y: 2.7, w: 10.5, h: 1.7, fontFace: SERIF, fontSize: 38, bold: true,
    color: TEXT_DARK, margin: 0, lineSpacingMultiple: 1.15,
  });

  s.addText("Promotion Proposal 1.0", {
    x: 0.9, y: 4.55, w: 8, h: 0.4, fontFace: SERIF, fontSize: 16, color: TEXT_DARK, margin: 0,
  });
  s.addText('"One Catch, Many Days." Promotion Proposal 1.0', {
    x: 0.9, y: 4.95, w: 9, h: 0.4, fontFace: SERIF, italic: true, fontSize: 13, color: TEXT_GRAY, margin: 0,
  });

  s.addText("—", { x: 0.9, y: 5.55, w: 1, h: 0.4, fontFace: GOTHIC, fontSize: 18, color: TEXT_GRAY, margin: 0 });

  s.addText(
    [
      { text: "Date : 2026.8.5", options: { fontFace: GOTHIC, fontSize: 11, color: TEXT_GRAY } },
      { text: "     confidential", options: { fontFace: GOTHIC, fontSize: 11, color: TEXT_GRAY } },
    ],
    { x: 0.9, y: 6.65, w: 8, h: 0.35, margin: 0 }
  );
}

/* ============================================================
   SLIDE 2: Introduction
   ============================================================ */
{
  const s = baseSlide(P, "FFFFFF");
  addPersistentHeader(s);
  addChapterTitle(s, "Introduction");

  s.addText(
    "単にシルバーウィーク中の「みさきまぐろきっぷ」の広告を\n打つことが目的ではありません。\n\nまぐろ一本の話題が多くの人に伝わっていくように、\nシルバーウィーク前から一気に「知っている人」を増やし、\n\n話題そのものを大きくしていくためのご提案です。",
    {
      x: 1.3, y: 2.0, w: 10.7, h: 3.1, fontFace: GOTHIC, fontSize: 20,
      color: TEXT_DARK, align: "center", valign: "middle", margin: 0, lineSpacingMultiple: 1.5,
    }
  );

  s.addText(
    "（分散は、インフルエンサーの言葉の端々にそっと忍ばせる、裏テーマとして扱います）",
    { x: 1.3, y: 5.6, w: 10.7, h: 0.5, fontFace: GOTHIC, italic: true, fontSize: 12, color: TEXT_GRAY, align: "center", margin: 0 }
  );
}

/* ============================================================
   SLIDE 3: 与件整理
   ============================================================ */
{
  const s = baseSlide(P, "FFFFFF");
  addPersistentHeader(s);
  addChapterTitle(s, "与件整理");

  // left: product concept box
  s.addShape("rect", { x: 0.5, y: 1.35, w: 6.0, h: 2.55, fill: { color: CARD_BG }, line: { type: "none" } });
  s.addText("＜製品コンセプト＞", { x: 0.75, y: 1.5, w: 5.5, h: 0.3, fontFace: GOTHIC, bold: true, fontSize: 11, color: RED, margin: 0 });
  s.addText(
    "三浦半島・三崎方面への往復乗車券に、まぐろ料理の\n食事券等をセットにした京急の企画乗車券\n「みさきまぐろきっぷ」",
    { x: 0.75, y: 1.85, w: 5.5, h: 0.95, fontFace: GOTHIC, fontSize: 12, color: TEXT_DARK, margin: 0, lineSpacingMultiple: 1.3 }
  );

  const rows3 = [
    ["対象", "みさきまぐろきっぷ（単価 ¥3,750）"],
    ["ターゲット", "全世代（カップル・夫婦・ファミリー・ソロ／女子旅）"],
    ["売り場", "京急線各駅／京急ホームページ・オンライン"],
  ];
  let ry = 2.9;
  rows3.forEach((r) => {
    s.addText(r[0], { x: 0.75, y: ry, w: 1.2, h: 0.32, fontFace: GOTHIC, bold: true, fontSize: 10.5, color: NAVY, margin: 0 });
    s.addText(r[1], { x: 2.0, y: ry, w: 4.35, h: 0.32, fontFace: GOTHIC, fontSize: 10.5, color: TEXT_DARK, margin: 0 });
    ry += 0.36;
  });

  s.addText("＜今回の目標＞", { x: 0.5, y: 4.15, w: 6, h: 0.3, fontFace: GOTHIC, bold: true, fontSize: 11, color: RED, margin: 0 });
  const rows4 = [
    ["目的", "シルバーウィーク付近における売上最大化（話題化を主軸）"],
    ["サブ目標", "インフルエンサーの発信を通じた、さりげない来訪分散"],
  ];
  ry = 4.55;
  rows4.forEach((r) => {
    s.addText(r[0], { x: 0.5, y: ry, w: 1.2, h: 0.5, fontFace: GOTHIC, bold: true, fontSize: 10.5, color: NAVY, margin: 0 });
    s.addText(r[1], { x: 1.75, y: ry, w: 4.75, h: 0.5, fontFace: GOTHIC, fontSize: 10.5, color: TEXT_DARK, margin: 0, lineSpacingMultiple: 1.2 });
    ry += 0.55;
  });

  // right: number stat tiles
  s.addText("＜数値前提＞", { x: 6.85, y: 1.35, w: 6, h: 0.3, fontFace: GOTHIC, bold: true, fontSize: 11, color: RED, margin: 0 });
  statTile(s, 6.85, 1.7, 2.7, 1.15, "¥3,000,000", "総予算");
  statTile(s, 9.75, 1.7, 2.7, 1.15, "¥1,000", "CAC目標");
  statTile(s, 6.85, 3.0, 2.7, 1.15, "3,000人", "送客目標");
  statTile(s, 9.75, 3.0, 2.7, 1.15, "¥11,250,000", "想定売上", { valueSize: 20 });

  s.addShape("rect", { x: 6.85, y: 4.35, w: 5.6, h: 0.7, fill: { color: NAVY }, line: { type: "none" } });
  s.addText("広告宣伝比率 26.6%", {
    x: 6.85, y: 4.35, w: 5.6, h: 0.7, fontFace: GOTHIC, bold: true, fontSize: 16, color: "FFFFFF",
    align: "center", valign: "middle", margin: 0,
  });

  s.addText(
    "内訳：Meta広告 ¥1,500,000／インフルエンサー起用 ¥1,500,000\n（SNS懸賞キャンペーンの景品費・PRクーポン原資は本予算に含めません）",
    { x: 6.85, y: 5.2, w: 5.6, h: 0.7, fontFace: GOTHIC, fontSize: 9.5, color: TEXT_GRAY, margin: 0, lineSpacingMultiple: 1.3 }
  );
}

/* ============================================================
   SLIDE 4: 参考: インフルエンサー起用による話題化のパターン
   ============================================================ */
{
  const s = baseSlide(P, "FFFFFF");
  addPersistentHeader(s);
  addChapterTitle(s, "参考：インフルエンサー起用による話題化のパターン");

  const cards = [
    { title: "信頼で、話題化する", color: RED, body: "観光庁のお墨付きなど、第三者評価がある発信者の情報は、そのまま信頼される。\n\n送客実績・公的評価があるほどコンバージョンに直結しやすい。" },
    { title: "共感で、話題化する", color: GOLD, body: "地域密着・カップル発信のアカウントが、身近な週末プランとして自然に紹介する。\n\n「自分ごと化」しやすく、さりげない一言も自然に届く。" },
    { title: "物量で、話題化する", color: NAVY, body: "フォロワー数そのものの物量でリーチを最大化するアプローチ。\n\n短期間で「知っている人」の母数を一気に増やせる。" },
  ];
  const cw = 3.9, gap = 0.3, startX = 0.5, cy = 1.5, ch = 4.6;
  cards.forEach((c, i) => {
    const x = startX + i * (cw + gap);
    s.addShape("rect", { x, y: cy, w: cw, h: 0.55, fill: { color: c.color }, line: { type: "none" } });
    s.addText(c.title, { x, y: cy, w: cw, h: 0.55, fontFace: GOTHIC, bold: true, fontSize: 14, color: "FFFFFF", align: "center", valign: "middle", margin: 0 });
    s.addShape("rect", { x, y: cy + 0.55, w: cw, h: ch - 0.55, fill: { color: CARD_BG }, line: { type: "none" } });
    s.addText(c.body, { x: x + 0.25, y: cy + 0.85, w: cw - 0.5, h: ch - 1.1, fontFace: GOTHIC, fontSize: 12, color: TEXT_DARK, margin: 0, lineSpacingMultiple: 1.4 });
  });
}

/* ============================================================
   SLIDE 5: Who（ターゲット）
   ============================================================ */
{
  const s = baseSlide(P, "FFFFFF");
  addPersistentHeader(s);
  addChapterTitle(s, "Who（target）");

  const personas = [
    { label: "カップル・夫婦", body: "同棲／新婚〜共働き\n週末の日帰りデート先を探している" },
    { label: "ファミリー層", body: "子どもと一緒に楽しめる\n近場の小旅行を探している" },
    { label: "ソロ／女子旅層", body: "グルメや写真映えを目的に\n気軽に出かけたい" },
  ];
  const cw = 3.9, gap = 0.3, startX = 0.5, cy = 1.7, ch = 3.0;
  personas.forEach((pn, i) => {
    const x = startX + i * (cw + gap);
    s.addShape("roundRect", { x, y: cy, w: cw, h: ch, rectRadius: 0.08, fill: { color: CARD_BG }, line: { color: LINE_GRAY, width: 1 } });
    s.addShape("ellipse", { x: x + cw / 2 - 0.35, y: cy + 0.35, w: 0.7, h: 0.7, fill: { color: RED }, line: { type: "none" } });
    s.addText(String(i + 1), { x: x + cw / 2 - 0.35, y: cy + 0.35, w: 0.7, h: 0.7, fontFace: GOTHIC, bold: true, fontSize: 18, color: "FFFFFF", align: "center", valign: "middle", margin: 0 });
    s.addText(pn.label, { x: x + 0.2, y: cy + 1.2, w: cw - 0.4, h: 0.4, fontFace: GOTHIC, bold: true, fontSize: 14, color: TEXT_DARK, align: "center", margin: 0 });
    s.addText(pn.body, { x: x + 0.25, y: cy + 1.65, w: cw - 0.5, h: 1.2, fontFace: GOTHIC, fontSize: 11, color: TEXT_GRAY, align: "center", margin: 0, lineSpacingMultiple: 1.3 });
  });

  s.addShape("rect", { x: 0.5, y: 5.1, w: 12.33, h: 0.7, fill: { color: NAVY }, line: { type: "none" } });
  s.addText("→ 三世代とも「東京・横浜から日帰りで行ける、ちゃんと非日常」という条件で三崎を検討している", {
    x: 0.5, y: 5.1, w: 12.33, h: 0.7, fontFace: GOTHIC, bold: true, fontSize: 13, color: "FFFFFF", align: "center", valign: "middle", margin: 0,
  });
}

/* ============================================================
   SLIDE 6: 市場分析
   ============================================================ */
{
  const s = baseSlide(P, "FFFFFF");
  addPersistentHeader(s);
  addChapterTitle(s, "市場分析");

  s.addText(
    "三崎方面は、東京・横浜から日帰りで行ける非日常として\n高いポテンシャルを持っています。\n\n一方で、まぐろ切符自体の認知は、東京・横浜の\n日帰り旅行層にまだ十分に浸透しきっていません。\n\n話題になれば、シルバーウィークという一過性の集中に\n頼らずとも売れる商品になり得ます。",
    { x: 1.3, y: 1.7, w: 10.7, h: 3.1, fontFace: GOTHIC, fontSize: 17, color: TEXT_DARK, align: "left", margin: 0, lineSpacingMultiple: 1.5 }
  );

  s.addShape("rect", { x: 1.3, y: 5.0, w: 6.5, h: 0.7, fill: { color: RED }, line: { type: "none" } });
  s.addText("ここに、商機があると考えます。", {
    x: 1.3, y: 5.0, w: 6.5, h: 0.7, fontFace: GOTHIC, bold: true, fontSize: 16, color: "FFFFFF", align: "center", valign: "middle", margin: 0,
  });
}

/* ============================================================
   SLIDE 7: RTB
   ============================================================ */
{
  const s = baseSlide(P, "FFFFFF");
  addPersistentHeader(s);
  addChapterTitle(s, "RTB (reason to believe)", { sub: "なぜ広告×インフルエンサーの組み合わせが、話題化を最大化するのか" });

  const cols = [
    { title: "Meta広告", color: NAVY, items: ["配信量をコントロールできる", "短期間で最大リーチを獲得できる", "訴求メッセージを完全に\nコントロールできる"] },
    { title: "インフルエンサー", color: RED, items: ["フォロワーとの信頼関係の中で\n自然に紹介してもらえる", "地域・カップルなど文脈に\n合わせた発信ができる"] },
  ];
  const cw = 5.6, gap = 0.53, startX = 0.9, cy = 1.75, ch = 3.0;
  cols.forEach((c, i) => {
    const x = startX + i * (cw + gap);
    s.addShape("ellipse", { x, y: cy, w: cw, h: ch, fill: { color: c.color, transparency: 88 }, line: { color: c.color, width: 1.5 } });
    s.addText(c.title, { x, y: cy + 0.35, w: cw, h: 0.45, fontFace: GOTHIC, bold: true, fontSize: 16, color: c.color, align: "center", margin: 0 });
    const bullets = c.items.map((t) => ({ text: t, options: { bullet: { code: "2022" }, breakLine: true, paraSpaceAfter: 10 } }));
    s.addText(bullets, { x: x + 0.8, y: cy + 0.95, w: cw - 1.6, h: 1.8, fontFace: GOTHIC, fontSize: 11.5, color: TEXT_DARK, align: "left", margin: 0, lineSpacingMultiple: 1.3 });
  });

  s.addShape("rect", { x: 1.9, y: 5.0, w: 9.53, h: 0.75, fill: { color: GOLD }, line: { type: "none" } });
  s.addText("広告の「物量」と、インフルエンサーの「信頼」を掛け合わせることで、最大の話題化を狙います。", {
    x: 1.9, y: 5.0, w: 9.53, h: 0.75, fontFace: GOTHIC, bold: true, fontSize: 13.5, color: "FFFFFF", align: "center", valign: "middle", margin: 0,
  });
}

/* ============================================================
   SLIDE 8: ユーザーとの接点整理
   ============================================================ */
{
  const s = baseSlide(P, "FFFFFF");
  addPersistentHeader(s);
  addChapterTitle(s, "ユーザーとの接点整理");

  const phases = ["認知", "興味", "検討", "購入", "共有"];
  const pw = 2.15, pgap = 0.2, px0 = 0.6, py = 1.7, ph = 0.6;
  phases.forEach((ph, i) => {
    const x = px0 + i * (pw + pgap);
    s.addShape("chevron", { x, y: py, w: pw, h: ph, fill: { color: i % 2 === 0 ? NAVY : RED }, line: { type: "none" } });
    s.addText(ph, { x, y: py, w: pw, h: ph, fontFace: GOTHIC, bold: true, fontSize: 14, color: "FFFFFF", align: "center", valign: "middle", margin: 0 });
  });

  s.addShape("rect", { x: 0.6, y: 2.55, w: 12.13, h: 0.32, fill: { color: "FFF3B0" }, line: { type: "none" } });
  s.addText("Meta広告、インフルエンサー投稿", {
    x: 0.6, y: 2.55, w: 12.13, h: 0.32, fontFace: GOTHIC, bold: true, fontSize: 10.5, color: TEXT_DARK, align: "center", valign: "middle", margin: 0,
  });

  const quotes = [
    { x: 0.6, w: 2.15, t: "「まぐろ切符って\n何？」" },
    { x: 3.0, w: 2.35, t: "「三崎、近いのに\n行ったことないかも」" },
    { x: 5.55, w: 2.35, t: "「いつ行こうかな、\n平日もいいかも」" },
    { x: 8.1, w: 2.35, t: "「行ってよかった、\n投稿しよう」" },
  ];
  quotes.forEach((q) => {
    s.addShape("roundRect", { x: q.x, y: 3.15, w: q.w, h: 0.95, rectRadius: 0.06, fill: { color: "F5A8A8" }, line: { type: "none" } });
    s.addText(q.t, { x: q.x + 0.1, y: 3.15, w: q.w - 0.2, h: 0.95, fontFace: GOTHIC, fontSize: 10.5, color: TEXT_DARK, align: "center", valign: "middle", margin: 0, lineSpacingMultiple: 1.2 });
  });

  s.addShape("rect", { x: 0.6, y: 4.5, w: 12.13, h: 0.65, fill: { color: NAVY }, line: { type: "none" } });
  s.addText("→「検討」フェーズで、一部のインフルエンサー投稿が「行くなら平日がおすすめ」という一言を自然に添える設計です。", {
    x: 0.6, y: 4.5, w: 12.13, h: 0.65, fontFace: GOTHIC, bold: true, fontSize: 12, color: "FFFFFF", align: "center", valign: "middle", margin: 0,
  });
}

/* ============================================================
   SLIDE 9: 施策プラン 中表紙
   ============================================================ */
{
  const s = baseSlide(P, PINKBEIGE);
  s.addText(DOC_LABEL + "    confidential", {
    x: 0.5, y: 0.22, w: 10, h: 0.25, fontFace: GOTHIC, fontSize: 8, color: "8A7267", margin: 0,
  });
  s.addText("施策プラン", {
    x: 0, y: 3.0, w: 13.33, h: 1.5, fontFace: SERIF, fontSize: 46, bold: true, color: TEXT_DARK, align: "center", valign: "middle", margin: 0,
  });
}

/* ============================================================
   SLIDE 10: 施策概要
   ============================================================ */
{
  const s = baseSlide(P, "FFFFFF");
  addPersistentHeader(s);
  addChapterTitle(s, "施策プラン");

  s.addText("One Catch, Many Days.", { x: 0, y: 1.35, w: 13.33, h: 0.55, fontFace: SERIF, bold: true, fontSize: 26, color: TEXT_DARK, align: "center", margin: 0 });
  s.addText("一本を、話題にする。", { x: 0, y: 1.9, w: 13.33, h: 0.4, fontFace: SERIF, fontSize: 15, color: TEXT_GRAY, align: "center", margin: 0 });

  const pillars = [
    { n: "柱1", title: "Meta広告（Instagram/Facebook）", color: NAVY, body: "短期間で最大リーチを獲得し、認知を一気に引き上げます。" },
    { n: "柱2", title: "インフルエンサー起用（4組）", color: RED, body: "信頼できる文脈の中で、みさきまぐろきっぷの魅力を伝えます。4組のうち2組には、投稿の中で「行くなら平日がおすすめ」という一言を、さりげなく添えていただきます。（分散は裏テーマのため、値引きや特典は設けません）" },
  ];
  const cw = 5.6, gap = 0.53, startX = 0.9, cy = 2.55, ch = 2.55;
  pillars.forEach((pl, i) => {
    const x = startX + i * (cw + gap);
    s.addShape("rect", { x, y: cy, w: cw, h: ch, fill: { color: CARD_BG }, line: { type: "none" } });
    s.addShape("rect", { x, y: cy, w: 0.9, h: 0.5, fill: { color: pl.color }, line: { type: "none" } });
    s.addText(pl.n, { x, y: cy, w: 0.9, h: 0.5, fontFace: GOTHIC, bold: true, fontSize: 13, color: "FFFFFF", align: "center", valign: "middle", margin: 0 });
    s.addText(pl.title, { x: x + 1.05, y: cy + 0.08, w: cw - 1.25, h: 0.4, fontFace: GOTHIC, bold: true, fontSize: 13, color: pl.color, valign: "middle", margin: 0 });
    s.addText(pl.body, { x: x + 0.25, y: cy + 0.65, w: cw - 0.5, h: ch - 0.85, fontFace: GOTHIC, fontSize: 10.5, color: TEXT_DARK, margin: 0, lineSpacingMultiple: 1.35 });
  });

  s.addShape("rect", { x: 0.9, y: 5.3, w: 11.53, h: 0.85, fill: { color: "EFEFEF" }, line: { type: "none" } });
  s.addText(
    "※SNS懸賞キャンペーンの景品費・PRクーポン原資は、今回の予算（¥3,000,000）には含めていません。話題化の純度を上げるため、広告とインフルエンサー起用の2本に予算を集中させる設計です。将来的に追加検討したい場合は別途ご提案します。",
    { x: 1.1, y: 5.3, w: 11.13, h: 0.85, fontFace: GOTHIC, fontSize: 9.5, color: TEXT_GRAY, align: "left", valign: "middle", margin: 0, lineSpacingMultiple: 1.3 }
  );
}

/* ============================================================
   SLIDE 11: インフルエンサー起用候補（参考）
   ============================================================ */
{
  const s = baseSlide(P, "FFFFFF");
  addPersistentHeader(s);
  addChapterTitle(s, "インフルエンサー起用候補（参考・京急様提供リストより）");

  const header = ["ランク", "アカウント", "フォロワー", "属性", "発信地域"];
  const data = [
    ["S", "旅んちゅLife", "IG 50.5万人＋TikTok 21.1万人", "旅行先紹介メディア", "全国"],
    ["A", "ひだまり", "IG 6.3万人", "カップル", "東京・関東"],
    ["A", "なるみ", "IG 7.3万人", "カップル", "東京・関東"],
    ["A", "ゆたはる", "IG 13.8万人", "カップル", "横浜発"],
    ["A", "ひとみん", "IG 5.6万人", "グルメ訴求", "東京・関東"],
    ["A", "みける", "IG 6.2万人", "カップル", "神奈川特化"],
  ];
  const rows = [header.map((h) => ({ text: h, options: { bold: true, color: "FFFFFF", fill: { color: NAVY }, fontSize: 11 } }))];
  data.forEach((r) => {
    rows.push(r.map((c, ci) => ({ text: c, options: { fontSize: 10.5, color: TEXT_DARK, fill: { color: ci === 0 && c === "S" ? "FBE7C6" : "FFFFFF" }, bold: ci === 0 } })));
  });
  s.addTable(rows, {
    x: 0.5, y: 1.55, w: 12.33, h: 4.5,
    fontFace: GOTHIC, border: { type: "solid", color: LINE_GRAY, pt: 0.75 },
    colW: [1.2, 2.6, 4.03, 2.5, 2.0], valign: "middle", autoPage: false,
  });

  s.addText("※評価基準・詳細スコアは別紙「01-influencer-list.md」参照", {
    x: 0.5, y: 6.2, w: 10, h: 0.3, fontFace: GOTHIC, fontSize: 9.5, color: TEXT_GRAY, margin: 0,
  });
}

/* ============================================================
   SLIDE 12: インフルエンサー起用イメージ（4組）
   ============================================================ */
{
  const s = baseSlide(P, "FFFFFF");
  addPersistentHeader(s);
  addChapterTitle(s, "インフルエンサー起用イメージ（4組・予算¥1,500,000内）");

  const four = [
    { rank: "S", name: "旅んちゅLife", role: "全国リーチで最大の話題化を狙う一次情報源", tag: false },
    { rank: "A", name: "ひだまり", role: "東京・関東のカップル層へのリーチ", tag: false },
    { rank: "A", name: "なるみ", role: "東京・関東のカップル層。投稿内で「行くなら平日がおすすめ」という一言を添える", tag: true },
    { rank: "A", name: "みける", role: "神奈川特化・京急沿線親和性トップ。投稿内で「行くなら平日がおすすめ」という一言を添える", tag: true },
  ];
  const cw = 5.9, gap = 0.35, startX = 0.5, cy = 1.5, ch = 1.55, rowGap = 0.2;
  four.forEach((f, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = startX + col * (cw + gap);
    const y = cy + row * (ch + rowGap);
    s.addShape("rect", { x, y, w: cw, h: ch, fill: { color: f.tag ? "FBEFE3" : CARD_BG }, line: { type: "none" } });
    s.addShape("ellipse", { x: x + 0.2, y: y + 0.2, w: 0.5, h: 0.5, fill: { color: f.rank === "S" ? GOLD : NAVY }, line: { type: "none" } });
    s.addText(f.rank, { x: x + 0.2, y: y + 0.2, w: 0.5, h: 0.5, fontFace: GOTHIC, bold: true, fontSize: 13, color: "FFFFFF", align: "center", valign: "middle", margin: 0 });
    s.addText(f.name, { x: x + 0.85, y: y + 0.15, w: cw - 1.05, h: 0.35, fontFace: GOTHIC, bold: true, fontSize: 13.5, color: TEXT_DARK, margin: 0 });
    s.addText(f.role, { x: x + 0.85, y: y + 0.5, w: cw - 1.05, h: 0.95, fontFace: GOTHIC, fontSize: 9.5, color: TEXT_DARK, margin: 0, lineSpacingMultiple: 1.25 });
    if (f.tag) {
      s.addShape("rect", { x: x + cw - 1.9, y: y + 0.15, w: 1.75, h: 0.3, fill: { color: GOLD }, line: { type: "none" } });
      s.addText("平日訴求も担当", { x: x + cw - 1.9, y: y + 0.15, w: 1.75, h: 0.3, fontFace: GOTHIC, bold: true, fontSize: 8.5, color: "FFFFFF", align: "center", valign: "middle", margin: 0 });
    }
  });

  s.addText(
    "→ 4組のうち2組（なるみ・みける）が、地域密着型のフォロワーに向けて自然な形で分散メッセージを届けます。値引き等は伴わない、あくまでコンテンツ内の一言としての訴求です。",
    { x: 0.5, y: 5.05, w: 12.33, h: 0.6, fontFace: GOTHIC, fontSize: 11, color: TEXT_DARK, margin: 0, lineSpacingMultiple: 1.3 }
  );
  s.addText("※実際の起用費用・組み合わせはキャスティング先へのご確認の上、最終調整をお願いします。", {
    x: 0.5, y: 5.75, w: 12.33, h: 0.3, fontFace: GOTHIC, fontSize: 9.5, color: TEXT_GRAY, margin: 0,
  });
}

/* ============================================================
   SLIDE 13: Meta広告 配信シミュレーション
   ============================================================ */
{
  const s = baseSlide(P, "FFFFFF");
  addPersistentHeader(s);
  addChapterTitle(s, "Meta広告（Instagram/Facebook）配信シミュレーション", {
    sub: "配信期間：シルバーウィーク前を中心に設定（8月下旬〜9月中旬を想定）",
  });

  const funnel = [
    { label: "広告費予算", value: "¥1,500,000" },
    { label: "想定インプレッション", value: "1,500,000" },
    { label: "クリック数（CTR 1.25%）", value: "18,750" },
    { label: "送客（LP CVR 8%）", value: "1,500人" },
  ];
  const fw = [3.35, 3.05, 2.75, 2.45];
  let fx = 0.5;
  funnel.forEach((f, i) => {
    const w = fw[i];
    s.addShape("chevron", { x: fx, y: 1.75, w, h: 1.0, fill: { color: [NAVY, "2E4165", "3E577F", RED][i] }, line: { type: "none" } });
    s.addText(f.value, { x: fx, y: 1.85, w, h: 0.45, fontFace: GOTHIC, bold: true, fontSize: 16, color: "FFFFFF", align: "center", margin: 0 });
    s.addText(f.label, { x: fx, y: 2.3, w, h: 0.4, fontFace: GOTHIC, fontSize: 9, color: "FFFFFF", align: "center", margin: 0 });
    fx += w - 0.35;
  });

  statTile(s, 0.5, 3.4, 3.9, 1.3, "¥1,000", "CPM（想定）", { valueSize: 24 });
  statTile(s, 4.55, 3.4, 3.9, 1.3, "1,500人", "コンバージョン数（送客）", { valueSize: 24 });
  statTile(s, 8.6, 3.4, 4.23, 1.3, "¥1,000", "CPA（広告単体）", { valueSize: 24, valueColor: RED });

  s.addText(
    "※CVRは「きっぷ購入ページ到達後の購入」を想定した仮置き数値です。実配信後、クリエイティブ・入札戦略の最適化により改善が見込めます。",
    { x: 0.5, y: 5.0, w: 12.33, h: 0.6, fontFace: GOTHIC, fontSize: 10, color: TEXT_GRAY, margin: 0, lineSpacingMultiple: 1.3 }
  );
}

/* ============================================================
   SLIDE 14: 送客シミュレーション
   ============================================================ */
{
  const s = baseSlide(P, "FFFFFF");
  addPersistentHeader(s);
  addChapterTitle(s, "送客3,000人の内訳シミュレーション");

  const header = ["ルート", "予算", "送客人数", "CAC"].map((h) => ({ text: h, options: { bold: true, color: "FFFFFF", fill: { color: NAVY }, fontSize: 12 } }));
  const rowsData = [
    ["① Meta広告", "¥1,500,000", "1,500人", "¥1,000"],
    ["② インフルエンサー経由", "¥1,500,000", "1,500人", "¥1,000"],
  ];
  const totalRow = ["合計", "¥3,000,000", "3,000人", "¥1,000（ブレンデッドCAC）"].map((c, ci) => ({
    text: c, options: { bold: true, fontSize: 12, color: TEXT_DARK, fill: { color: "FBE7C6" } },
  }));
  const rows = [header];
  rowsData.forEach((r) => rows.push(r.map((c) => ({ text: c, options: { fontSize: 11.5, color: TEXT_DARK } }))));
  rows.push(totalRow);
  s.addTable(rows, {
    x: 0.5, y: 1.55, w: 8.0, h: 2.0, fontFace: GOTHIC, border: { type: "solid", color: LINE_GRAY, pt: 0.75 },
    colW: [2.6, 1.9, 1.7, 1.8], valign: "middle", autoPage: false,
  });

  statTile(s, 8.85, 1.55, 3.98, 1.0, "¥11,250,000", "想定売上（¥3,750×3,000人）", { valueSize: 18 });
  statTile(s, 8.85, 2.65, 3.98, 0.9, "26.6%", "広告宣伝比率", { valueSize: 22, valueColor: RED });

  s.addText(
    "※②はインフルエンサーの投稿エンゲージメント・送客実績をもとにした仮置きの目安です。実施後のトラッキング（投稿別のUTM計測等）で精度を高めていきます。",
    { x: 0.5, y: 4.0, w: 12.33, h: 0.6, fontFace: GOTHIC, fontSize: 10, color: TEXT_GRAY, margin: 0, lineSpacingMultiple: 1.3 }
  );
}

/* ============================================================
   SLIDE 15: 予算サマリー
   ============================================================ */
{
  const s = baseSlide(P, "FFFFFF");
  addPersistentHeader(s);
  addChapterTitle(s, "予算サマリー（総額 ¥3,000,000）");

  s.addChart(
    "pie",
    [
      {
        name: "予算配分",
        labels: ["インフルエンサー起用費", "Meta広告配信費"],
        values: [1500000, 1500000],
      },
    ],
    {
      x: 0.5, y: 1.55, w: 5.6, h: 4.4,
      showTitle: false, showLegend: true, legendPos: "b", legendFontSize: 11, legendFontFace: GOTHIC,
      showValue: true, dataLabelFormatCode: "#,##0", dataLabelFontSize: 12, dataLabelColor: "FFFFFF",
      dataLabelPosition: "ctr", chartColors: [RED, NAVY],
      showPercent: true, dataLabelFormatScatter: "custom",
    }
  );

  statTile(s, 6.6, 1.6, 3.0, 1.05, "50.0%", "インフルエンサー起用費 ¥1,500,000", { valueSize: 22, valueColor: RED });
  statTile(s, 9.75, 1.6, 2.7, 1.05, "50.0%", "Meta広告配信費 ¥1,500,000", { valueSize: 22, valueColor: NAVY });

  s.addShape("rect", { x: 6.6, y: 2.95, w: 5.85, h: 1.1, fill: { color: CARD_BG }, line: { type: "none" } });
  s.addText(
    "CAC目標 ¥1,000／送客目標 3,000人\n想定売上 ¥11,250,000／広告宣伝比率 26.6%",
    { x: 6.85, y: 2.95, w: 5.35, h: 1.1, fontFace: GOTHIC, fontSize: 12, color: TEXT_DARK, valign: "middle", margin: 0, lineSpacingMultiple: 1.4 }
  );

  s.addText(
    "※SNS懸賞キャンペーンの景品費・PRクーポン原資は本予算には含めていません（将来的な追加検討事項）。",
    { x: 6.6, y: 4.3, w: 5.85, h: 0.6, fontFace: GOTHIC, fontSize: 9.5, color: TEXT_GRAY, margin: 0, lineSpacingMultiple: 1.3 }
  );
}

/* ============================================================
   SLIDE 16: スケジュール
   ============================================================ */
{
  const s = baseSlide(P, "FFFFFF");
  addPersistentHeader(s);
  addChapterTitle(s, "スケジュール");

  s.addShape("line", { x: 0.9, y: 2.9, w: 11.5, h: 0, line: { color: LINE_GRAY, width: 2 } });

  const milestones = [
    { x: 0.9, t: "8月上旬〜中旬", d: "インフルエンサー最終選定\n投稿企画すり合わせ\n（分散メッセージ担当2組を確認）" },
    { x: 3.75, t: "8月下旬", d: "Meta広告 配信開始\n（認知獲得フェーズ）" },
    { x: 6.5, t: "9月上旬〜中旬", d: "インフルエンサー投稿集中期間\nMeta広告（コンバージョン\n獲得フェーズへ切替）" },
    { x: 9.25, t: "9/19（土）〜9/23（水）", d: "シルバーウィーク本番" },
    { x: 11.5, t: "9月下旬", d: "キャンペーン結果集計\n効果測定" },
  ];
  milestones.forEach((m) => {
    s.addShape("ellipse", { x: m.x, y: 2.8, w: 0.2, h: 0.2, fill: { color: RED }, line: { color: "FFFFFF", width: 1.5 } });
  });
  const mw = [2.6, 2.6, 2.6, 2.1, 1.7];
  milestones.forEach((m, i) => {
    s.addText(m.t, { x: m.x - 0.5, y: 2.15, w: mw[i], h: 0.5, fontFace: GOTHIC, bold: true, fontSize: 10.5, color: NAVY, align: "left", margin: 0 });
    s.addText(m.d, { x: m.x - 0.5, y: 3.15, w: mw[i], h: 1.6, fontFace: GOTHIC, fontSize: 9.5, color: TEXT_DARK, align: "left", margin: 0, lineSpacingMultiple: 1.3 });
  });
}

/* ============================================================
   SLIDE 17: KPI・効果測定
   ============================================================ */
{
  const s = baseSlide(P, "FFFFFF");
  addPersistentHeader(s);
  addChapterTitle(s, "KPI・効果測定");

  const groups = [
    { title: "一次KPI", color: RED, items: ["送客数（きっぷ購入数） 3,000人", "CAC ¥1,000", "売上 ¥11,250,000"] },
    { title: "副次KPI", color: NAVY, items: ["Meta広告のインプレッション数・CTR・CVR", "インフルエンサー投稿のエンゲージメント率・送客数"] },
    { title: "参考指標（裏テーマの効果測定）", color: GOLD, items: ["シルバーウィーク期間中 vs 期間外の購入比率", "（分散メッセージを含む2組の投稿経由の購入動向を中心に確認）"] },
  ];
  let gy = 1.6;
  groups.forEach((g) => {
    s.addShape("rect", { x: 0.5, y: gy, w: 2.4, h: 0.95, fill: { color: g.color }, line: { type: "none" } });
    s.addText(g.title, { x: 0.5, y: gy, w: 2.4, h: 0.95, fontFace: GOTHIC, bold: true, fontSize: 12, color: "FFFFFF", align: "center", valign: "middle", margin: 0, lineSpacingMultiple: 1.1 });
    const bullets = g.items.map((t) => ({ text: t, options: { bullet: { code: "2022" }, breakLine: true, paraSpaceAfter: 6 } }));
    s.addText(bullets, { x: 3.1, y: gy, w: 9.7, h: 0.95, fontFace: GOTHIC, fontSize: 11.5, color: TEXT_DARK, valign: "middle", margin: 0, lineSpacingMultiple: 1.25 });
    gy += 1.2;
  });
}

/* ============================================================
   SLIDE 18: ネクストステップ
   ============================================================ */
{
  const s = baseSlide(P, "FFFFFF");
  addPersistentHeader(s);
  addChapterTitle(s, "ネクストステップ");

  const steps = [
    "インフルエンサー4組の最終確定（キャスティング費用の確認含む）",
    "分散メッセージを担当する2組の投稿内容すり合わせ",
    "Meta広告クリエイティブ・LPの制作着手",
  ];
  let sy = 1.7;
  steps.forEach((t, i) => {
    s.addShape("ellipse", { x: 0.6, y: sy, w: 0.45, h: 0.45, fill: { color: RED }, line: { type: "none" } });
    s.addText(String(i + 1), { x: 0.6, y: sy, w: 0.45, h: 0.45, fontFace: GOTHIC, bold: true, fontSize: 14, color: "FFFFFF", align: "center", valign: "middle", margin: 0 });
    s.addText(t, { x: 1.25, y: sy, w: 11, h: 0.45, fontFace: GOTHIC, fontSize: 13.5, color: TEXT_DARK, valign: "middle", margin: 0 });
    sy += 0.65;
  });

  s.addShape("rect", { x: 0.6, y: 4.1, w: 12.13, h: 1.5, fill: { color: CARD_BG }, line: { type: "none" } });
  s.addText(
    "※インフルエンサーのキャスティング費用は個別見積りのため別途確認\n※広告クリエイティブ制作費（バナー・LP等）は別途お見積り\n※SNS懸賞キャンペーン・PRクーポンを将来的に追加検討したい場合は別途ご提案可能です",
    { x: 0.9, y: 4.3, w: 11.5, h: 1.1, fontFace: GOTHIC, fontSize: 11, color: TEXT_GRAY, margin: 0, lineSpacingMultiple: 1.5 }
  );
}

/* ============================================================
   SLIDE 19: クロージング
   ============================================================ */
{
  const s = baseSlide(P, "FFFFFF");
  s.addText("FILE END", {
    x: 0, y: 3.3, w: 13.33, h: 0.9, fontFace: GOTHIC, bold: true, fontSize: 28, color: TEXT_DARK, align: "center", valign: "middle", margin: 0, charSpacing: 4,
  });
}

const OUT = "/home/user/claude/clients/keikyu/misaki-maguro-ticket-promo/misaki-maguro-sw-promotion_v1.pptx";
P.writeFile({ fileName: OUT }).then(() => {
  console.log("wrote", OUT);
});
