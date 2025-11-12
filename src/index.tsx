import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'

type Bindings = {
  DB: D1Database;
}

const app = new Hono<{ Bindings: Bindings }>()

// Enable CORS for API routes
app.use('/api/*', cors())

// Serve static files
app.use('/static/*', serveStatic({ root: './' }))

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

// Create new facility
app.post('/api/facilities', async (c) => {
  try {
    const body = await c.req.json()
    const { name, description, category, latitude, longitude, address, phone, website } = body
    
    if (!name || !latitude || !longitude) {
      return c.json({ success: false, error: 'Name, latitude, and longitude are required' }, 400)
    }
    
    const result = await c.env.DB.prepare(
      `INSERT INTO facilities (name, description, category, latitude, longitude, address, phone, website)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(name, description || null, category || null, latitude, longitude, address || null, phone || null, website || null).run()
    
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
    const { name, description, category, latitude, longitude, address, phone, website } = body
    
    const result = await c.env.DB.prepare(
      `UPDATE facilities 
       SET name = ?, description = ?, category = ?, latitude = ?, longitude = ?, 
           address = ?, phone = ?, website = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).bind(name, description || null, category || null, latitude, longitude, address || null, phone || null, website || null, id).run()
    
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

// Main page
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>施設マップ - Facility Map</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <style>
            #map {
                height: 600px;
                width: 100%;
            }
            .facility-card {
                transition: all 0.3s ease;
            }
            .facility-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
        </style>
    </head>
    <body class="bg-gray-50">
        <div class="container mx-auto px-4 py-8">
            <div class="mb-8">
                <h1 class="text-4xl font-bold text-gray-800 mb-2">
                    <i class="fas fa-map-marked-alt text-blue-600 mr-3"></i>
                    施設マップ
                </h1>
                <p class="text-gray-600">地図上をクリックして施設を登録してください</p>
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
        <div id="facility-modal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-white rounded-lg p-8 max-w-md w-full mx-4">
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
                    
                    <div class="mb-6">
                        <label class="block text-gray-700 font-bold mb-2">ウェブサイト</label>
                        <input type="url" id="facility-website"
                               class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
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

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
            // Google Maps API Key - Replace with your actual API key
            const GOOGLE_MAPS_API_KEY = 'YOUR_GOOGLE_MAPS_API_KEY';
            
            // Load Google Maps script
            const script = document.createElement('script');
            script.src = \`https://maps.googleapis.com/maps/api/js?key=\${GOOGLE_MAPS_API_KEY}&callback=initMap&language=ja\`;
            script.async = true;
            script.defer = true;
            document.head.appendChild(script);
        </script>
        <script src="/static/app.js"></script>
    </body>
    </html>
  `)
})

export default app
