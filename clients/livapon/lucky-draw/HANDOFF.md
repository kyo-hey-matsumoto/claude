# Japan Festival 福引アプリ(campaign: ca26) 実装引き継ぎメモ

- 文書ID: RAFFLE-002(RAFFLE-001設計書の付随文書)
- 作成日: 2026-07-21
- 作成: エージェンシー側(claude_us)でのTDD実装セッション
- ステータス: 実装完了・ローカル動作確認済み・**未push**
- 関連正本:
  - 設計書 [`2026-07-21-japan-festival-raffle-design.md`](./2026-07-21-japan-festival-raffle-design.md)
  - 実装計画 [`../plans/2026-07-21-japan-festival-raffle.md`](../plans/2026-07-21-japan-festival-raffle.md)

## 1. 現状

ブランチ `KM-claude/japan-festival-raffle-app-a687a2` に、実装計画の Task 1〜19 を全てコミット済み(このマシンのローカルのみ、**リモート未push**)。差分は32ファイル・+1761/-134行。

```bash
git log --oneline d1ea6d5..HEAD
```

で確認できる20コミット(先頭2つは設計書・計画書の追加、以降がTask 1〜19の実装コミット)。

**push方法:** このマシンの `gh auth` が `FUFU222/LIVAPON_platform` への書き込み権限を持つアカウントでログインしていることを確認のうえ、

```bash
git push -u origin KM-claude/japan-festival-raffle-app-a687a2
```

## 2. 実装済み範囲

設計書(RAFFLE-001)の §2〜§8 に対応する形で実装。

| レイヤー | 内容 |
|---|---|
| `packages/domain` | `RAFFLE_CAMPAIGNS`(`ca26` 固定)、`formatRaffleSerialNumber`、`getRaffleWindowStatus`。単体テスト9件 |
| `packages/db` | `RaffleCounter` / `RaffleEntry` モデル追加。マイグレーション `20260721040000_add_raffle_entries` |
| `apps/api` | `RaffleController`(`POST/GET/PATCH /raffle/:campaignCode/entries[/:token]`)、`RaffleService`(採番・冪等性・期間外拒否・Shopify同期呼び出し)、`ConsoleRaffleMailer`(スタブ)、`ShopifyAdminClient.upsertRaffleCustomer`、`RaffleShopifySyncService`(ベストエフォート)、運営用 `GET /operator/raffle/:campaignCode/entries[.csv]` |
| `apps/web` | `/raffle/ca26`(応募フォーム、期間外はカウントダウン/締切表示)、`/raffle/ca26/entry/[token]`(番号確認+プロフィール補完)、`/operator/raffle/ca26`(運営一覧+CSV DL)、ショップ用ヘッダーを出さない専用レイアウト分岐(`middleware.ts` → `x-livapon-pathname` ヘッダー転送 → `layout.tsx`) |

## 3. 検証結果

- `npm run typecheck` / `npm run test` / `npm run build`(4パッケージ全て)— 全てクリーン
  - `apps/api`: 34ファイル / 153テスト
  - `apps/web`: 9ファイル / 63テスト
  - `packages/domain`: 9ファイル / 57テスト
- ローカルDocker上のPostgresに対して `prisma migrate deploy` を実行し、手書きしたマイグレーションSQLが実際に問題なく適用されることを確認
- `RAFFLE_PREVIEW_FORCE_OPEN=true` でAPI(4000)・Web(3100)を起動し、応募 → 通し番号発行(`ca26-000001`)→ 確認画面表示までE2Eで実機確認

## 4. 未実装・要対応(優先度高)

### 4.1 レート制限が未実装 【要対応】

設計書 §5「レート制限」は、応募エンドポイントに対して既存の `createFixedWindowRateLimiter`(`apps/web/lib/auth/rate-limiter.ts`)と同じ仕組みをIPキーで適用する、と明記されているが、**実装計画(plan.md)のTask一覧にこの項目が抜けており、今回のTask 1〜19では実装していない**。現状 `/raffle/ca26` の Server Action(`apps/web/app/raffle/[campaign]/page.tsx` の `join`)にはレート制限がかかっておらず、連打による大量応募・採番の枯渇が可能な状態。本番投入前に必ず対応が必要。

### 4.2 その他、設計書で明示的にスコープ外とされている項目(意図的な未実装)

- 当日の抽選(当選判定)ロジック本体 — 外部で別設計
- 実メール配信プロバイダの導入 — `ConsoleRaffleMailer` はconsole.logスタブのみ
- プライバシーポリシーページ本体(issue #34側の作業) — 同意文言はフォーム内直書き、リンクなし
- 複数キャンペーンを横断管理する運営UI — `ca26` 固定。ドメイン層・DBはキャンペーン単位でパラメータ化済みだが、管理画面は未整備

## 5. 申し送り事項

- **DBマイグレーションは手書き**: 実装時点でこのマシンにDocker/Postgresが未導入だったため、`prisma migrate dev` を実行できず、`packages/db/prisma/migrations/20260721040000_add_raffle_entries/migration.sql` は手書き(追加テーブル2つのみ・既存テーブルとのFK関係なしの安全な変更)。その後Docker導入後に実際のPostgresへ `prisma migrate deploy` して適用成功を確認済みだが、念のためレビュー時に一度目を通すことを推奨
- **本番未設定の環境変数**: `SHOPIFY_ADMIN_API_CLIENT_ID` / `SHOPIFY_ADMIN_API_CLIENT_SECRET` / `SHOPIFY_STORE_DOMAIN` / `APP_BASE_URL` は本番・ステージング値が未設定。未設定時は `dev-*` のフォールバック値で動作し、Shopify同期は失敗するが(ベストエフォート設計のため)応募自体は成立する。確認メールのリンクも `APP_BASE_URL` 未設定だと `http://localhost:3100` を指してしまう
- **`RAFFLE_PREVIEW_FORCE_OPEN=true`** は開発プレビュー専用。`EnvService.isProduction()` チェックで本番では無効化される安全策があるが、本番環境変数には設定しないこと
- **コントローラのHTTP統合テスト**: `RaffleController` の e2e ワイヤリングテスト(Task 10)は `POST /raffle/:campaignCode/entries` のみカバー。`GET`/`PATCH` はサービス層(`RaffleService`)の単体テストでロジックはカバー済みだが、HTTP経由の統合テストは未追加
- **運営CSV/一覧のロールガード**: 既存 `OperatorController` のクラスレベル `@UseGuards(AuthGuard, RolesGuard) @Roles("OPERATOR","ADMIN")` を再利用しているのみで、raffle用エンドポイント個別のガードテストは追加していない
- **ローカルDBにテストデータが残存**: 動作確認時のスモークテストで `preview-smoke-test@example.com`(`ca26-000001`)がローカルPostgresに1件登録された状態。ローカル環境限定のため本番には影響しないが、開発環境を共有する場合は認識しておくこと

## 6. 検証コマンド(再現用)

```bash
npm run typecheck && npm run test && npm run build

docker compose up -d db
DATABASE_URL="postgresql://livapon:livapon@localhost:55432/livapon?schema=public" \
  npm run db:migrate -w packages/db -- deploy

DATABASE_URL="postgresql://livapon:livapon@localhost:55432/livapon?schema=public" \
SHOPIFY_WEBHOOK_SECRET="dev-shopify-webhook-secret" \
JWT_SECRET="dev-jwt-secret-change-me" \
RAFFLE_PREVIEW_FORCE_OPEN="true" \
PORT=4000 \
npm run start -w apps/api &

INTERNAL_API_BASE_URL="http://localhost:4000" \
NEXT_PUBLIC_API_BASE_URL="http://localhost:4000" \
RAFFLE_PREVIEW_FORCE_OPEN="true" \
npm run dev -w apps/web
# → http://localhost:3000/raffle/ca26
```
