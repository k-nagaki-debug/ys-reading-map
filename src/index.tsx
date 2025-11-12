import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'

type Bindings = {
  DB: D1Database;
  IMAGES: R2Bucket;
  GOOGLE_MAPS_API_KEY?: string;
}

const app = new Hono<{ Bindings: Bindings }>()

// Enable CORS for API routes
app.use('/api/*', cors())

// Serve static files
app.use('/static/*', serveStatic({ root: './' }))

// Get Google Maps API Key
app.get('/api/config/google-maps-key', (c) => {
  return c.json({ 
    apiKey: c.env.GOOGLE_MAPS_API_KEY || '' 
  })
})

// API Routes for Facilities

// Get all facilities
app.get('/api/facilities', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      'SELECT * FROM facilities ORDER BY created_at DESC'
    ).all()
    
    return c.json({ success: true, data: results })
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch facilities' }, 500)
  }
})

// Get single facility by ID
app.get('/api/facilities/:id', async (c) => {
  const id = c.req.param('id')
  
  try {
    const { results } = await c.env.DB.prepare(
      'SELECT * FROM facilities WHERE id = ?'
    ).bind(id).all()
    
    if (results.length === 0) {
      return c.json({ success: false, error: 'Facility not found' }, 404)
    }
    
    return c.json({ success: true, data: results[0] })
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch facility' }, 500)
  }
})

// Upload image
app.post('/api/upload-image', async (c) => {
  try {
    const formData = await c.req.formData()
    const file = formData.get('image') as File
    
    if (!file) {
      return c.json({ success: false, error: 'No image file provided' }, 400)
    }
    
    // Check file type
    if (!file.type.startsWith('image/')) {
      return c.json({ success: false, error: 'File must be an image' }, 400)
    }
    
    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return c.json({ success: false, error: 'Image size must be less than 5MB' }, 400)
    }
    
    // Generate unique filename
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(7)
    const extension = file.name.split('.').pop()
    const filename = `facility-${timestamp}-${randomStr}.${extension}`
    
    // Upload to R2
    const arrayBuffer = await file.arrayBuffer()
    await c.env.IMAGES.put(filename, arrayBuffer, {
      httpMetadata: {
        contentType: file.type
      }
    })
    
    // Return image URL (will be accessible via /api/images/:filename)
    const imageUrl = `/api/images/${filename}`
    
    return c.json({ 
      success: true, 
      data: { imageUrl, filename }
    }, 201)
  } catch (error) {
    console.error('Image upload error:', error)
    return c.json({ success: false, error: 'Failed to upload image' }, 500)
  }
})

// Serve images from R2
app.get('/api/images/:filename', async (c) => {
  const filename = c.req.param('filename')
  
  try {
    const object = await c.env.IMAGES.get(filename)
    
    if (!object) {
      return c.json({ success: false, error: 'Image not found' }, 404)
    }
    
    const headers = new Headers()
    object.writeHttpMetadata(headers)
    headers.set('Cache-Control', 'public, max-age=31536000')
    
    return new Response(object.body, { headers })
  } catch (error) {
    return c.json({ success: false, error: 'Failed to retrieve image' }, 500)
  }
})

// Create new facility
app.post('/api/facilities', async (c) => {
  try {
    const body = await c.req.json()
    const { name, description, category, latitude, longitude, address, phone, website, image_url } = body
    
    if (!name || !latitude || !longitude) {
      return c.json({ success: false, error: 'Name, latitude, and longitude are required' }, 400)
    }
    
    const result = await c.env.DB.prepare(
      `INSERT INTO facilities (name, description, category, latitude, longitude, address, phone, website, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(name, description || null, category || null, latitude, longitude, address || null, phone || null, website || null, image_url || null).run()
    
    return c.json({ 
      success: true, 
      data: { id: result.meta.last_row_id, name, latitude, longitude }
    }, 201)
  } catch (error) {
    return c.json({ success: false, error: 'Failed to create facility' }, 500)
  }
})

// Update facility
app.put('/api/facilities/:id', async (c) => {
  const id = c.req.param('id')
  
  try {
    const body = await c.req.json()
    const { name, description, category, latitude, longitude, address, phone, website, image_url } = body
    
    const result = await c.env.DB.prepare(
      `UPDATE facilities 
       SET name = ?, description = ?, category = ?, latitude = ?, longitude = ?, 
           address = ?, phone = ?, website = ?, image_url = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).bind(name, description || null, category || null, latitude, longitude, address || null, phone || null, website || null, image_url || null, id).run()
    
    if (result.meta.changes === 0) {
      return c.json({ success: false, error: 'Facility not found' }, 404)
    }
    
    return c.json({ success: true, data: { id } })
  } catch (error) {
    return c.json({ success: false, error: 'Failed to update facility' }, 500)
  }
})

// Delete facility
app.delete('/api/facilities/:id', async (c) => {
  const id = c.req.param('id')
  
  try {
    const result = await c.env.DB.prepare(
      'DELETE FROM facilities WHERE id = ?'
    ).bind(id).run()
    
    if (result.meta.changes === 0) {
      return c.json({ success: false, error: 'Facility not found' }, 404)
    }
    
    return c.json({ success: true, message: 'Facility deleted' })
  } catch (error) {
    return c.json({ success: false, error: 'Failed to delete facility' }, 500)
  }
})

// Admin page
app.get('/admin', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>肥後ジャーナルマップ管理画面 - Admin Dashboard</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <style>
            .table-row:hover {
                background-color: #f3f4f6;
            }
            .status-badge {
                padding: 0.25rem 0.75rem;
                border-radius: 9999px;
                font-size: 0.75rem;
                font-weight: 600;
            }
        </style>
    </head>
    <body class="bg-gray-50">
        <!-- Header -->
        <header class="bg-white shadow-sm border-b">
            <div class="container mx-auto px-4 py-4">
                <div class="flex justify-between items-center">
                    <div>
                        <h1 class="text-2xl font-bold text-gray-800">
                            <i class="fas fa-cog text-blue-600 mr-2"></i>
                            肥後ジャーナルマップ管理画面
                        </h1>
                        <p class="text-sm text-gray-600 mt-1">Facility Management Dashboard</p>
                    </div>
                    <div class="flex gap-3">
                        <a href="/" class="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition">
                            <i class="fas fa-map-marked-alt mr-2"></i>
                            マップビュー
                        </a>
                        <button onclick="showAddModal()" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition">
                            <i class="fas fa-plus mr-2"></i>
                            新規登録
                        </button>
                    </div>
                </div>
            </div>
        </header>

        <!-- Main Content -->
        <main class="container mx-auto px-4 py-8">
            <!-- Stats Cards -->
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div class="bg-white rounded-lg shadow p-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-gray-600 text-sm">総施設数</p>
                            <p id="total-count" class="text-3xl font-bold text-gray-800">0</p>
                        </div>
                        <div class="bg-blue-100 p-3 rounded-full">
                            <i class="fas fa-map-marker-alt text-blue-600 text-xl"></i>
                        </div>
                    </div>
                </div>
                <div class="bg-white rounded-lg shadow p-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-gray-600 text-sm">観光施設</p>
                            <p id="tourism-count" class="text-3xl font-bold text-gray-800">0</p>
                        </div>
                        <div class="bg-green-100 p-3 rounded-full">
                            <i class="fas fa-camera text-green-600 text-xl"></i>
                        </div>
                    </div>
                </div>
                <div class="bg-white rounded-lg shadow p-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-gray-600 text-sm">飲食店</p>
                            <p id="restaurant-count" class="text-3xl font-bold text-gray-800">0</p>
                        </div>
                        <div class="bg-yellow-100 p-3 rounded-full">
                            <i class="fas fa-utensils text-yellow-600 text-xl"></i>
                        </div>
                    </div>
                </div>
                <div class="bg-white rounded-lg shadow p-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-gray-600 text-sm">その他</p>
                            <p id="other-count" class="text-3xl font-bold text-gray-800">0</p>
                        </div>
                        <div class="bg-purple-100 p-3 rounded-full">
                            <i class="fas fa-ellipsis-h text-purple-600 text-xl"></i>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Filters -->
            <div class="bg-white rounded-lg shadow p-4 mb-6">
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">検索</label>
                        <input type="text" id="search-input" placeholder="施設名で検索..." 
                               class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">カテゴリ</label>
                        <select id="category-filter" 
                                class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="">すべて</option>
                            <option value="観光">観光</option>
                            <option value="飲食">飲食</option>
                            <option value="宿泊">宿泊</option>
                            <option value="ショッピング">ショッピング</option>
                            <option value="寺社">寺社</option>
                            <option value="公園">公園</option>
                            <option value="その他">その他</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">並び替え</label>
                        <select id="sort-select" 
                                class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="created_desc">作成日時（新しい順）</option>
                            <option value="created_asc">作成日時（古い順）</option>
                            <option value="name_asc">名前（あいうえお順）</option>
                            <option value="name_desc">名前（逆順）</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">&nbsp;</label>
                        <button onclick="applyFilters()" 
                                class="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition">
                            <i class="fas fa-filter mr-2"></i>
                            フィルター適用
                        </button>
                    </div>
                </div>
            </div>

            <!-- Facilities Table -->
            <div class="bg-white rounded-lg shadow overflow-hidden">
                <div class="overflow-x-auto">
                    <table class="w-full">
                        <thead class="bg-gray-100 border-b">
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">ID</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">施設名</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">カテゴリ</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">住所</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">電話番号</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">作成日時</th>
                                <th class="px-6 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">操作</th>
                            </tr>
                        </thead>
                        <tbody id="facilities-table-body" class="divide-y divide-gray-200">
                            <!-- Data will be loaded here -->
                        </tbody>
                    </table>
                </div>
                <div id="no-data" class="hidden text-center py-12 text-gray-500">
                    <i class="fas fa-inbox text-4xl mb-4"></i>
                    <p>施設が登録されていません</p>
                </div>
            </div>
        </main>

        <!-- Add/Edit Modal -->
        <div id="facility-modal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-white rounded-lg p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <h3 class="text-2xl font-bold text-gray-800 mb-4" id="modal-title">新規施設登録</h3>
                <form id="facility-form">
                    <input type="hidden" id="facility-id">
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div class="md:col-span-2">
                            <label class="block text-gray-700 font-bold mb-2">施設名 *</label>
                            <input type="text" id="facility-name" required 
                                   class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        </div>
                        
                        <div>
                            <label class="block text-gray-700 font-bold mb-2">カテゴリ</label>
                            <select id="facility-category" 
                                    class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                                <option value="">選択してください</option>
                                <option value="観光">観光</option>
                                <option value="飲食">飲食</option>
                                <option value="宿泊">宿泊</option>
                                <option value="ショッピング">ショッピング</option>
                                <option value="寺社">寺社</option>
                                <option value="公園">公園</option>
                                <option value="その他">その他</option>
                            </select>
                        </div>
                        
                        <div>
                            <label class="block text-gray-700 font-bold mb-2">電話番号</label>
                            <input type="tel" id="facility-phone"
                                   class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        </div>
                    </div>
                    
                    <div class="mb-4">
                        <label class="block text-gray-700 font-bold mb-2">説明</label>
                        <textarea id="facility-description" rows="3"
                                  class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"></textarea>
                    </div>
                    
                    <div class="mb-4">
                        <label class="block text-gray-700 font-bold mb-2">住所</label>
                        <input type="text" id="facility-address"
                               class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                    
                    <div class="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label class="block text-gray-700 font-bold mb-2">緯度 *</label>
                            <input type="number" step="any" id="facility-lat" required
                                   class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        </div>
                        <div>
                            <label class="block text-gray-700 font-bold mb-2">経度 *</label>
                            <input type="number" step="any" id="facility-lng" required
                                   class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        </div>
                    </div>
                    
                    <div class="mb-4">
                        <label class="block text-gray-700 font-bold mb-2">記事リンク</label>
                        <input type="url" id="facility-website"
                               class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                    
                    <div class="mb-6">
                        <label class="block text-gray-700 font-bold mb-2">施設画像</label>
                        <input type="file" id="facility-image" accept="image/*"
                               class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <p class="text-xs text-gray-500 mt-1">JPG, PNG, GIF形式（最大5MB）</p>
                        <input type="hidden" id="facility-image-url">
                        <div id="image-preview" class="mt-2 hidden">
                            <img id="preview-img" src="" alt="Preview" class="max-w-full h-32 object-cover rounded">
                            <button type="button" onclick="removeImage()" class="text-red-600 text-sm mt-1 hover:underline">
                                <i class="fas fa-times"></i> 画像を削除
                            </button>
                        </div>
                    </div>
                    
                    <div class="flex gap-2">
                        <button type="submit" 
                                class="flex-1 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition">
                            <i class="fas fa-save mr-2"></i>
                            保存
                        </button>
                        <button type="button" onclick="closeModal()" 
                                class="flex-1 bg-gray-400 text-white px-6 py-2 rounded-lg hover:bg-gray-500 transition">
                            <i class="fas fa-times mr-2"></i>
                            キャンセル
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="/static/admin.js"></script>
    </body>
    </html>
  `)
})

// Main page
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>肥後ジャーナルマップ - Higo Journal Map</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <style>
            #map {
                height: 600px;
                width: 100%;
                position: relative;
                z-index: 1;
            }
            .facility-card {
                transition: all 0.3s ease;
            }
            .facility-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            #facility-modal {
                z-index: 9999 !important;
            }
        </style>
    </head>
    <body class="bg-gray-50">
        <div class="container mx-auto px-4 py-8">
            <div class="mb-8 flex justify-between items-center">
                <div>
                    <h1 class="text-4xl font-bold text-gray-800 mb-2">
                        <i class="fas fa-map-marked-alt text-blue-600 mr-3"></i>
                        肥後ジャーナルマップ
                    </h1>
                    <p class="text-gray-600">地図上をクリックして施設を登録してください</p>
                </div>
                <a href="/admin" class="bg-gray-800 text-white px-6 py-3 rounded-lg hover:bg-gray-900 transition shadow-lg">
                    <i class="fas fa-cog mr-2"></i>
                    管理画面
                </a>
            </div>

            <!-- Map Container -->
            <div class="bg-white rounded-lg shadow-lg p-4 mb-8">
                <div id="map" class="rounded-lg"></div>
            </div>

            <!-- Facility List -->
            <div class="bg-white rounded-lg shadow-lg p-6">
                <h2 class="text-2xl font-bold text-gray-800 mb-4">
                    <i class="fas fa-list mr-2"></i>
                    登録施設一覧
                </h2>
                <div id="facility-list" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <!-- Facilities will be loaded here -->
                </div>
            </div>
        </div>

        <!-- Facility Form Modal -->
        <div id="facility-modal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center overflow-y-auto py-8" style="z-index: 9999;">
            <div class="bg-white rounded-lg p-8 max-w-md w-full mx-4 my-auto max-h-[90vh] overflow-y-auto">
                <h3 class="text-2xl font-bold text-gray-800 mb-4" id="modal-title">新規施設登録</h3>
                <form id="facility-form">
                    <input type="hidden" id="facility-id">
                    <input type="hidden" id="facility-lat">
                    <input type="hidden" id="facility-lng">
                    
                    <div class="mb-4">
                        <label class="block text-gray-700 font-bold mb-2">施設名 *</label>
                        <input type="text" id="facility-name" required 
                               class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                    
                    <div class="mb-4">
                        <label class="block text-gray-700 font-bold mb-2">カテゴリ</label>
                        <select id="facility-category" 
                                class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="">選択してください</option>
                            <option value="観光">観光</option>
                            <option value="飲食">飲食</option>
                            <option value="宿泊">宿泊</option>
                            <option value="ショッピング">ショッピング</option>
                            <option value="寺社">寺社</option>
                            <option value="公園">公園</option>
                            <option value="その他">その他</option>
                        </select>
                    </div>
                    
                    <div class="mb-4">
                        <label class="block text-gray-700 font-bold mb-2">説明</label>
                        <textarea id="facility-description" rows="3"
                                  class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"></textarea>
                    </div>
                    
                    <div class="mb-4">
                        <label class="block text-gray-700 font-bold mb-2">住所</label>
                        <input type="text" id="facility-address"
                               class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                    
                    <div class="mb-4">
                        <label class="block text-gray-700 font-bold mb-2">電話番号</label>
                        <input type="tel" id="facility-phone"
                               class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                    
                    <div class="mb-4">
                        <label class="block text-gray-700 font-bold mb-2">記事リンク</label>
                        <input type="url" id="facility-website"
                               class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                    
                    <div class="mb-6">
                        <label class="block text-gray-700 font-bold mb-2">施設画像</label>
                        <input type="file" id="facility-image" accept="image/*"
                               class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <p class="text-xs text-gray-500 mt-1">JPG, PNG, GIF形式（最大5MB）</p>
                        <input type="hidden" id="facility-image-url">
                        <div id="image-preview" class="mt-2 hidden">
                            <img id="preview-img" src="" alt="Preview" class="max-w-full h-32 object-cover rounded">
                            <button type="button" onclick="removeImage()" class="text-red-600 text-sm mt-1 hover:underline">
                                <i class="fas fa-times"></i> 画像を削除
                            </button>
                        </div>
                    </div>
                    
                    <div class="flex gap-2">
                        <button type="submit" 
                                class="flex-1 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition">
                            保存
                        </button>
                        <button type="button" onclick="closeModal()" 
                                class="flex-1 bg-gray-400 text-white px-6 py-2 rounded-lg hover:bg-gray-500 transition">
                            キャンセル
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <!-- Leaflet CSS -->
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <!-- Leaflet JS -->
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <script src="/static/app.js"></script>
    </body>
    </html>
  `)
})

export default app
