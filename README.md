# claude

kyo-hey-matsumoto の業務ナレッジ蓄積 & Claude Code 作業リポジトリ。

マーケティング、事業計画、PR戦略、ブランディング戦略、広告戦略、UI/UX設計、Webデザインなど、多岐にわたる業務のノウハウを業務カテゴリごとのフォルダに整理し、各フォルダに `CLAUDE.md`（Claude Codeへの指示・ナレッジ）と `.claude/skills/`（業務特化のスキル）を蓄積していく。

## フォルダ構成

```
claude/
├── CLAUDE.md                 # リポジトリ全体の方針・ナビゲーション
├── README.md                 # このファイル
├── marketing/                # マーケティング（業務ドメイン、汎用ノウハウ）
├── business-planning/        # 事業計画
├── pr-strategy/               # PR戦略
├── branding-strategy/        # ブランディング戦略
├── advertising-strategy/     # 広告戦略
├── ui-ux-design/              # UI/UX設計
├── web-design/                # Webデザイン
└── clients/                   # 実際のクライアントワーク
    └── <client>/<project>/    # 案件ごとに複数ドメインを合成して使う
```

業務ドメインフォルダ（`marketing/` など）は汎用ノウハウ・スキルを蓄積する場所で、特定の案件には紐づかない。各フォルダ直下には専用の `CLAUDE.md` を配置し、Claude Codeはそのフォルダで作業する際にルートの `CLAUDE.md` に加えてこれも読み込む。

実際のクライアントワークは `clients/<client>/<project>/` で行い、必要なドメインのノウハウ・スキルを `@import` とシンボリックリンクで合成する。詳細は [clients/CLAUDE.md](./clients/CLAUDE.md) を参照。

詳細な運用ルールは [CLAUDE.md](./CLAUDE.md) を参照。
