---
name: mobile-wireframe-builder
description: >
  Build high-fidelity mobile wireframes as interactive HTML files AND export them
  directly to Figma. Use this skill whenever the user asks to wireframe, mock up,
  or prototype a mobile screen, app page, or UI flow — including e-commerce sites,
  membership pages, dashboards, mypage screens, product listings, or any
  smartphone-first interface. Also trigger when the user wants to "export to Figma",
  "send wireframes to Figma", or "create a Figma frame". Even if the user just says
  "show me what the page would look like on mobile", use this skill.
---

# Mobile Wireframe Builder

A skill for producing **polished, smartphone-first wireframes** as:
1. **Interactive HTML files** — downloadable, browser-viewable, with state toggles
2. **Figma frames** — written directly into the user's Figma file via the Plugin API

This skill encodes hard-won conventions from building real product wireframes.
Read the whole file before starting any wireframe task.

---

## Core Philosophy

Wireframes here are NOT rough boxes-and-labels sketches. They are:
- **Layout-accurate** — correct spacing, type scale, component sizing
- **Tonally aligned** — color palette and font weight match the brand reference
- **Interaction-aware** — state variants (LIVE/not-LIVE, connected/unconnected, tab-on/off) are built in
- **Annotation-rich** — every non-obvious design decision has a brief comment

The goal: hand the HTML or Figma frame to a developer and they could build from it.

---

## Step 0 — Gather Context Before Writing a Line

Always collect these inputs before producing output:

| Input | How to get it |
|---|---|
| **Brand reference** (colors, fonts, existing screens) | Ask for Figma URL or screenshots |
| **Existing page screenshots** | Ask user to upload; use `view` tool to read them |
| **Real content** (product names, categories, copy) | Extract from screenshots or uploaded data |
| **Platform** | Confirm mobile-first (375px default) vs desktop |
| **Figma file key** | Ask if Figma export is needed |

If a Figma URL is provided, call `Figma:get_design_context` on the top-level frame
to extract the actual color values, font families, and font weights in use.
Never guess brand colors — always read them from the source.

---

## Step 1 — Design System Extraction

When given a Figma reference file, extract:

```
Background:  #______   (primary surface)
Text:        #______   (primary text)
Text sub:    #______   (secondary/hint text)
Border:      #______   (dividers, card outlines)
Accent:      #______   (CTA, active states)
Dark:        #______   (dark sections, footer)

Font family: ______    (heading)
Font family: ______    (body)
Font weights: Light / Regular / Medium / Bold
```

Store these as CSS custom properties or JS constants before writing any component.
See `references/design-tokens.md` for the token set used in the LIVAPON reference project.

---

## Step 2 — Content Audit

Before building, list every section that will appear in the wireframe:

```
① Section name — purpose in 1 sentence
② Section name — purpose
...
```

For **e-commerce top pages**, the standard section order is:
1. Status bar + Nav (dark bg)
2. KV / Hero — FV should be ≥80% of viewport, brand message first
3. Live/notification bar — directly below KV (state-aware)
4. Tag search — free-form exploration entry point
5. Category list — structured navigation entry point
6. Featured products (tabbed: Best Sellers / New / Live Soon)
7. Brand histories / editorial
8. Archival/event sections
9. Footer

For **membership/mypage screens**, the standard section order is:
1. Status bar + Nav
2. Member header — name, badge, meta stats (joined / renewal / orders)
3. Engagement hook — WhatsApp/LINE connect with offer (between header and nav)
4. Quick nav grid (2×2) — top 4 actions, premium ones use dark cards
5. Members-only products
6. Activities & Tours
7. Live schedule
8. Order history
9. Member benefits (always visible — retention tool)
10. Account settings

---

## Step 3 — HTML Wireframe Construction

### File structure

```html
<!DOCTYPE html>
<html><head>
<style>/* All styles inline, no external deps */</style>
</head><body>

<!-- Preview controls (state toggles) -->
<div class="controls">...</div>

<!-- Phone frame -->
<div class="phone">
  <!-- sections in order -->
</div>

<!-- Annotation sidebar -->
<div class="sidebar">...</div>

<script>/* Tab switching, state toggles */</script>
</body></html>
```

### Phone frame spec

```css
.phone {
  width: 375px;
  border-radius: 40px;
  overflow: hidden;
  box-shadow: 0 8px 40px rgba(0,0,0,.18);
}
```

### Typography scale

| Role | Size | Weight |
|---|---|---|
| Section XL label (background) | 28–32px | 200 (ExtraLight) |
| Section eyebrow | 8px | 300, letter-spacing .18em |
| Product name | 11–13px | 300–400 |
| Price | 11px | 400 |
| Tag/badge | 7–9px | 400–500 |
| Body / description | 10–11px | 300 |

### Color placeholder convention

When real images are not available, use **muted tonal swatches** not grey boxes:
```css
/* Ceramics / warm beige */   background: #c8c0b8
/* Food / sage green */        background: #b8c4b4
/* Beauty / dusty pink */      background: #d0c4cc
/* Textiles / warm tan */      background: #c4bcac
/* Art / blue-grey */          background: #b8bcc8
/* Dark product (luminous) */  background: #1a1a1a
/* KV / craft dark */          background: #2a2826
```

### Interactive states

Always build **at least these states** with toggle buttons above the phone:
- Tab switching (New / Ranking, Best Sellers / New Arrivals / Live Soon)
- LIVE bar: `● LIVE中` ↔ `次回予定`
- WhatsApp/LINE: `未接続` ↔ `接続済み`

State implementation pattern:
```css
.state-live .show-live   { display: block }
.state-live .show-next   { display: none  }
.state-next .show-live   { display: none  }
.state-next .show-next   { display: block }
```

### Special components

**LIVE bar (below KV)**
- LIVE中: dark bg, red ● badge, title, viewer count, thumbnail placeholder
- 次回予定: compact bar, next LIVE title + datetime, link to schedule page
- No "NEXT LIVE" strip in the LIVE中 state

**Tag pills**
```css
.tag    { border: 0.5px solid #d4d4d4; border-radius: 20px; padding: 4px 11px; font-size: 10px }
.tag-on { border-color: #1a1a1a; font-weight: 500 }
```

**Ranking badges**
```css
.rank-1 { background: #b8960c } /* gold   */
.rank-2 { background: #787878 } /* silver */
.rank-3 { background: #8c5c2c } /* bronze */
.rank-4 { background: #2a2a2a } /* dark   */
/* Position: absolute, top:8px left:8px, border-radius:50%, 22×22px */
```

**Archive cards (LIVE archive)**
Each card contains: thumbnail placeholder + date + title + viewer count + 3-product strip + "このLIVEの商品を見る →" link

**WhatsApp/LINE connect banner**
- Unconnected: dark green bg, 3 offer bullets (first = 20% OFF tour), CTA button
- Connected: compact status bar with "CONNECTED" badge

---

## Step 4 — Figma Export

### Helpers (copy these into every `Figma:use_figma` call)

```javascript
async function loadFonts() {
  await figma.loadFontAsync({family:'Roboto', style:'Regular'});
  await figma.loadFontAsync({family:'Roboto', style:'Light'});
  await figma.loadFontAsync({family:'Roboto', style:'Medium'});
  await figma.loadFontAsync({family:'Roboto', style:'Bold'});
}

function txt(parent, content, x, y, w, fs, color, weight) {
  weight = weight || 'Regular';
  const t = figma.createText();
  t.x = x; t.y = y;
  if (w > 0) { t.textAutoResize = 'HEIGHT'; t.resize(w, 20); }
  else t.textAutoResize = 'WIDTH_AND_HEIGHT';
  t.characters = content; t.fontSize = fs;
  t.fills = [{type:'SOLID', color}];
  try {
    if (weight === 'Light')  t.fontName = {family:'Roboto', style:'Light'};
    else if (weight === 'Medium') t.fontName = {family:'Roboto', style:'Medium'};
    else if (weight === 'Bold')   t.fontName = {family:'Roboto', style:'Bold'};
    else t.fontName = {family:'Roboto', style:'Regular'};
  } catch(e) {}
  parent.appendChild(t); return t;
}

function ph(parent, x, y, w, h, color) {
  const r = figma.createRectangle();
  r.x = x; r.y = y; r.resize(w, h);
  r.fills = [{type:'SOLID', color}];
  parent.appendChild(r); return r;
}

function sec(parent, name, x, y, w, h, bg) {
  const f = figma.createFrame();
  f.name = name; f.x = x; f.y = y; f.resize(w, h);
  f.fills = [{type:'SOLID', color: bg}];
  parent.appendChild(f); return f;
}

function divL(parent, x, y, w, alpha) {
  const l = figma.createLine();
  l.x = x; l.y = y; l.resize(w, 0);
  l.strokes = [{type:'SOLID', color:{r:0,g:0,b:0}, opacity: alpha || 0.08}];
  l.strokeWeight = 0.5;
  parent.appendChild(l);
}
```

### Export strategy

Split into **3–4 `Figma:use_figma` calls** to avoid token limits:
- Phase 1: Create main frame + StatusBar + Nav + KV (+ member header if mypage)
- Phase 2: Engagement zone + Quick nav + first product section
- Phase 3: Remaining product/content sections
- Phase 4: Footer + resize frame + annotation notes

**Frame placement convention**:
- First wireframe: `x: 4600, y: 274` (right of existing TOP_PC)
- Second wireframe (e.g., mypage): `x: 4600, y: 3800`
- Subsequent: increment Y by the previous frame's total height + 200

**Frame naming convention**: `LIVAPON_{PAGE}_{DEVICE}_v{N}`
e.g., `LIVAPON_TOP_SP_v4.3`, `LIVAPON_MYPAGE_SP_v3`

**State variants** that can't be toggled in Figma:
Add a sibling frame with a `[NOTE]` annotation:
```javascript
const note = figma.createFrame();
note.name = '[NOTE] 状態切替ロジック';
note.x = frame.x + frame.width + 20;
note.fills = [{type:'SOLID', color:{r:1,g:1,b:0.878}}];
note.cornerRadius = 4;
```

### Color conversion (CSS hex → Figma RGB 0-1)

```javascript
// #c8c0b8 → {r:0.784, g:0.753, b:0.722}
// Divide each hex pair by 255
function hexToFigma(hex) {
  const r = parseInt(hex.slice(1,3),16)/255;
  const g = parseInt(hex.slice(3,5),16)/255;
  const b = parseInt(hex.slice(5,7),16)/255;
  return {r, g, b};
}
```

---

## Step 5 — Annotation Sidebar

Every HTML output includes a sidebar documenting:
- Section purpose in 1 sentence
- Key design decisions and their rationale
- State logic
- Diff from previous version (✦ 更新 marker)
- Reference sources (e.g., `ref: Etsy top`, `ref: BEAMS Japan editorial`)

---

## Common Patterns & Rules

### DO
- Extract real category names from product screenshots before inventing them
- Use 2-state (LIVE中 / 次回予定) for live bars — never 3 states
- Put WhatsApp/LINE connect between member header and quick nav (not at the bottom)
- Include MEMBERS ONLY tags on premium content cards (dark background)
- Show ranking badges (gold/silver/bronze) in Best Sellers grids
- Archive LIVE content shows: date + title + viewer count + 3-product thumbnails
- Keep tag pills wrappable (flex-wrap) with `.18em` letter-spacing

### DON'T
- Don't add "NEXT LIVE" strip inside the LIVE中 state of the live bar
- Don't use grey boxes (`background: #e0e0e0`) for image placeholders — use tonal colors
- Don't embed base64 images via `<img src="">` — encoding issues cause broken display
- Don't put WhatsApp/LINE connect at the bottom of the page
- Don't put Category before Featured Products on top pages (Category comes after)
- Don't use `localStorage` or `sessionStorage` in HTML wireframes
- Don't stack multiple `Figma:use_figma` calls back-to-back with >40KB of code each

### Iteration versioning
- HTML files: `{project}_{page}_v{N}.html` (e.g., `livapon_top_v4_3.html`)
- Figma frames: append version to frame name, place below previous version

---

## Output Checklist

Before delivering any wireframe, verify:

- [ ] Font weights match brand reference (not all Regular)
- [ ] Color swatches are tonal (not flat grey)
- [ ] State toggle buttons work (LIVE, WhatsApp, tabs)
- [ ] Figma frame height matches actual content (call `frame.resize(375, Y)` at end)
- [ ] Annotation sidebar documents every section
- [ ] File saved to `/mnt/user-data/outputs/` and presented with `present_files`
- [ ] Figma export: annotation note added for non-toggleable states

---

## Reference Files

- `references/design-tokens.md` — LIVAPON color palette and type scale (full token set)
- `references/section-patterns.md` — Copy-paste HTML patterns for common sections
- `references/figma-color-map.md` — Hex → Figma RGB lookup for all brand colors
