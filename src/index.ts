import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { html } from 'hono/html';

// 環境変数の型定義
type Bindings = {
  LOCATION_CACHE: KVNamespace;
  GOOGLE_MAPS_API_KEY: string;
};

// レスポンスの型定義
type GeocodingResponse = {
  success: boolean;
  data?: {
    address: string;
    latitude: number;
    longitude: number;
    formatted: string;
  };
  error?: string;
  fromCache?: boolean;
};

const app = new Hono<{ Bindings: Bindings }>();

// CORSを有効化
app.use('*', cors());

// キャッシュの有効期限（30日）
const CACHE_TTL = 60 * 60 * 24 * 30;

// Google Maps APIのベースURL
const GOOGLE_MAPS_API_BASE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

// フロントエンドのUIを提供するエンドポイント
app.get('/', (c) => {
  return c.html(
    html`<!DOCTYPE html>
      <html lang="ja">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>地名から緯度経度を取得</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              max-width: 800px;
              margin: 0 auto;
              padding: 20px;
              line-height: 1.6;
            }
            h1 {
              margin-bottom: 20px;
            }
            .form-group {
              margin-bottom: 15px;
            }
            label {
              display: block;
              margin-bottom: 5px;
              font-weight: bold;
            }
            input[type="text"] {
              width: 100%;
              padding: 8px;
              border: 1px solid #ddd;
              border-radius: 4px;
              font-size: 16px;
            }
            button {
              background-color: #4CAF50;
              color: white;
              border: none;
              padding: 10px 15px;
              border-radius: 4px;
              cursor: pointer;
              font-size: 16px;
            }
            button:hover {
              background-color: #45a049;
            }
            .result {
              margin-top: 20px;
              padding: 15px;
              border: 1px solid #ddd;
              border-radius: 4px;
              background-color: #f9f9f9;
              display: none;
            }
            .copy-btn {
              background-color: #2196F3;
              margin-top: 10px;
            }
            .copy-btn:hover {
              background-color: #0b7dda;
            }
            .error {
              color: #f44336;
              font-weight: bold;
            }
            .loading {
              display: none;
              margin-top: 15px;
            }
            .from-cache {
              color: #ff9800;
              font-size: 0.9em;
              margin-top: 5px;
            }
          </style>
        </head>
        <body>
          <h1>地名から緯度経度を取得</h1>
          <div class="form-group">
            <label for="address">地名・住所:</label>
            <input type="text" id="address" placeholder="例: 東京都渋谷区" />
          </div>
          <button id="search-btn">検索</button>
          <div class="loading" id="loading">検索中...</div>
          
          <div class="result" id="result">
            <h3>検索結果</h3>
            <p><strong>住所:</strong> <span id="formatted-address"></span></p>
            <p><strong>緯度:</strong> <span id="latitude"></span></p>
            <p><strong>経度:</strong> <span id="longitude"></span></p>
            <p><strong>緯度,経度:</strong> <span id="coordinates"></span></p>
            <div class="from-cache" id="from-cache">※キャッシュから取得した結果です</div>
            <button class="copy-btn" id="copy-btn">クリップボードにコピー</button>
          </div>

          <script>
            document.addEventListener('DOMContentLoaded', () => {
              const addressInput = document.getElementById('address');
              const searchBtn = document.getElementById('search-btn');
              const resultDiv = document.getElementById('result');
              const formattedAddressEl = document.getElementById('formatted-address');
              const latitudeEl = document.getElementById('latitude');
              const longitudeEl = document.getElementById('longitude');
              const coordinatesEl = document.getElementById('coordinates');
              const copyBtn = document.getElementById('copy-btn');
              const loadingEl = document.getElementById('loading');
              const fromCacheEl = document.getElementById('from-cache');

              searchBtn.addEventListener('click', async () => {
                const address = addressInput.value.trim();
                if (!address) return;

                resultDiv.style.display = 'none';
                loadingEl.style.display = 'block';

                try {
                  const response = await fetch('/api/geocode?address=' + encodeURIComponent(address));
                  const data = await response.json();

                  loadingEl.style.display = 'none';

                  if (data.success && data.data) {
                    formattedAddressEl.textContent = data.data.address;
                    latitudeEl.textContent = data.data.latitude;
                    longitudeEl.textContent = data.data.longitude;
                    coordinatesEl.textContent = data.data.formatted;
                    resultDiv.style.display = 'block';
                    
                    // キャッシュから取得した場合の表示
                    if (data.fromCache) {
                      fromCacheEl.style.display = 'block';
                    } else {
                      fromCacheEl.style.display = 'none';
                    }
                  } else {
                    alert('エラー: ' + (data.error || '住所が見つかりませんでした'));
                  }
                } catch (error) {
                  loadingEl.style.display = 'none';
                  alert('エラーが発生しました: ' + error.message);
                }
              });

              // Enterキーで検索
              addressInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                  searchBtn.click();
                }
              });

              // クリップボードにコピー
              copyBtn.addEventListener('click', () => {
                const textToCopy = coordinatesEl.textContent;
                navigator.clipboard.writeText(textToCopy)
                  .then(() => {
                    const originalText = copyBtn.textContent;
                    copyBtn.textContent = 'コピーしました！';
                    setTimeout(() => {
                      copyBtn.textContent = originalText;
                    }, 2000);
                  })
                  .catch(err => {
                    alert('クリップボードへのコピーに失敗しました: ' + err);
                  });
              });
            });
          </script>
        </body>
      </html>`
  );
});

// 地名から緯度経度を取得するAPIエンドポイント
app.get('/api/geocode', async (c) => {
  const address = c.req.query('address');
  
  if (!address) {
    return c.json<GeocodingResponse>({
      success: false,
      error: '住所が指定されていません'
    }, 400);
  }

  // キャッシュキーの作成
  const cacheKey = `geocode:${address}`;
  
  try {
    // キャッシュから取得を試みる
    const cachedResult = await c.env.LOCATION_CACHE.get(cacheKey);
    
    if (cachedResult) {
      // キャッシュヒット
      const parsedResult = JSON.parse(cachedResult);
      return c.json<GeocodingResponse>({
        success: true,
        data: parsedResult,
        fromCache: true
      });
    }
    
    // Google Maps APIを呼び出す
    const url = `${GOOGLE_MAPS_API_BASE_URL}?address=${encodeURIComponent(address)}&key=${c.env.GOOGLE_MAPS_API_KEY}&language=ja`;
    console.log('APIリクエストURL (キーは非表示):', url.replace(c.env.GOOGLE_MAPS_API_KEY, 'API_KEY_HIDDEN'));
    console.log('APIキーの長さ:', c.env.GOOGLE_MAPS_API_KEY.length);
    
    const response = await fetch(url);
    const data = await response.json() as {
      status: string;
      results?: Array<{
        formatted_address: string;
        geometry: {
          location: {
            lat: number;
            lng: number;
          }
        }
      }>,
      error_message?: string
    };
    
    console.log('APIレスポンス:', JSON.stringify(data, null, 2));
    
    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
      const errorMessage = data.error_message
        ? `住所が見つかりませんでした: ${data.status} - ${data.error_message}`
        : `住所が見つかりませんでした: ${data.status}`;
      
      console.error('Geocoding エラー:', errorMessage);
      
      return c.json<GeocodingResponse>({
        success: false,
        error: errorMessage
      }, 404);
    }
    
    const result = data.results[0];
    const location = result.geometry.location;
    
    const geocodeResult = {
      address: result.formatted_address,
      latitude: location.lat,
      longitude: location.lng,
      formatted: `${location.lat}, ${location.lng}`
    };
    
    // 結果をキャッシュに保存（30日間）
    await c.env.LOCATION_CACHE.put(
      cacheKey,
      JSON.stringify(geocodeResult),
      { expirationTtl: CACHE_TTL }
    );
    
    return c.json<GeocodingResponse>({
      success: true,
      data: geocodeResult,
      fromCache: false
    });
    
  } catch (error) {
    console.error('Geocoding error:', error);
    return c.json<GeocodingResponse>({
      success: false,
      error: `エラーが発生しました: ${error instanceof Error ? error.message : String(error)}`
    }, 500);
  }
});

// キャッシュを明示的に更新するエンドポイント
app.get('/api/geocode/refresh', async (c) => {
  const address = c.req.query('address');
  
  if (!address) {
    return c.json<GeocodingResponse>({
      success: false,
      error: '住所が指定されていません'
    }, 400);
  }

  // キャッシュキーの作成
  const cacheKey = `geocode:${address}`;
  
  try {
    // Google Maps APIを呼び出す
    const url = `${GOOGLE_MAPS_API_BASE_URL}?address=${encodeURIComponent(address)}&key=${c.env.GOOGLE_MAPS_API_KEY}&language=ja`;
    console.log('リフレッシュ - APIリクエストURL (キーは非表示):', url.replace(c.env.GOOGLE_MAPS_API_KEY, 'API_KEY_HIDDEN'));
    console.log('リフレッシュ - APIキーの長さ:', c.env.GOOGLE_MAPS_API_KEY.length);
    
    const response = await fetch(url);
    const data = await response.json() as {
      status: string;
      results?: Array<{
        formatted_address: string;
        geometry: {
          location: {
            lat: number;
            lng: number;
          }
        }
      }>,
      error_message?: string
    };
    
    console.log('リフレッシュ - APIレスポンス:', JSON.stringify(data, null, 2));
    
    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
      const errorMessage = data.error_message
        ? `住所が見つかりませんでした: ${data.status} - ${data.error_message}`
        : `住所が見つかりませんでした: ${data.status}`;
      
      console.error('リフレッシュ - Geocoding エラー:', errorMessage);
      
      return c.json<GeocodingResponse>({
        success: false,
        error: errorMessage
      }, 404);
    }
    
    const result = data.results[0];
    const location = result.geometry.location;
    
    const geocodeResult = {
      address: result.formatted_address,
      latitude: location.lat,
      longitude: location.lng,
      formatted: `${location.lat}, ${location.lng}`
    };
    
    // 結果をキャッシュに保存（30日間）
    await c.env.LOCATION_CACHE.put(
      cacheKey,
      JSON.stringify(geocodeResult),
      { expirationTtl: CACHE_TTL }
    );
    
    return c.json<GeocodingResponse>({
      success: true,
      data: geocodeResult,
      fromCache: false
    });
    
  } catch (error) {
    console.error('Geocoding error:', error);
    return c.json<GeocodingResponse>({
      success: false,
      error: `エラーが発生しました: ${error instanceof Error ? error.message : String(error)}`
    }, 500);
  }
});

// プレーンテキスト形式で緯度経度を返すエンドポイント（クリップボード用）
app.get('/api/geocode/plain', async (c) => {
  const address = c.req.query('address');
  
  if (!address) {
    return c.text('エラー: 住所が指定されていません', 400);
  }

  // キャッシュキーの作成
  const cacheKey = `geocode:${address}`;
  
  try {
    // キャッシュから取得を試みる
    const cachedResult = await c.env.LOCATION_CACHE.get(cacheKey);
    
    if (cachedResult) {
      // キャッシュヒット
      const parsedResult = JSON.parse(cachedResult);
      return c.text(parsedResult.formatted);
    }
    
    // Google Maps APIを呼び出す
    const url = `${GOOGLE_MAPS_API_BASE_URL}?address=${encodeURIComponent(address)}&key=${c.env.GOOGLE_MAPS_API_KEY}&language=ja`;
    console.log('プレーンテキスト - APIリクエストURL (キーは非表示):', url.replace(c.env.GOOGLE_MAPS_API_KEY, 'API_KEY_HIDDEN'));
    console.log('プレーンテキスト - APIキーの長さ:', c.env.GOOGLE_MAPS_API_KEY.length);
    
    const response = await fetch(url);
    const data = await response.json() as {
      status: string;
      results?: Array<{
        formatted_address: string;
        geometry: {
          location: {
            lat: number;
            lng: number;
          }
        }
      }>,
      error_message?: string
    };
    
    console.log('プレーンテキスト - APIレスポンス:', JSON.stringify(data, null, 2));
    
    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
      const errorMessage = data.error_message
        ? `エラー: 住所が見つかりませんでした: ${data.status} - ${data.error_message}`
        : `エラー: 住所が見つかりませんでした: ${data.status}`;
      
      console.error('プレーンテキスト - Geocoding エラー:', errorMessage);
      
      return c.text(errorMessage, 404);
    }
    
    const result = data.results[0];
    const location = result.geometry.location;
    
    const formatted = `${location.lat}, ${location.lng}`;
    
    const geocodeResult = {
      address: result.formatted_address,
      latitude: location.lat,
      longitude: location.lng,
      formatted
    };
    
    // 結果をキャッシュに保存（30日間）
    await c.env.LOCATION_CACHE.put(
      cacheKey,
      JSON.stringify(geocodeResult),
      { expirationTtl: CACHE_TTL }
    );
    
    return c.text(formatted);
    
  } catch (error) {
    console.error('Geocoding error:', error);
    return c.text(`エラー: ${error instanceof Error ? error.message : String(error)}`, 500);
  }
});

export default app;
