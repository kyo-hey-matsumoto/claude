# claude

kyo-hey-matsumoto の業務ナレッジ蓄積 & Claude Code 作業リポジトリ。

マーケティング、事業計画、PR戦略、ブランディング戦略、広告戦略、UI/UX設計、Webデザインなど、多岐にわたる業務のノウハウを業務カテゴリごとのフォルダに整理し、各フォルダに `CLAUDE.md`（Claude Codeへの指示・ナレッジ）と `.claude/skills/`（業務特化のスキル）を蓄積していく。

## フォルダ構成

```
claude/
├── CLAUDE.md                 # リポジトリ全体の方針・ナビゲーション
├── README.md                 # このファイル
├── marketing/                # マーケティング
├── business-planning/        # 事業計画
├── pr-strategy/               # PR戦略
├── branding-strategy/        # ブランディング戦略
├── advertising-strategy/     # 広告戦略
├── ui-ux-design/              # UI/UX設計
└── web-design/                # Webデザイン
```

各業務カテゴリフォルダには、そのカテゴリ専用の `CLAUDE.md` を配置する。Claude Codeはそのフォルダで作業する際、ルートの `CLAUDE.md` に加えてカテゴリの `CLAUDE.md` も読み込むため、業務ごとに異なる前提知識・振る舞いを持たせられる。

詳細な運用ルールは [CLAUDE.md](./CLAUDE.md) を参照。
