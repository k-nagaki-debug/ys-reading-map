# 肥後ジャーナルマップ (Higo Journal Map)

## プロジェクト概要
地図上にピンを立てて施設情報を登録・管理できるWebアプリケーションです。
OpenStreetMapとLeaflet.jsを使用して、**APIキー不要**ですぐに使い始められます。

### 主な機能

#### 📍 マップビュー
- ✅ 地図上でクリックしてピンを立てる（Leaflet.js + OpenStreetMap）
- ✅ 施設情報の登録（名前、説明、カテゴリ、住所、電話番号、ウェブサイト）
- ✅ 施設の一覧表示（カード形式）
- ✅ マーカークリックで詳細情報表示（ポップアップ）
- ✅ 施設リストからマップへのフォーカス機能

#### 🔧 管理画面
- ✅ **ダッシュボード** - 統計情報の表示（総施設数、カテゴリ別集計）
- ✅ **一覧管理** - テーブル形式で全施設を表示
- ✅ **検索・フィルター** - 施設名・カテゴリでの絞り込み
- ✅ **並び替え** - 作成日時・名前での並び替え
- ✅ **CRUD操作** - 施設の新規登録・編集・削除
- ✅ **地図連携** - 管理画面から地図ビューへの直接リンク
- ✅ **リアルタイム更新** - 操作後の即座な画面更新

#### ⚡ その他
- ✅ サンプルデータ付き（東京タワー、浅草寺、スカイツリー）
- ✅ **APIキー不要** - すぐに使用可能！
- ✅ レスポンシブデザイン対応

## URLs
- **マップビュー**: https://3000-ik7qqsck6za7d79ds73q2-8f57ffe2.sandbox.novita.ai
- **管理画面**: https://3000-ik7qqsck6za7d79ds73q2-8f57ffe2.sandbox.novita.ai/admin
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

### 1. すぐに使用可能！
**APIキーは不要です！** アプリにアクセスするだけで、すぐに施設を登録できます。

### 2. マップビューでの操作

#### 施設の登録
1. 地図上の任意の場所をクリック
2. 青いマーカーが表示されます
3. モーダルフォームに施設情報を入力
4. 「保存」ボタンをクリック

#### 地図の操作
- マウスホイールで拡大・縮小
- ドラッグで地図を移動
- 🔴 赤いマーカー：登録済みの施設
- 🔵 青いマーカー：登録中の一時マーカー

#### 施設の閲覧
- 地図上のマーカーをクリックすると情報ウィンドウが表示
- 画面下部の施設一覧からも確認可能
- 施設カードをクリックすると地図がその場所にフォーカス

### 3. 管理画面での操作

#### アクセス方法
- マップビュー右上の「管理画面」ボタンをクリック
- または直接 `/admin` にアクセス

#### 主な機能
- **統計情報**: 総施設数、カテゴリ別の集計を表示
- **検索**: 施設名でリアルタイム検索
- **フィルター**: カテゴリで絞り込み
- **並び替え**: 作成日時・名前で並び替え
- **新規登録**: 「新規登録」ボタンから座標を直接入力して登録
- **編集**: 各行の編集アイコンをクリック
- **削除**: 各行の削除アイコンをクリック（確認あり）
- **地図表示**: 地図アイコンをクリックでマップビューに遷移

## 技術スタック
- **フレームワーク**: Hono v4 (Cloudflare Workers対応)
- **データベース**: Cloudflare D1 (SQLite)
- **フロントエンド**: Vanilla JavaScript + TailwindCSS
- **地図ライブラリ**: Leaflet.js v1.9.4 + OpenStreetMap
- **HTTPクライアント**: Axios
- **デプロイ**: Cloudflare Pages
- **開発環境**: Wrangler + PM2

## プロジェクト構造
```
webapp/
├── src/
│   └── index.tsx          # Honoアプリケーション + API実装 + ルーティング
├── public/
│   └── static/
│       ├── app.js         # マップビューのフロントエンドロジック
│       └── admin.js       # 管理画面のフロントエンドロジック
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

### バックエンド
- ✅ Honoプロジェクトのセットアップ
- ✅ D1データベースの設定とマイグレーション
- ✅ RESTful API実装（CRUD操作）
- ✅ サンプルデータ

### マップビュー
- ✅ Leaflet.js + OpenStreetMap統合（APIキー不要）
- ✅ 地図上でのピン配置機能
- ✅ 施設登録フォーム（モーダル）
- ✅ 施設一覧表示（カード形式）
- ✅ カスタムマーカー（赤・青）とポップアップ
- ✅ 編集・削除機能

### 管理画面
- ✅ ダッシュボード（統計情報表示）
- ✅ テーブル形式での一覧表示
- ✅ リアルタイム検索機能
- ✅ カテゴリフィルター
- ✅ 並び替え機能（作成日時・名前）
- ✅ CRUD操作（新規登録・編集・削除）
- ✅ 地図ビューへの連携
- ✅ 通知システム

### その他
- ✅ レスポンシブデザイン
- ✅ ページ間のナビゲーション

## 未実装の機能・今後の改善案
- ⏳ 本番環境へのデプロイ（Cloudflare Pages）
- ⏳ 施設画像のアップロード（Cloudflare R2連携）
- ⏳ ユーザー認証機能（管理画面へのアクセス制限）
- ⏳ 施設の評価・レビュー機能
- ⏳ ジオコーディング（住所から座標への変換）
- ⏳ 逆ジオコーディング（座標から住所への変換）
- ⏳ カテゴリ別のマーカー色分け
- ⏳ 現在地取得機能
- ⏳ エクスポート機能（JSON/CSV）
- ⏳ ページネーション（大量データ対応）
- ⏳ バルクインポート機能（CSVアップロード）

## 推奨される次のステップ
1. **管理画面を試す** - `/admin` にアクセスして施設管理機能を確認
2. **実際のデータ登録** - 自分の好きな場所を登録してテスト
3. **カスタマイズ** - カテゴリの追加やフィールドの拡張
4. **認証機能の追加** - 管理画面へのアクセス制限
5. **本番デプロイ** - Cloudflare Pagesへデプロイ

## トラブルシューティング

### 地図が表示されない
- ブラウザのコンソールでエラーを確認
- インターネット接続を確認（OpenStreetMapのタイル読み込みに必要）
- ブラウザのキャッシュをクリアして再読み込み

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
- OpenStreetMapは[利用規約](https://www.openstreetmap.org/copyright)に従ってご使用ください
- 商用利用の場合は、適切なクレジット表示が必要です
- サンプルデータはあくまでテスト用です
- 大量のリクエストを送信する場合は、OpenStreetMapのタイルサーバーへの配慮が必要です

## Google Mapsへの切り替え
Google Maps JavaScript APIを使用したい場合は、以下の手順で切り替え可能です：
1. Google Cloud Consoleで Maps JavaScript APIを有効化
2. APIキーを取得
3. `src/index.tsx`でLeafletの代わりにGoogle Maps APIを読み込む
4. `public/static/app.js`をGoogle Maps用のコードに変更
