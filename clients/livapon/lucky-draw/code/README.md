# code/ — 実装コードのスナップショット

`LIVAPON_platform` リポジトリ(ブランチ `KM-claude/japan-festival-raffle-app-a687a2`)上で
Task 1-19まで実装した内容から、福引機能に関連する変更ファイルのみを抜き出したスナップショットです。

**注意:** `LIVAPON_platform` モノレポの一部ファイルの抜粋です。`package.json` や
`tsconfig.json`、他の既存モジュール等の周辺ファイルを含まないため、この場所単体では
`npm install` / 起動はできません。参照・バックアップ目的のコードフラグメント集です。

設計書・実装計画・引き継ぎメモは一つ上の階層(`design.md` / `plan.md` / `HANDOFF.md`)を参照してください。

## 含まれるファイル

- `apps/api/src/raffle/` — 応募API(RaffleController, RaffleService, DTO, メーラー)
- `apps/api/src/operator/raffle-csv.ts` — 運営向けCSVエクスポート
- `apps/api/src/shopify/` — Shopify顧客連携の拡張(admin-client.ts は既存ファイルへの追記)
- `apps/web/app/raffle/` — 応募フォーム・確認画面
- `apps/web/app/operator/raffle/` — 運営向けページ
- `apps/web/lib/`, `apps/web/components/` — 補助ロジック・コンポーネント
- `apps/web/middleware.ts`, `apps/web/app/layout.tsx` 等 — 既存ファイルへの変更(福引ページ用のレイアウト分岐)
- `packages/domain/` — 通し番号フォーマット・応募期間判定などの純粋ロジック
- `packages/db/prisma/` — Prismaスキーマ差分・マイグレーション
