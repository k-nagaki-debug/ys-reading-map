# 施設マップ (Facility Map)

## プロジェクト概要
Googleマップ上にピンを立てて施設情報を登録・管理できるWebアプリケーションです。

### 主な機能
- ✅ Googleマップ上でクリックしてピンを立てる
- ✅ 施設情報の登録（名前、説明、カテゴリ、住所、電話番号、ウェブサイト）
- ✅ 施設の一覧表示（カード形式）
- ✅ 施設情報の編集・削除
- ✅ マーカークリックで詳細情報表示
- ✅ 施設リストからマップへのフォーカス機能
- ✅ サンプルデータ付き（東京タワー、浅草寺、スカイツリー）

## URLs
- **開発環境**: https://3000-ik7qqsck6za7d79ds73q2-8f57ffe2.sandbox.novita.ai
- **API エンドポイント**: 
  - `GET /api/facilities` - 全施設取得
  - `GET /api/facilities/:id` - 施設詳細取得
  - `POST /api/facilities` - 施設作成
  - `PUT /api/facilities/:id` - 施設更新
  - `DELETE /api/facilities/:id` - 施設削除

## データアーキテクチャ

### データモデル
```sql
facilities (施設テーブル)
├── id (INTEGER) - 主キー
├── name (TEXT) - 施設名 *必須
├── description (TEXT) - 説明
├── category (TEXT) - カテゴリ
├── latitude (REAL) - 緯度 *必須
├── longitude (REAL) - 経度 *必須
├── address (TEXT) - 住所
├── phone (TEXT) - 電話番号
├── website (TEXT) - ウェブサイト
├── created_at (DATETIME) - 作成日時
└── updated_at (DATETIME) - 更新日時
```

### ストレージサービス
- **Cloudflare D1 Database**: SQLiteベースの分散データベース
- **ローカル開発**: `.wrangler/state/v3/d1` にローカルSQLite

### カテゴリ一覧
- 観光
- 飲食
- 宿泊
- ショッピング
- 寺社
- 公園
- その他

## 使い方

### 1. Google Maps API Keyの設定
アプリを使用するには、Google Maps API Keyが必要です。

1. [Google Cloud Console](https://console.cloud.google.com/)でプロジェクトを作成
2. Maps JavaScript APIを有効化
3. APIキーを作成
4. `src/index.tsx` の `YOUR_GOOGLE_MAPS_API_KEY` を実際のAPIキーに置き換え

```typescript
const GOOGLE_MAPS_API_KEY = 'あなたのAPIキー';
```

### 2. 施設の登録
1. 地図上の任意の場所をクリック
2. 青いマーカーが表示されます
3. モーダルフォームに施設情報を入力
4. 「保存」ボタンをクリック

### 3. 施設の閲覧
- 地図上のマーカーをクリックすると情報ウィンドウが表示
- 画面下部の施設一覧からも確認可能
- 施設カードをクリックすると地図がその場所にフォーカス

### 4. 施設の編集・削除
- 情報ウィンドウまたは施設カードの「編集」ボタンで編集
- 「削除」ボタンで削除（確認ダイアログ表示）

## 技術スタック
- **フレームワーク**: Hono v4 (Cloudflare Workers対応)
- **データベース**: Cloudflare D1 (SQLite)
- **フロントエンド**: Vanilla JavaScript + TailwindCSS
- **地図**: Google Maps JavaScript API
- **デプロイ**: Cloudflare Pages
- **開発環境**: Wrangler + PM2

## プロジェクト構造
```
webapp/
├── src/
│   └── index.tsx          # Honoアプリケーション + API実装
├── public/
│   └── static/
│       └── app.js         # フロントエンドロジック
├── migrations/
│   └── 0001_initial_schema.sql  # データベーススキーマ
├── seed.sql               # サンプルデータ
├── ecosystem.config.cjs   # PM2設定
├── wrangler.jsonc         # Cloudflare設定
└── package.json           # 依存関係とスクリプト
```

## 開発コマンド

### 初期セットアップ
```bash
npm install
npm run db:migrate:local
npm run db:seed
```

### 開発サーバー起動
```bash
npm run build
pm2 start ecosystem.config.cjs
pm2 logs webapp --nostream  # ログ確認
```

### データベース管理
```bash
npm run db:migrate:local    # マイグレーション実行
npm run db:seed             # サンプルデータ挿入
npm run db:reset            # DB初期化
```

### その他
```bash
npm run clean-port          # ポート3000をクリーン
npm test                    # サービステスト
```

## デプロイ状況
- **プラットフォーム**: Cloudflare Pages
- **状態**: ⚠️ 開発環境で動作中（本番デプロイにはCloudflare API Keyが必要）
- **最終更新**: 2025-11-12

## 完了した機能
- ✅ Honoプロジェクトのセットアップ
- ✅ D1データベースの設定とマイグレーション
- ✅ RESTful API実装（CRUD操作）
- ✅ Googleマップ統合
- ✅ 施設登録フォーム（モーダル）
- ✅ 施設一覧表示（カード形式）
- ✅ マーカーとInfoWindow
- ✅ 編集・削除機能
- ✅ サンプルデータ

## 未実装の機能・今後の改善案
- ⏳ 本番環境へのデプロイ（Cloudflare Pages）
- ⏳ 施設の検索・フィルタリング機能
- ⏳ 施設画像のアップロード（Cloudflare R2連携）
- ⏳ ユーザー認証機能
- ⏳ 施設の評価・レビュー機能
- ⏳ ジオコーディング（住所から座標への変換）
- ⏳ 逆ジオコーディング（座標から住所への変換）
- ⏳ カテゴリ別のマーカー色分け
- ⏳ 現在地取得機能
- ⏳ エクスポート機能（JSON/CSV）

## 推奨される次のステップ
1. **Google Maps API Keyの設定** - 地図機能を有効化
2. **実際のデータ登録** - 自分の好きな場所を登録してテスト
3. **カスタマイズ** - カテゴリの追加やフィールドの拡張
4. **本番デプロイ** - Cloudflare Pagesへデプロイ

## トラブルシューティング

### 地図が表示されない
- Google Maps API Keyが正しく設定されているか確認
- ブラウザのコンソールでエラーを確認
- APIキーの制限設定を確認

### データベースエラー
```bash
npm run db:reset  # データベースをリセット
```

### ポート競合
```bash
npm run clean-port  # ポート3000をクリーン
```

## ライセンス
MIT

## 注意事項
- Google Maps API Keyは必ず`.env`ファイルで管理し、GitHubにコミットしないでください
- 本番環境ではAPIキーの制限を適切に設定してください
- サンプルデータはあくまでテスト用です
