# 肥後ジャーナルマップ (Higo Journal Map)

## プロジェクト概要
地図上にピンを立てて施設情報を登録・管理できるWebアプリケーションです。
肥後（熊本）の地域情報を共有するためのジャーナルマップです。
**Google Maps API**を使用して、高精度な地図表示とジオコーディング機能を提供します。

### 主な機能

#### 📍 マップビュー（閲覧専用）
- ✅ Google Mapsでの地図表示
- ✅ 施設マーカーのクリックで詳細情報表示
- ✅ 施設一覧表示（カード形式）
- ✅ 検索・フィルター機能（施設名・カテゴリ）
- ✅ 施設リストからマップへのフォーカス機能
- ✅ 座標がない施設もリスト表示

#### ✏️ 編集ページ（/edit）
- ✅ 「新規作成」ボタンから施設登録
- ✅ 住所入力 + 「座標取得」ボタンで自動ジオコーディング
- ✅ 手動での座標入力も可能（任意）
- ✅ 施設画像のアップロード（Cloudflare R2）
- ✅ 施設の編集・削除機能
- ✅ マーカーの色分け（赤：保存済み、青：新規作成中）
- ✅ 認証機能（ログイン必須）

#### 🔧 管理画面（/admin）
- ✅ **ダッシュボード** - 統計情報の表示（総施設数、カテゴリ別集計）
- ✅ **一覧管理** - テーブル形式で全施設を表示
- ✅ **検索・フィルター** - 施設名・カテゴリでの絞り込み
- ✅ **並び替え** - 作成日時・名前での並び替え
- ✅ **CRUD操作** - 施設の新規登録・編集・削除
- ✅ **住所から座標取得** - ジオコーディング機能搭載
- ✅ **Excel/CSVインポート** - 一括データインポート（住所から自動座標取得）
- ✅ **画像アップロード** - 施設画像の管理
- ✅ **地図連携** - 管理画面から地図ビューへの直接リンク
- ✅ **認証機能** - ログイン必須

#### ⚡ その他
- ✅ 座標なしでも施設登録可能（住所のみでOK）
- ✅ Google Maps Geocoding APIで住所から自動座標取得
- ✅ レスポンシブデザイン対応
- ✅ 画像アップロード対応（最大5MB）

## URLs

### 開発環境（Sandbox）
- **トップページ**: http://localhost:3000/
- **編集ページ**: http://localhost:3000/edit（要ログイン）
- **管理画面**: http://localhost:3000/admin（要ログイン）
- **ログイン**: http://localhost:3000/login

### API エンドポイント
- `GET /api/facilities` - 全施設取得
- `GET /api/facilities/:id` - 施設詳細取得
- `POST /api/facilities` - 施設作成
- `PUT /api/facilities/:id` - 施設更新
- `DELETE /api/facilities/:id` - 施設削除
- `POST /api/facilities/import` - Excel/CSVインポート
- `POST /api/upload-image` - 画像アップロード
- `GET /api/images/:filename` - 画像取得

## 認証情報

### デフォルト管理者アカウント
- **ユーザー名**: `admin`
- **パスワード**: `higo2025`

環境変数で変更可能：
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`

## データアーキテクチャ

### データモデル
```sql
facilities (施設テーブル)
├── id (INTEGER) - 主キー
├── name (TEXT) - 施設名 *必須
├── description (TEXT) - 説明
├── category (TEXT) - カテゴリ
├── latitude (REAL) - 緯度（任意）
├── longitude (REAL) - 経度（任意）
├── address (TEXT) - 住所
├── phone (TEXT) - 電話番号
├── website (TEXT) - 記事リンク
├── image_url (TEXT) - 画像URL
├── created_at (DATETIME) - 作成日時
└── updated_at (DATETIME) - 更新日時
```

**注**: 
- 緯度・経度は任意項目です
- 座標がない場合、施設はリストには表示されますがマップ上にはマーカーが表示されません
- 住所を入力して「座標取得」ボタンを押すと、自動的に座標が入力されます

### ストレージサービス
- **Cloudflare D1 Database**: SQLiteベースの分散データベース
- **Cloudflare R2 Storage**: 施設画像の保存
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

### 1. ログイン
1. `/login` にアクセス
2. ユーザー名: `admin`、パスワード: `higo2025` でログイン

### 2. 施設の登録（編集ページ）

#### 方法1: 住所から自動で座標取得
1. 「新規作成」ボタンをクリック
2. 施設名、住所などを入力
3. 「座標取得」ボタンをクリック
4. 自動的に緯度・経度が入力されます
5. 「保存」ボタンをクリック

#### 方法2: 手動で座標入力
1. 「新規作成」ボタンをクリック
2. 施設名、緯度、経度を手動入力
3. 「保存」ボタンをクリック

#### 方法3: 座標なしで登録
1. 「新規作成」ボタンをクリック
2. 施設名と住所のみ入力（座標は空白）
3. 「保存」ボタンをクリック
4. リストには表示されますが、マップには表示されません

### 3. 管理画面での操作

#### 施設の新規登録
1. 「新規登録」ボタンをクリック
2. 施設情報を入力
3. 住所を入力して「座標取得」ボタンで自動取得
4. 「保存」をクリック

#### Excel/CSVインポート
1. 「一括インポート」ボタンをクリック
2. CSV/Excelファイルを選択
3. プレビュー画面で内容を確認
   - ✅ あり: 座標が既に入力されている
   - ⚠️ 自動取得: 住所から自動的に座標を取得
   - ❌ なし: 座標も住所もない
4. 「インポート実行」をクリック
5. 住所から自動的に座標を取得してインポート

**サンプルCSVファイル**: `/static/sample_import.csv` からダウンロード可能

**CSVフォーマット例**:
```csv
name,description,category,latitude,longitude,address,phone,website
熊本城,観光地,観光,32.806061,130.706104,熊本県熊本市中央区本丸1-1,096-352-5900,https://example.com
サクラマチ,商業施設,ショッピング,,,熊本県熊本市中央区桜町3-10,096-288-3555,
```

#### 画像アップロード
1. 施設の新規登録または編集画面を開く
2. 「施設画像」から画像ファイルを選択（JPG, PNG, GIF、最大5MB）
3. プレビューが表示されます
4. 「保存」をクリック

## 技術スタック
- **フレームワーク**: Hono v4 (Cloudflare Workers対応)
- **データベース**: Cloudflare D1 (SQLite)
- **ストレージ**: Cloudflare R2 (画像保存)
- **フロントエンド**: Vanilla JavaScript + TailwindCSS
- **地図ライブラリ**: Google Maps JavaScript API
- **ジオコーディング**: Google Maps Geocoding API
- **HTTPクライアント**: Axios
- **認証**: Cookie-based Session
- **デプロイ**: Cloudflare Pages
- **開発環境**: Wrangler + PM2

## プロジェクト構造
```
webapp/
├── src/
│   └── index.tsx          # Honoアプリケーション + API実装 + HTML
├── public/
│   └── static/
│       ├── app.js         # 編集ページのフロントエンド
│       ├── admin.js       # 管理画面のフロントエンド
│       ├── view.js        # 閲覧ページのフロントエンド
│       ├── logo.png       # ロゴ画像
│       └── sample_import.csv  # サンプルインポートファイル
├── migrations/
│   ├── 0001_initial_schema.sql      # 初期スキーマ
│   ├── 0002_add_image_url.sql       # 画像URL追加
│   └── 0003_make_coordinates_optional.sql  # 座標を任意に
├── scripts/
│   └── backup-local-db.sh  # データベースバックアップスクリプト
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
npm run db:reset            # DB初期化（.wrangler削除 + マイグレーション + seed）
npm run db:backup           # ローカルDBをバックアップ
npm run db:export           # 施設データをJSONエクスポート
```

**⚠️ 重要: データバックアップについて**
- `.wrangler`ディレクトリを削除すると**ローカルのデータベースも削除**されます
- 開発中は定期的に`npm run db:backup`でバックアップを取ってください
- バックアップは`backups/`ディレクトリに保存されます（最新10件を保持）
- 本番環境（Cloudflare Pages）のデータは影響を受けません

### その他
```bash
npm run clean-port          # ポート3000をクリーン
npm test                    # サービステスト
```

## 完了した機能

### バックエンド
- ✅ Honoプロジェクトのセットアップ
- ✅ D1データベースの設定とマイグレーション
- ✅ RESTful API実装（CRUD操作）
- ✅ 画像アップロード（Cloudflare R2）
- ✅ Excel/CSVインポート機能
- ✅ 認証機能（Cookie-based Session）

### マップビュー
- ✅ Google Maps API統合
- ✅ 施設マーカー表示（座標がある施設のみ）
- ✅ 施設一覧表示（カード形式）
- ✅ 検索・フィルター機能
- ✅ 施設詳細表示（InfoWindow）
- ✅ 座標なし施設の対応（リストのみ表示）

### 編集ページ
- ✅ 新規作成ボタン
- ✅ 住所から座標取得（ジオコーディング）
- ✅ 手動座標入力
- ✅ 座標なし登録対応
- ✅ 画像アップロード
- ✅ 施設編集・削除機能
- ✅ マーカーの色分け（赤・青）

### 管理画面
- ✅ ダッシュボード（統計情報表示）
- ✅ テーブル形式での一覧表示
- ✅ リアルタイム検索機能
- ✅ カテゴリフィルター
- ✅ 並び替え機能（作成日時・名前）
- ✅ CRUD操作（新規登録・編集・削除）
- ✅ 住所から座標取得（ジオコーディング）
- ✅ Excel/CSVインポート（住所から自動座標取得）
- ✅ 画像アップロード・管理
- ✅ 地図ビューへの連携
- ✅ 通知システム

### その他
- ✅ レスポンシブデザイン
- ✅ ページ間のナビゲーション
- ✅ データベースバックアップスクリプト

## 今後の改善案
- ⏳ 本番環境へのデプロイ（Cloudflare Pages）
- ⏳ 施設の評価・レビュー機能
- ⏳ 逆ジオコーディング（座標から住所への変換）
- ⏳ カテゴリ別のマーカー色分け
- ⏳ 現在地取得機能
- ⏳ データエクスポート機能（CSV/JSON）
- ⏳ ページネーション（大量データ対応）
- ⏳ マーカークラスタリング
- ⏳ ルート検索機能

## トラブルシューティング

### 地図が表示されない
- ブラウザのコンソールでエラーを確認
- Google Maps APIキーの設定を確認
- インターネット接続を確認
- ブラウザのキャッシュをクリアして再読み込み（Ctrl + F5）

### 座標取得に失敗する
- 住所を正確に入力してください（例: 「熊本県熊本市中央区本丸1-1」）
- Google Maps APIの利用制限に達していないか確認（月40,000リクエストまで無料）
- APIキーの権限を確認（Geocoding API が有効か）

### データベースエラー
```bash
npm run db:reset  # データベースをリセット
```

### ポート競合
```bash
npm run clean-port  # ポート3000をクリーン
```

### ログイン画面が表示される
- デフォルトの認証情報でログイン
  - ユーザー名: `admin`
  - パスワード: `higo2025`

## ライセンス
MIT

## 注意事項

### Google Maps API
- Google Maps APIキー: `AIzaSyCEzrU58Z2R4awlzt8kBitIIpW-wILqzSk`
- 無料枠: 月40,000リクエストまで
- 超過した場合は課金が発生します
- [Google Maps Platform料金](https://mapsplatform.google.com/pricing/)

### データバックアップ
- 開発中は定期的に`npm run db:backup`を実行してください
- `.wrangler`ディレクトリを削除するとローカルデータが失われます

### 画像アップロード
- 最大ファイルサイズ: 5MB
- 対応フォーマット: JPG, PNG, GIF
- Cloudflare R2に保存されます

## 開発履歴

### 2025-11-17
- ✅ Google Maps APIへの移行（Leaflet.jsから）
- ✅ ジオコーディング機能追加（住所から座標取得）
- ✅ 座標を任意項目に変更（マイグレーション追加）
- ✅ Excel/CSVインポート時の自動ジオコーディング
- ✅ 管理画面の座標初期表示削除
- ✅ データベースバックアップスクリプト追加
- ✅ README更新

### 2025-11-12
- ✅ 初期実装（Hono + D1 + Leaflet.js）
- ✅ 画像アップロード機能
- ✅ Excel/CSVインポート機能
- ✅ 認証機能
