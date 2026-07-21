@../../../web-design/CLAUDE.md

# lucky-draw（Japan Festival 福引アプリ）

## プロジェクト概要

- クライアント: LIVAPON
- 使用ドメイン: Webデザイン
- 目的: LIVAPON の Japan Festival（カナダ開催、2026年8月）会場での福引応募を、応募フォーム／
  自分の番号確認画面のシンプルな2画面で受け付ける。当日の抽選ロジック自体は本プロジェクトの
  スコープ外（外部で別設計）
- スコープ: 応募フォーム（メール必須・任意プロフィール項目）、通し番号発行（`ca26-000001`形式、
  国別に接頭辞を切替できる設計）、確認・再確認画面（メール記載のマジックリンク）、Shopify顧客
  登録連携（メルマガ活用目的）、運営向けCSVエクスポート
- スケジュール前提: 応募受付 2026-08-01 00:00 〜 2026-08-15 18:00（カナダ東部時間）
- 開発体制: 実装本体（Next.js + NestJS + Prisma、Shopify連携）は `LIVAPON_platform` リポジトリ側
  （ブランチ `KM-claude/japan-festival-raffle-app-a687a2`）で進行中。このフォルダは設計書・実装
  計画の控えを保管する場所

## 成果物（控え）

- [`design.md`](./design.md) — 設計書（要件確定事項、データモデル、API、Web画面、UIコピー）
- [`plan.md`](./plan.md) — 実装計画（タスク分解・TDDステップ）
- [`HANDOFF.md`](./HANDOFF.md) — 実装引き継ぎメモ（未実装項目・意図的なスコープ外・申し送り事項）
- [`code/`](./code/) — Task 1-19実装分のうち福引機能に関連する変更ファイルのみのスナップショット
  （モノレポの一部抜粋のためこの場所単体では起動不可。詳細は [`code/README.md`](./code/README.md)）

正本は `LIVAPON_platform` リポジトリの
`docs/superpowers/specs/2026-07-21-japan-festival-raffle-design.md`、
`docs/superpowers/plans/2026-07-21-japan-festival-raffle.md` および
`docs/superpowers/specs/2026-07-21-japan-festival-raffle-handoff.md`。このフォルダの3ファイルは
2026-07-21時点のスナップショット控え。
