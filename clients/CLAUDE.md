# クライアント／プロジェクト運用ルール

このフォルダは実際の案件（クライアントワーク）を管理する場所。ルート直下のドメインフォルダ（`marketing/`, `branding-strategy/`, `business-planning/`, `pr-strategy/`, `advertising-strategy/`, `ui-ux-design/`, `web-design/`）は業務ドメインごとの汎用ノウハウ・エージェントであり、特定のクライアントやプロジェクトに紐づかない。実際の案件作業はすべてこの `clients/` 配下で行う。

## フォルダ階層

```
clients/<client-slug>/                # クライアント単位
├── CLAUDE.md                         # そのクライアント固有の背景・トーン・過去の意思決定
└── <project-slug>/                   # プロジェクト単位
    ├── CLAUDE.md                     # このプロジェクトで使うドメインの @import + プロジェクト概要
    ├── .claude/skills/                # 関連ドメインのskillsをsymlinkで集約
    └── <initiative-slug>/             # 施策単位（必要な時だけ作成。省略可）
        └── ...成果物
```

命名は英語kebab-caseを基本とする（例: `plus-corp`, `brand-renewal-2026`）。読みやすさ優先で日本語ローマ字でもよい。

サンプルは `clients/_example/sample-project/` を参照（実在のクライアントではないテンプレート）。

## なぜこの構成か

Claude CodeはCLAUDE.mdと`.claude/skills/`を、作業ディレクトリから見て**親方向にのみ**自動で読み込む。兄弟ディレクトリ（例: `clients/`から見た`marketing/`）は自動では読み込まれない。そのため、プロジェクトが複数ドメインを横断する場合は、プロジェクトのCLAUDE.mdで明示的に`@`構文を使ってドメインのCLAUDE.mdをインポートし、`.claude/skills/`にはシンボリックリンクでドメインのスキルを集約する。

## 新しいクライアント／プロジェクトを作るときの手順（Claude Codeが実行する）

1. `clients/<client-slug>/` が無ければ作成し、`clients/<client-slug>/CLAUDE.md` を作る。会社概要・業界・トーン&マナー・関係者・過去の意思決定などをヒアリングして記述する（分かっている範囲でよく、無理に埋めない）
2. `clients/<client-slug>/<project-slug>/` を作成する
3. このプロジェクトで使う業務ドメインをユーザーに確認する（例: マーケティング＋ブランディング＋UI/UX、など）
4. `clients/<client-slug>/<project-slug>/CLAUDE.md` を作成し、冒頭で選んだドメインを以下の形式でインポートする（ファイルの先頭に書く）:
   ```
   @../../../marketing/CLAUDE.md
   @../../../ui-ux-design/CLAUDE.md
   ```
   続けてプロジェクト概要（目的・ゴール・スコープ・スケジュール感）を書く
5. `clients/<client-slug>/<project-slug>/.claude/skills/` を作成し、選んだドメインの `.claude/skills/` 配下にあるスキルごとにシンボリックリンクを張る:
   ```
   ln -s ../../../../../<domain>/.claude/skills/<skill-name> \
     clients/<client-slug>/<project-slug>/.claude/skills/<skill-name>
   ```
6. 施策単位で分けたい場合のみ `<initiative-slug>/` フォルダを作る。CLAUDE.md・skillsはプロジェクト階層から自動的に継承されるので、施策フォルダに新規に置く必要はない
7. 新しいドメインを後からプロジェクトに追加したくなった場合は、手順4・5を追加分だけ繰り返す

## 注意

- ドメインフォルダ本体（`marketing/CLAUDE.md` など）は、特定案件の固有情報で汚さない。案件固有の内容は必ず `clients/` 配下に書く
- 案件を通じて得られた「この業界／このタイプの案件では毎回こうする」という**再利用可能な汎用ノウハウ**は、案件終了後にドメインフォルダ側へ還元する（`clients/` → `marketing/` などへの逆輸入）
