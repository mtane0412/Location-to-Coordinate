# Location to Coordinate

地名や住所から緯度経度を取得するシンプルなウェブアプリケーションです。Google Maps Geocoding APIを使用して住所を緯度経度に変換し、結果をCloudflare KVにキャッシュします。

## 機能

- 住所や地名から緯度経度を取得
- 結果をクリップボードにコピー
- 30日間のキャッシュ機能によるAPI呼び出し削減

## 技術スタック

- [Cloudflare Workers](https://workers.cloudflare.com/)
- [Hono](https://hono.dev/) - 軽量で高速なウェブフレームワーク
- [Google Maps Geocoding API](https://developers.google.com/maps/documentation/geocoding/overview)
- [Cloudflare KV](https://developers.cloudflare.com/workers/runtime-apis/kv/) - キャッシュストレージ

## セットアップ

### 前提条件

- [Node.js](https://nodejs.org/) (v16以上)
- [Cloudflare アカウント](https://dash.cloudflare.com/sign-up)
- [Google Maps API キー](https://developers.google.com/maps/documentation/geocoding/get-api-key)

### インストール

1. リポジトリをクローン
   ```bash
   git clone https://github.com/yourusername/location-to-coordinate.git
   cd location-to-coordinate
   ```

2. 依存関係をインストール
   ```bash
   npm install
   ```

3. `.dev.vars`ファイルを作成し、Google Maps APIキーを設定
   ```
   GOOGLE_MAPS_API_KEY=あなたのAPIキー
   ```

4. ローカル開発サーバーを起動
   ```bash
   npm run dev
   ```

5. デプロイ
   ```bash
   npm run deploy
   ```

## API エンドポイント

### 1. フロントエンドUI

```
GET /
```

ブラウザで使用できるシンプルなUIを提供します。

### 2. 住所から緯度経度を取得

```
GET /api/geocode?address=住所
```

#### パラメータ
- `address`: 緯度経度に変換したい住所や地名（必須）

#### レスポンス例
```json
{
  "success": true,
  "data": {
    "address": "東京都渋谷区",
    "latitude": 35.6617773,
    "longitude": 139.7040506,
    "formatted": "35.6617773, 139.7040506"
  },
  "fromCache": false
}
```

### 3. キャッシュを更新

```
GET /api/geocode/refresh?address=住所
```

#### パラメータ
- `address`: 更新したい住所や地名（必須）

#### レスポンス例
```json
{
  "success": true,
  "data": {
    "address": "東京都渋谷区",
    "latitude": 35.6617773,
    "longitude": 139.7040506,
    "formatted": "35.6617773, 139.7040506"
  },
  "fromCache": false
}
```

### 4. プレーンテキスト形式で緯度経度を取得

```
GET /api/geocode/plain?address=住所
```

#### パラメータ
- `address`: 緯度経度に変換したい住所や地名（必須）

#### レスポンス例
```
35.6617773, 139.7040506
```

## エラーレスポンス

エラーが発生した場合、以下のようなレスポンスが返されます：

```json
{
  "success": false,
  "error": "エラーメッセージ"
}
```

## キャッシュについて

- 検索結果は30日間キャッシュされます
- キャッシュされた結果を使用する場合、レスポンスに `"fromCache": true` が含まれます
- キャッシュを強制的に更新するには `/api/geocode/refresh` エンドポイントを使用してください

## ライセンス

MIT License

Copyright (c) 2025