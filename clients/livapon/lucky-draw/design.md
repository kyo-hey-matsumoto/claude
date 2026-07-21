# Japan Festival 福引アプリ 設計書（campaign: ca26）

- 文書ID: RAFFLE-001
- 作成日: 2026-07-21
- ステータス: 設計合意済み（ブレスト確定）→ 実装計画へ
- 関連: LIVAPON Japan Festival（カナダ開催、2026-08）。抽選（当選判定）自体は本設計のスコープ外（外部で別設計）

## 1. 目的

Japan Festival 会場での福引応募を、シンプルな2画面（応募フォーム／自分の番号確認画面）で
受け付ける。応募者にはキャンペーン接頭辞つきの通し番号（`ca26-000001`）を発行し、
メールアドレスは必須・その他プロフィール項目は任意とする。取得した情報は LIVAPON の
Shopify 顧客レコードとしても登録し、同意があればメルマガ配信に利用する。当選抽選ロジック
そのものは対象外——本アプリの成果物は「応募者リストと通し番号を外部抽選システムに渡せる状態」
まで。

顧客向け画面は英語（本設計書中の UI コピーは英語で確定）。本設計書・実装計画・コミット
メッセージ等の社内文書は既存の他設計書と同様に日本語で記す。

## 2. 確定事項（ブレスト）

| 論点 | 決定 |
|---|---|
| 実装場所 | 既存モノレポ内に新モジュール追加（`packages/domain` / `packages/db` / `apps/api` / `apps/web`） |
| ブランチ | 追加のブランチ切り直しは不要。現在のワークツリーのブランチ（`KM-claude/japan-festival-raffle-app-a687a2`）でそのまま作業 |
| 通し番号 | `{campaignCode}-{6桁ゼロ埋め連番}` 例: `ca26-000123`。連番は `RaffleCounter` を行ロックして払い出し（ギャップレス） |
| 応募期間 | 開始 2026-08-01T04:00:00Z（＝東部時間 2026-08-01 00:00 EDT）、締切 2026-08-15T22:00:00Z（＝東部時間 2026-08-15 18:00 EDT）。両日程ともサマータイム期間内につき固定UTC値で保持し、タイムゾーンライブラリは導入しない |
| 期間外アクセス | 同一URL（`/raffle/ca26`）でカウントダウン／締切済みメッセージを出し分け。サーバー側でも二重チェック（フォーム送信時に期間外なら拒否） |
| メール送信基盤 | 今回は未導入。`RaffleMailer` インターフェース＋ `ConsoleRaffleMailer`（console.log スタブ）実装のみ。差し替え可能な形にしておく |
| Shopify顧客同期 | 今回実装。既存 `ShopifyAdminClient` パターンを踏襲し、`customerCreate`/upsert。任意項目のうち性別・生年月日はメタフィールドとして同期。失敗しても応募自体は成立させる（ベストエフォート、非同期エラーは記録のみ） |
| プライバシー同意 | ポリシーページが未整備（issue #34未着手）のため、今回は外部リンクなし。同意文言をフォーム内に直接表示する形で実装。将来ポリシーページができたらリンクを差し込む |
| メルマガ同意 | 参加同意（必須）とは別チェックボックスとし、デフォルト未チェックのオプトイン方式（カナダのCASL＝迷惑メール防止法に準拠する主流表現） |
| 応募者リストの外部連携 | 簡易CSVエクスポート画面を今回実装（operator配下、既存の Basic 認証ではなく既存の運営ロールガード方式を踏襲） |
| 重複応募 | メールアドレスをキャンペーン単位で一意とし、同一メールでの再送信はエラーにせず既存エントリを冪等に返す |

## 3. データモデル変更（Prisma）

新規マイグレーションを伴う。既存モデルとの主キー規約（`uuid`）に合わせる。

- 新規 `RaffleCounter`
  - `campaignCode String @id`
  - `lastNumber Int @default(0)`
- 新規 `RaffleEntry`
  - `id`, `campaignCode`, `serialNumber Int`
  - `accessToken String @unique`（マジックリンク用のランダムトークン）
  - `email String`（小文字正規化して保存）
  - 任意項目: `phone`, `firstName`, `lastName`, `gender`, `dateOfBirth DateTime? @db.Date`,
    `addressLine1`, `addressLine2`, `city`, `region`, `postalCode`, `country`
  - `privacyConsentAt DateTime`（同意した時刻。必須項目なので null 不可）
  - `marketingOptIn Boolean @default(false)`, `marketingOptInAt DateTime?`
  - `shopifyCustomerId String?`, `shopifySyncedAt DateTime?`, `shopifySyncError String?`
  - `createdAt`, `updatedAt`
  - `@@unique([campaignCode, email])`
  - `@@unique([campaignCode, serialNumber])`
  - `@@index([campaignCode])`

## 4. ドメイン（純粋関数・TDD先行、`packages/domain`）

- `formatRaffleSerialNumber(campaignCode: string, serialNumber: number, digits = 6): string`
  → `"ca26-000123"` のような表示用文字列を返す
- `getRaffleWindowStatus(now: Date, opensAt: Date, closesAt: Date): "BEFORE_OPEN" | "OPEN" | "CLOSED"`
- キャンペーン設定（`opensAt`/`closesAt`/`campaignCode`/`serialDigits`）は `packages/domain` から
  定数としてエクスポートし、`apps/api`・`apps/web` 双方が同一の正本を参照する
  （UTC固定値のため、Web側・API側で応募期間の判定がズレない）

## 5. API（NestJS・TDD、`apps/api/src/raffle/`）

既存の `AppModule` に平置きで登録する（既存コードベースは feature module 分割をしていないため踏襲）。

### 公開エンドポイント（認証不要）

- `POST /raffle/:campaignCode/entries`
  body: `{ email, privacyConsent: true, marketingOptIn?: boolean }`
  - `getRaffleWindowStatus` が `OPEN` でなければ 403
  - 既存エントリ（`campaignCode`+`email` 一致）があれば新規作成せずそれを返す（冪等）。
    ただし `marketingOptIn`/`privacyConsentAt` は今回の送信値で上書きする（同意は最新の意思表示を正とする）
  - トランザクション内で `RaffleCounter` を `FOR UPDATE` 行ロックし採番、`RaffleEntry` 作成
  - 作成後、`RaffleMailer.sendConfirmation` とベストエフォートの Shopify 同期を実行（いずれも
    レスポンスをブロックしない・失敗を握りつぶさずログ／`shopifySyncError` に記録）
  - レスポンス: `{ serialNumber, displayNumber, accessToken }`
- `GET /raffle/:campaignCode/entries/:token`
  - トークン一致するエントリを返す（存在しなければ404）
- `PATCH /raffle/:campaignCode/entries/:token`
  body: 任意プロフィール項目のサブセット＋`marketingOptIn?`
  - 更新後、Shopify 側へ再同期（`customerUpdate` 相当、ベストエフォート）

### 運営エンドポイント（既存 `OperatorController` に追加、`AuthGuard`+`RolesGuard("OPERATOR","ADMIN")` 踏襲）

- `GET /operator/raffle/:campaignCode/entries` — 一覧JSON
- `GET /operator/raffle/:campaignCode/entries.csv` — CSVダウンロード
  （列: displayNumber, email, phone, firstName, lastName, gender, dateOfBirth, address一式,
  marketingOptIn, createdAt）

### レート制限

応募エンドポイントは既存の `createFixedWindowRateLimiter`（`apps/web/lib/auth/rate-limiter.ts`、
現在は Basic認証ガードで使用中のもの）と同じ仕組みを Next.js の Server Action 呼び出し側で
IPキーとして適用する（例: 1分あたり5回）。

### Shopify 同期（`apps/api/src/shopify/` に追加）

- メールアドレスで既存顧客を検索 → なければ `customerCreate`、あれば `customerUpdate`
- 標準項目（氏名・電話・住所）はネイティブ顧客フィールド、性別・生年月日はメタフィールド
  （namespace: `raffle`, key: `gender` / `date_of_birth`）
- メルマガ同意は `emailMarketingConsent`（`marketingState: SUBSCRIBED|NOT_SUBSCRIBED`,
  `marketingOptInLevel: SINGLE_OPT_IN`）で反映
- 失敗時は例外を飲み込み `shopifySyncError` に記録するのみ。応募の成立を妨げない

## 6. Web（`apps/web/app/raffle/[campaign]/`、顧客向け・英語）

### ルーティングと最小レイアウト

既存 `app/layout.tsx` は全ルート共通のヘッダー・検索ピル・カテゴリ行を持つ Root Layout であり、
Next.js の仕様上サブツリーだけこれを外すことはできない。既存ルートには一切手を入れず、
`middleware.ts` を拡張してリクエストパスをヘッダーとして下流に転送し、Root Layout 側で
`/raffle/` 始まりのパスならショップ用ヘッダー等を描画せず `children` のみを返す、という
小さく閉じた変更で対応する。

### 画面

- `/raffle/ca26`（応募フォーム）: サーバーコンポーネントで `getRaffleWindowStatus` を判定
  - `BEFORE_OPEN`: ロゴ（テキストワードマーク「LIVAPON」、既存ヘッダーと同じ EB Garamond/Inter
    トリートメント。実ロゴ画像は未調達のため後日差し替え可能な形にする）＋ライブカウントダウン
  - `OPEN`: ロゴ＋メールアドレス入力＋プライバシー同意チェックボックス（必須）＋メルマガ
    オプトインチェックボックス（任意）＋ Join ボタンのみ
  - `CLOSED`: ロゴ＋「Entries are now closed」メッセージ
  - フォーム送信は既存パターン（`"use server"` Server Action → `apiFetch` POST、例:
    `apps/web/app/operator/webhooks/page.tsx` の `reprocess`）を踏襲し、成功したら
    `/raffle/ca26/entry/[token]` へリダイレクト
- `/raffle/ca26/entry/[token]`（確認・再確認画面。応募直後もメールのリンク経由も同じ画面）
  - 通し番号を大きく表示、応募完了メッセージ＋スクリーンショットを促す文言
  - 既存の保存済み値をプリフィルしたプロフィール補完フォーム（全項目任意）を追加表示し、
    送信すると `PATCH` で保存・Shopify再同期・同一画面に最新値を反映して再表示
  - トークン不一致・存在しない場合は汎用エラー表示（総当たり対策として詳細エラーは出さない）

### プレビュー用の考慮

現在日時（2026-07-21）は応募開始前のため、そのままでは常に `BEFORE_OPEN` 表示になる。
本番判定を変えずにプレビューで `OPEN` 状態を確認できるよう、非本番環境限定の環境変数
（例: `RAFFLE_PREVIEW_FORCE_OPEN=true`）で `getRaffleWindowStatus` の結果を上書きする
デバッグ用の分岐を用意する（`EnvService.isProduction()` チェックの外では絶対に効かない
既存の `assertProductionSecrets` 的なフェイルセーフ思想を踏襲）。

## 7. UI コピー（英語、確定）

- 見出し／CTA: "Join the LIVAPON Japan Festival Raffle" / ボタン "Join"
- 同意文言（必須, リンクなし）: "By joining, you agree that LIVAPON may collect and use the
  information you provide to run this raffle and to deliver LIVAPON services."
- メルマガオプトイン（任意, 未チェック初期値）: "Yes, I'd like to receive offers and updates
  from LIVAPON by email."
- 完了画面: "You're in! Your number is **CA26-000123**." + "Take a screenshot to keep it handy."
  + 追加プロフィール誘導: "Add a few more details and we'll get to know you better before the
  festival."
- 締切前: "Entries open in {countdown}" / 締切後: "Entries are now closed. Thanks for your
  interest!"

## 8. テスト方針

- `packages/domain`: `formatRaffleSerialNumber` / `getRaffleWindowStatus` の単体テスト（vitest）
- `apps/api`: `raffle.service` の単体テスト（冪等性、期間外拒否、カウンタの排他制御）、
  コントローラの e2e テスト（POST/GET/PATCH、運営CSVのロールガード）— 既存
  `apps/api/test/checkout` / `apps/api/test/operator` のパターンを踏襲
- `apps/web`: `middleware.test.ts` にパスヘッダー転送のケースを追加

## 9. スコープ外（今回やらないこと）

- 当日の抽選（当選判定）ロジック本体（外部で別設計）
- 実メール配信プロバイダの選定・導入（スタブのみ）
- プライバシーポリシーページ本体の作成（issue #34 側の作業）
- 複数キャンペーンを横断管理する運営UI（今回は `ca26` 固定。スキーマ・コードはキャンペーン単位で
  パラメータ化しておくが、キャンペーン追加用の管理画面は作らない）
