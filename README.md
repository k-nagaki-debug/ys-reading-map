# Y's READING - 病院マップシステム

## 📋 プロジェクト概要

Y's READINGは、全国の医療機関情報を地図上で管理・閲覧できるWebアプリケーションです。
医療機器（CT/MRI/PET）の有無、遠隔読影サービス、システム構成（オンプレ/クラウド/医知悟）などの詳細情報を一元管理し、
地域の医療機関情報を効率的に共有できます。

**技術スタック:**
- **フロントエンド**: Google Maps API, TailwindCSS, Axios
- **バックエンド**: Hono (Cloudflare Workers)
- **データベース**: Cloudflare D1 (SQLite)
- **ストレージ**: Cloudflare R2
- **デプロイ**: Cloudflare Pages

## 🔗 リポジトリ情報

- **GitHub**: https://github.com/k-nagaki-debug/ys-reading-map
- **本番URL**: https://ys-reading-map.pages.dev

## ✨ 主な機能

### 🔐 認証システム
- ✅ Cookie based認証（7日間有効）
- ✅ 全ページログイン保護
- ✅ セキュアなログインフロー

### 🗺️ 閲覧ページ（/）
- ✅ Google Maps統合による地図表示
- ✅ 病院マーカーのクリックで詳細情報表示
- ✅ コンパクト施設リスト（右側パネル）
- ✅ 施設名検索機能
- ✅ 遠隔読影サービス検索（テキスト検索・部分一致）
- ✅ モバイル対応レイアウト（地図400px、リスト500px）
- ✅ 薄青の検索フィールド（#eff6ff / #dbeafe）

### ⚙️ 管理画面（/admin）
- ✅ **CRUD操作** - 病院の新規登録・編集・削除
- ✅ **検索・フィルター** - 施設名、遠隔読影サービスでの絞り込み
- ✅ **並び替え** - 作成日時・名前での並び替え
- ✅ **CSV/Excelインポート** - 一括データインポート（Upsert対応）
- ✅ **CSVエクスポート** - UTF-8 BOM付きExcel互換CSV出力
- ✅ **画像アップロード** - 病院画像の管理（Cloudflare R2）
- ✅ **住所から座標取得** - Google Maps Geocoding API連携
- ✅ **システム設定フィールド** - オンプレ/クラウド/医知悟チェックボックス

### 🏥 病院データ項目
- **基本情報**: 施設名、説明、診療科目、住所、電話番号、ウェブサイト
- **位置情報**: 緯度・経度（Google Maps連携）
- **医療機器**: CT、MRI、PET有無
- **遠隔読影**: 遠隔読影サービス有無、事業者名
- **システム構成**: オンプレミス、クラウド、医知悟
- **画像**: 施設画像（R2ストレージ）

## 🌐 URLs

### 本番環境
- **メインURL**: https://ys-reading-map.pages.dev
- **ログイン**: https://ys-reading-map.pages.dev/login
- **閲覧ページ**: https://ys-reading-map.pages.dev/
- **管理画面**: https://ys-reading-map.pages.dev/admin
- **API**: https://ys-reading-map.pages.dev/api/hospitals

### 開発環境（Sandbox）
- **ローカル**: http://localhost:3000
- **管理画面**: http://localhost:3000/admin（要ログイン）
- **ログイン**: http://localhost:3000/login

### API エンドポイント
- `GET /api/hospitals` - 全病院取得
- `GET /api/hospitals/:id` - 病院詳細取得
- `POST /api/hospitals` - 病院作成
- `PUT /api/hospitals/:id` - 病院更新
- `DELETE /api/hospitals/:id` - 病院削除
- `POST /api/hospitals/import` - Excel/CSVインポート
- `POST /api/upload-image` - 画像アップロード
- `GET /api/images/:filename` - 画像取得

## 認証情報

### デフォルト管理者アカウント
- **ユーザー名**: `admin`
- **パスワード**: `hospital2025`

環境変数で変更可能：
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`

## データアーキテクチャ

### データモデル
```sql
hospitals (病院テーブル)
├── id (INTEGER) - 主キー
├── name (TEXT) - 病院名 *必須
├── description (TEXT) - 説明
├── departments (TEXT) - 診療科目（カンマ区切り）
├── latitude (REAL) - 緯度（任意）
├── longitude (REAL) - 経度（任意）
├── address (TEXT) - 住所
├── phone (TEXT) - 電話番号
├── website (TEXT) - ウェブサイトURL
├── image_url (TEXT) - 画像URL
├── has_ct (BOOLEAN) - CTスキャン有無（0/1）
├── has_mri (BOOLEAN) - MRI有無（0/1）
├── has_pet (BOOLEAN) - PET有無（0/1）
├── has_remote_reading (BOOLEAN) - 遠隔読影サービス有無（0/1）
├── remote_reading_provider (TEXT) - 遠隔読影事業者名
├── emergency (BOOLEAN) - 救急対応（0/1）
├── created_at (DATETIME) - 作成日時
└── updated_at (DATETIME) - 更新日時
```

**注**: 
- 緯度・経度は任意項目です
- 座標がない場合、病院はリストには表示されますがマップ上にはマーカーが表示されません
- 住所を入力して「座標取得」ボタンを押すと、自動的に座標が入力されます

### ストレージサービス
- **Cloudflare D1 Database**: SQLiteベースの分散データベース
- **Cloudflare R2 Storage**: 病院画像の保存
- **ローカル開発**: `.wrangler/state/v3/d1` にローカルSQLite

### 診療科目一覧
- 内科
- 外科
- 小児科
- 整形外科
- 皮膚科
- 眼科
- 耳鼻科
- 産婦人科
- 歯科
- 救急科
- その他

## 使い方

### 1. ログイン
1. `/login` にアクセス
2. ユーザー名: `admin`、パスワード: `hospital2025` でログイン

### 2. 病院の登録（編集ページ）

#### 方法1: 住所から自動で座標取得
1. 「新規作成」ボタンをクリック
2. 病院名、住所、診療科目などを入力
3. 「座標取得」ボタンをクリック
4. 自動的に緯度・経度が入力されます
5. 「保存」ボタンをクリック

#### 方法2: 手動で座標入力
1. 「新規作成」ボタンをクリック
2. 病院名、緯度、経度を手動入力
3. 「保存」ボタンをクリック

#### 方法3: 座標なしで登録
1. 「新規作成」ボタンをクリック
2. 病院名と住所のみ入力（座標は空白）
3. 「保存」ボタンをクリック
4. リストには表示されますが、マップには表示されません

### 3. 管理画面での操作

#### 病院の新規登録
1. 「新規登録」ボタンをクリック
2. 病院情報を入力
   - 病院名（必須）
   - 診療科目（カンマ区切り：例「内科,外科,小児科」）
   - 住所、電話番号
   - 医療機器（モダリティ）
     - CTスキャン（チェックボックス）
     - MRI（チェックボックス）
     - PET（チェックボックス）
   - 遠隔読影サービス（チェックボックス）
   - 遠隔読影事業者名
   - 救急対応（チェックボックス）
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

**CSVフォーマット例**:
```csv
name,description,departments,latitude,longitude,address,phone,website,business_hours,closed_days,parking,emergency
東京総合病院,総合診療を行う大規模病院,"内科,外科,小児科",35.6812,139.7671,東京都千代田区丸の内1-1-1,03-1234-5678,https://example.com,"平日 9:00-17:00","土日祝","あり（100台）",1
港区クリニック,地域密着型のクリニック,"内科,小児科",35.6586,139.7454,東京都港区芝公園4-2-8,03-2345-6789,,"平日 9:00-18:00","日祝","あり（10台）",0
```

#### 画像アップロード
1. 病院の新規登録または編集画面を開く
2. 「病院画像」から画像ファイルを選択（JPG, PNG, GIF、最大5MB）
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
│       └── sample_import.csv  # サンプルインポートファイル
├── migrations/
│   ├── 0001_initial_schema.sql              # 初期スキーマ
│   ├── 0002_add_image_url.sql               # 画像URL追加
│   ├── 0003_make_coordinates_optional.sql   # 座標を任意に
│   └── 0004_hospital_schema.sql             # 病院スキーマへ変換
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
npm run db:export           # 病院データをJSONエクスポート
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
- ✅ 病院専用スキーマ（診療科目、診療時間、救急対応など）

### マップビュー
- ✅ Google Maps API統合
- ✅ 病院マーカー表示（座標がある病院のみ）
- ✅ 病院一覧表示（カード形式）
- ✅ 検索・フィルター機能（診療科目対応）
- ✅ 病院詳細表示（InfoWindow）
- ✅ 座標なし病院の対応（リストのみ表示）
- ✅ 救急対応病院の表示

### 編集ページ
- ✅ 新規作成ボタン
- ✅ 住所から座標取得（ジオコーディング）
- ✅ 手動座標入力
- ✅ 座標なし登録対応
- ✅ 画像アップロード
- ✅ 病院編集・削除機能
- ✅ マーカーの色分け（赤・青）
- ✅ 診療科目、診療時間、救急対応フィールド

### 管理画面
- ✅ ダッシュボード（統計情報表示）
- ✅ テーブル形式での一覧表示
- ✅ リアルタイム検索機能
- ✅ 診療科目フィルター
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
- ⏳ 病院の評価・レビュー機能
- ⏳ 逆ジオコーディング（座標から住所への変換）
- ⏳ 診療科目別のマーカー色分け
- ⏳ 救急病院の目立つマーカー表示
- ⏳ 現在地取得機能
- ⏳ データエクスポート機能（CSV/JSON）
- ⏳ ページネーション（大量データ対応）
- ⏳ マーカークラスタリング
- ⏳ ルート検索機能
- ⏳ 診療時間による営業中/営業時間外の表示
- ⏳ 最寄り駅からの距離表示

## トラブルシューティング

### 地図が表示されない
- ブラウザのコンソールでエラーを確認
- Google Maps APIキーの設定を確認
- インターネット接続を確認
- ブラウザのキャッシュをクリアして再読み込み（Ctrl + F5）

### 座標取得に失敗する
- 住所を正確に入力してください（例: 「東京都千代田区丸の内1-1-1」）
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
  - パスワード: `hospital2025`

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

### 2025-11-18
- ✅ システム名を「Y's READING」に変更
- ✅ 診療時間、休診日、駐車場フィールドを削除
- ✅ 医療機器モダリティフィールドを追加（CT/MRI/PET）
- ✅ 遠隔読影サービス関連フィールドを追加
- ✅ UIにロゴ画像を統合

### 2025-11-17
- ✅ 病院専用スキーマへの変更（診療科目、救急対応等）
- ✅ APIエンドポイントの更新（facilities → hospitals）
- ✅ UI/UXの病院マップ用カスタマイズ
- ✅ サンプル病院データの投入
