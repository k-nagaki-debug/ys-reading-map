import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'

type Bindings = {
  DB: D1Database;
  IMAGES: R2Bucket;
  GOOGLE_MAPS_API_KEY?: string;
  ADMIN_USERNAME?: string;
  ADMIN_PASSWORD?: string;
}

const app = new Hono<{ Bindings: Bindings }>()

// Enable CORS for API routes
app.use('/api/*', cors())

// Serve static files
app.use('/static/*', serveStatic({ root: './' }))

// Authentication middleware
const requireAuth = async (c: any, next: any) => {
  const sessionToken = getCookie(c, 'session_token')
  
  if (!sessionToken || sessionToken !== 'authenticated') {
    return c.redirect('/login')
  }
  
  await next()
}

// Check if user is authenticated
const isAuthenticated = (c: any) => {
  const sessionToken = getCookie(c, 'session_token')
  return sessionToken === 'authenticated'
}

// Get Google Maps API Key
app.get('/api/config/google-maps-key', (c) => {
  return c.json({ 
    apiKey: c.env.GOOGLE_MAPS_API_KEY || '' 
  })
})

// Check authentication status
app.get('/api/auth/status', (c) => {
  return c.json({ 
    authenticated: isAuthenticated(c)
  })
})

// Login endpoint
app.post('/api/auth/login', async (c) => {
  try {
    const { username, password } = await c.req.json()
    
    const adminUsername = c.env.ADMIN_USERNAME || 'admin'
    const adminPassword = c.env.ADMIN_PASSWORD || 'hospital2025'
    
    if (username === adminUsername && password === adminPassword) {
      setCookie(c, 'session_token', 'authenticated', {
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        httpOnly: true,
        secure: true,
        sameSite: 'Lax'
      })
      
      return c.json({ success: true, message: 'ログインしました' })
    } else {
      return c.json({ success: false, error: 'ユーザー名またはパスワードが正しくありません' }, 401)
    }
  } catch (error) {
    return c.json({ success: false, error: 'ログインに失敗しました' }, 500)
  }
})

// Logout endpoint
app.post('/api/auth/logout', (c) => {
  deleteCookie(c, 'session_token', { path: '/' })
  return c.json({ success: true, message: 'ログアウトしました' })
})

// API Routes for Hospitals

// Get all hospitals
app.get('/api/hospitals', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      'SELECT * FROM hospitals ORDER BY created_at DESC'
    ).all()
    
    return c.json({ success: true, data: results })
  } catch (error) {
    console.error('Error fetching hospitals:', error);
    return c.json({ success: false, error: 'Failed to fetch hospitals' }, 500)
  }
})

// Export hospitals to CSV (Excel compatible with UTF-8 BOM)
// IMPORTANT: This must come BEFORE /api/hospitals/:id to avoid route collision
app.get('/api/hospitals/export', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      'SELECT * FROM hospitals ORDER BY id ASC'
    ).all()
    
    // CSV header with Japanese column names
    const header = [
      'ID',
      '施設名',
      '説明',
      '診療科目',
      '緯度',
      '経度',
      '住所',
      '電話番号',
      'ウェブサイト',
      '画像URL',
      'CT',
      'MRI',
      'PET',
      '遠隔読影サービス',
      '遠隔読影事業者',
      'オンプレ',
      'クラウド',
      '医知悟',
      '作成日時',
      '更新日時'
    ].join(',')
    
    // Convert data to CSV rows
    const rows = results.map((hospital: any) => {
      return [
        hospital.id,
        `"${(hospital.name || '').replace(/"/g, '""')}"`,
        `"${(hospital.description || '').replace(/"/g, '""')}"`,
        `"${(hospital.departments || '').replace(/"/g, '""')}"`,
        hospital.latitude || '',
        hospital.longitude || '',
        `"${(hospital.address || '').replace(/"/g, '""')}"`,
        `"${(hospital.phone || '').replace(/"/g, '""')}"`,
        `"${(hospital.website || '').replace(/"/g, '""')}"`,
        `"${(hospital.image_url || '').replace(/"/g, '""')}"`,
        hospital.has_ct ? '有' : '無',
        hospital.has_mri ? '有' : '無',
        hospital.has_pet ? '有' : '無',
        hospital.has_remote_reading ? '有' : '無',
        `"${(hospital.remote_reading_provider || '').replace(/"/g, '""')}"`,
        hospital.has_onpremise ? '有' : '無',
        hospital.has_cloud ? '有' : '無',
        hospital.has_ichigo ? '有' : '無',
        hospital.created_at || '',
        hospital.updated_at || ''
      ].join(',')
    })
    
    // Add UTF-8 BOM for proper Excel display of Japanese characters
    const bom = '\uFEFF'
    const csv = bom + [header, ...rows].join('\n')
    
    // Return CSV with proper headers
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="hospitals_export_${new Date().toISOString().split('T')[0]}.csv"`
      }
    })
  } catch (error) {
    console.error('Export error:', error)
    return c.json({ success: false, error: 'Failed to export hospitals' }, 500)
  }
})

// Get single hospital by ID
app.get('/api/hospitals/:id', async (c) => {
  const id = c.req.param('id')
  
  try {
    const { results } = await c.env.DB.prepare(
      'SELECT * FROM hospitals WHERE id = ?'
    ).bind(id).all()
    
    if (results.length === 0) {
      return c.json({ success: false, error: 'Hospital not found' }, 404)
    }
    
    return c.json({ success: true, data: results[0] })
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch hospital' }, 500)
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

// Create new hospital
app.post('/api/hospitals', async (c) => {
  try {
    const body = await c.req.json()
    const { name, description, departments, latitude, longitude, address, phone, website, image_url, 
            has_ct, has_mri, has_pet, has_remote_reading, remote_reading_provider,
            has_onpremise, has_cloud, has_ichigo } = body
    
    if (!name) {
      return c.json({ success: false, error: 'Name is required' }, 400)
    }
    
    const result = await c.env.DB.prepare(
      `INSERT INTO hospitals (name, description, departments, latitude, longitude, address, phone, website, image_url, 
                              has_ct, has_mri, has_pet, has_remote_reading, remote_reading_provider,
                              has_onpremise, has_cloud, has_ichigo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(name, description || null, departments || null, latitude, longitude, address || null, phone || null, 
           website || null, image_url || null, has_ct || 0, has_mri || 0, has_pet || 0, 
           has_remote_reading || 0, remote_reading_provider || null,
           has_onpremise || 0, has_cloud || 0, has_ichigo || 0).run()
    
    return c.json({ 
      success: true, 
      data: { id: result.meta.last_row_id, name, latitude, longitude }
    }, 201)
  } catch (error) {
    console.error('Error creating hospital:', error)
    return c.json({ success: false, error: 'Failed to create hospital', details: error.message }, 500)
  }
})

// Update hospital
app.put('/api/hospitals/:id', async (c) => {
  const id = c.req.param('id')
  
  try {
    const body = await c.req.json()
    const { name, description, departments, latitude, longitude, address, phone, website, image_url, 
            has_ct, has_mri, has_pet, has_remote_reading, remote_reading_provider,
            has_onpremise, has_cloud, has_ichigo } = body
    
    const result = await c.env.DB.prepare(
      `UPDATE hospitals 
       SET name = ?, description = ?, departments = ?, latitude = ?, longitude = ?, 
           address = ?, phone = ?, website = ?, image_url = ?, 
           has_ct = ?, has_mri = ?, has_pet = ?, has_remote_reading = ?, remote_reading_provider = ?,
           has_onpremise = ?, has_cloud = ?, has_ichigo = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).bind(name, description || null, departments || null, latitude, longitude, address || null, phone || null, 
           website || null, image_url || null, has_ct || 0, has_mri || 0, has_pet || 0, 
           has_remote_reading || 0, remote_reading_provider || null,
           has_onpremise || 0, has_cloud || 0, has_ichigo || 0, id).run()
    
    if (result.meta.changes === 0) {
      return c.json({ success: false, error: 'Hospital not found' }, 404)
    }
    
    return c.json({ success: true, data: { id } })
  } catch (error) {
    return c.json({ success: false, error: 'Failed to update hospital' }, 500)
  }
})

// Delete hospital
app.delete('/api/hospitals/:id', async (c) => {
  const id = c.req.param('id')
  
  try {
    const result = await c.env.DB.prepare(
      'DELETE FROM hospitals WHERE id = ?'
    ).bind(id).run()
    
    if (result.meta.changes === 0) {
      return c.json({ success: false, error: 'Hospital not found' }, 404)
    }
    
    return c.json({ success: true, message: 'Hospital deleted' })
  } catch (error) {
    return c.json({ success: false, error: 'Failed to delete hospital' }, 500)
  }
})

// Delete all hospitals (admin only)
app.delete('/api/hospitals', async (c) => {
  try {
    const result = await c.env.DB.prepare('DELETE FROM hospitals').run()
    
    return c.json({ 
      success: true, 
      message: 'All hospitals deleted',
      deletedCount: result.meta.changes 
    })
  } catch (error) {
    return c.json({ success: false, error: 'Failed to delete hospitals' }, 500)
  }
})

// Apply migration (temporary endpoint for adding system type columns)
app.post('/api/migrate/add-system-types', async (c) => {
  try {
    // Add has_onpremise column
    await c.env.DB.prepare('ALTER TABLE hospitals ADD COLUMN has_onpremise BOOLEAN DEFAULT 0').run()
    
    // Add has_cloud column
    await c.env.DB.prepare('ALTER TABLE hospitals ADD COLUMN has_cloud BOOLEAN DEFAULT 0').run()
    
    // Add has_ichigo column
    await c.env.DB.prepare('ALTER TABLE hospitals ADD COLUMN has_ichigo BOOLEAN DEFAULT 0').run()
    
    return c.json({ 
      success: true, 
      message: 'Migration applied successfully'
    })
  } catch (error: any) {
    return c.json({ 
      success: false, 
      error: 'Failed to apply migration',
      details: error.message 
    }, 500)
  }
})

// Bulk import hospitals from CSV/Excel
app.post('/api/hospitals/import', async (c) => {
  try {
    const { hospitals } = await c.req.json()
    
    if (!Array.isArray(hospitals) || hospitals.length === 0) {
      return c.json({ success: false, error: 'No hospitals data provided' }, 400)
    }
    
    let successCount = 0
    let updateCount = 0
    let errorCount = 0
    const errors: any[] = []
    
    for (let i = 0; i < hospitals.length; i++) {
      const hospital = hospitals[i]
      
      // Validate required fields
      if (!hospital.name) {
        errorCount++
        errors.push({ row: i + 1, error: '必須項目（名前）が不足しています' })
        continue
      }
      
      try {
        // Convert boolean values
        const has_ct = hospital.has_ct === true || hospital.has_ct === 1 || hospital.has_ct === '1' ? 1 : 0
        const has_mri = hospital.has_mri === true || hospital.has_mri === 1 || hospital.has_mri === '1' ? 1 : 0
        const has_pet = hospital.has_pet === true || hospital.has_pet === 1 || hospital.has_pet === '1' ? 1 : 0
        const has_remote_reading = hospital.has_remote_reading === true || hospital.has_remote_reading === 1 || hospital.has_remote_reading === '1' ? 1 : 0
        const has_onpremise = hospital.has_onpremise === true || hospital.has_onpremise === 1 || hospital.has_onpremise === '1' ? 1 : 0
        const has_cloud = hospital.has_cloud === true || hospital.has_cloud === 1 || hospital.has_cloud === '1' ? 1 : 0
        const has_ichigo = hospital.has_ichigo === true || hospital.has_ichigo === 1 || hospital.has_ichigo === '1' ? 1 : 0
        
        // Check if hospital with same name and address already exists
        const { results: existing } = await c.env.DB.prepare(
          `SELECT id FROM hospitals WHERE name = ? AND address = ?`
        ).bind(hospital.name, hospital.address || null).all()
        
        if (existing.length > 0) {
          // Update existing hospital
          await c.env.DB.prepare(
            `UPDATE hospitals 
             SET description = ?, departments = ?, latitude = ?, longitude = ?, 
                 phone = ?, website = ?, image_url = ?, 
                 has_ct = ?, has_mri = ?, has_pet = ?, has_remote_reading = ?, remote_reading_provider = ?,
                 has_onpremise = ?, has_cloud = ?, has_ichigo = ?,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`
          ).bind(
            hospital.description || null,
            hospital.departments || null,
            hospital.latitude ? parseFloat(hospital.latitude) : null,
            hospital.longitude ? parseFloat(hospital.longitude) : null,
            hospital.phone || null,
            hospital.website || null,
            hospital.image_url || null,
            has_ct,
            has_mri,
            has_pet,
            has_remote_reading,
            hospital.remote_reading_provider || null,
            has_onpremise,
            has_cloud,
            has_ichigo,
            existing[0].id
          ).run()
          
          updateCount++
        } else {
          // Insert new hospital
          await c.env.DB.prepare(
            `INSERT INTO hospitals (name, description, departments, latitude, longitude, address, phone, website, image_url, 
                                    has_ct, has_mri, has_pet, has_remote_reading, remote_reading_provider,
                                    has_onpremise, has_cloud, has_ichigo)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            hospital.name,
            hospital.description || null,
            hospital.departments || null,
            hospital.latitude ? parseFloat(hospital.latitude) : null,
            hospital.longitude ? parseFloat(hospital.longitude) : null,
            hospital.address || null,
            hospital.phone || null,
            hospital.website || null,
            hospital.image_url || null,
            has_ct,
            has_mri,
            has_pet,
            has_remote_reading,
            hospital.remote_reading_provider || null,
            has_onpremise,
            has_cloud,
            has_ichigo
          ).run()
          
          successCount++
        }
      } catch (error) {
        errorCount++
        errors.push({ row: i + 1, error: 'データベース登録エラー', detail: String(error) })
      }
    }
    
    return c.json({
      success: true,
      message: `インポート完了: 新規${successCount}件, 更新${updateCount}件, 失敗${errorCount}件`,
      successCount,
      updateCount,
      errorCount,
      errors: errors.length > 0 ? errors : undefined
    })
  } catch (error) {
    console.error('Import error:', error)
    return c.json({ success: false, error: 'インポート処理に失敗しました' }, 500)
  }
})

// Admin page
app.get('/admin', requireAuth, (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Y's READING 管理画面 - Admin</title>
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
            /* Search and filter input fields with light blue background */
            input[type="text"]:not([type="file"]):not([type="hidden"]),
            input[type="search"],
            select {
                background-color: #eff6ff !important; /* Light blue background */
            }
            input[type="text"]:focus:not([type="file"]):not([type="hidden"]),
            input[type="search"]:focus,
            select:focus {
                background-color: #dbeafe !important; /* Slightly darker blue on focus */
            }
            /* Make map and list container responsive to viewport height */
            .map-container {
                height: calc(100vh - 200px);
                min-height: 500px;
            }
            @media (max-width: 1023px) {
                .map-container {
                    height: auto;
                    min-height: auto;
                }
                .mobile-map {
                    height: 400px !important;
                    min-height: 400px;
                }
                .mobile-map #map {
                    height: 400px !important;
                }
                .mobile-list {
                    max-height: 500px;
                }
            }
        </style>
    </head>
    <body class="bg-gray-50">
        <!-- Header -->
        <header class="bg-white shadow-sm border-b">
            <div class="px-4 py-4">
                <div class="flex justify-between items-center">
                    <div>
                        <h1 class="text-2xl font-bold text-blue-600 mb-1"><img src="/static/ys-reading-logo.png" alt="Y's READING" class="h-8 inline-block"></h1>
                        <p class="text-sm text-gray-600 mt-1">Hospital Management Dashboard</p>
                    </div>
                    <div class="flex gap-3 items-center">
                        <a href="/" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition">
                            <i class="fas fa-eye mr-2"></i>
                            閲覧モード
                        </a>
                        <button onclick="showAddModal()" class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition">
                            <i class="fas fa-plus mr-2"></i>
                            新規登録
                        </button>
                        <button onclick="exportToExcel(event)" class="bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 transition">
                            <i class="fas fa-file-download mr-2"></i>
                            エクスポート
                        </button>
                        <button onclick="showImportModal()" class="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition">
                            <i class="fas fa-file-excel mr-2"></i>
                            インポート
                        </button>
                        <button onclick="logout()" class="text-sm text-gray-600 hover:text-gray-800 underline ml-4">
                            ログアウト
                        </button>
                    </div>
                </div>
            </div>
        </header>

        <!-- Main Content -->
        <main class="px-4 py-8">
            <!-- Stats Cards -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div class="bg-white rounded-lg shadow p-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-gray-600 text-sm">総病院数</p>
                            <p id="total-count" class="text-3xl font-bold text-gray-800">0</p>
                        </div>
                        <div class="bg-blue-100 p-3 rounded-full">
                            <i class="fas fa-hospital text-blue-600 text-xl"></i>
                        </div>
                    </div>
                </div>
                <div class="bg-white rounded-lg shadow p-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-gray-600 text-sm">遠隔読影サービス</p>
                            <p id="remote-reading-count" class="text-3xl font-bold text-gray-800">0</p>
                        </div>
                        <div class="bg-purple-100 p-3 rounded-full">
                            <i class="fas fa-network-wired text-purple-600 text-xl"></i>
                        </div>
                    </div>
                </div>
                <div class="bg-white rounded-lg shadow p-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-gray-600 text-sm">ワイズ・リーディング</p>
                            <p id="ys-reading-count" class="text-3xl font-bold text-gray-800">0</p>
                        </div>
                        <div class="bg-indigo-100 p-3 rounded-full flex items-center justify-center">
                            <img src="/static/ys-reading-icon.png" alt="Y's Reading" class="w-6 h-6">
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
                        <label class="block text-sm font-medium text-gray-700 mb-2">遠隔読影サービス</label>
                        <input type="text" id="remote-reading-filter" placeholder="サービス名で検索..." 
                               class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
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
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">病院名</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">遠隔読影サービス</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">住所</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">電話番号</th>
                                <th class="px-6 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">操作</th>
                            </tr>
                        </thead>
                        <tbody id="hospitals-table-body" class="divide-y divide-gray-200">
                            <!-- Data will be loaded here -->
                        </tbody>
                    </table>
                </div>
                <div id="no-data" class="hidden text-center py-12 text-gray-500">
                    <i class="fas fa-inbox text-4xl mb-4"></i>
                    <p>病院が登録されていません</p>
                </div>
            </div>
        </main>

        <!-- Add/Edit Modal -->
        <div id="hospital-modal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-white rounded-lg p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <h3 class="text-2xl font-bold text-gray-800 mb-4" id="modal-title">新規病院登録</h3>
                <form id="hospital-form">
                    <input type="hidden" id="hospital-id">
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div class="md:col-span-2">
                            <label class="block text-gray-700 font-bold mb-2">病院名 *</label>
                            <input type="text" id="hospital-name" required 
                                   class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        </div>
                        
                        <div>
                            <label class="block text-gray-700 font-bold mb-2">診療科目</label>
                            <input type="text" id="hospital-departments" placeholder="例: 内科,外科,小児科"
                                    class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <p class="text-xs text-gray-500 mt-1">カンマ区切りで入力してください</p>
                        </div>
                        
                        <div>
                            <label class="block text-gray-700 font-bold mb-2">電話番号</label>
                            <input type="tel" id="hospital-phone"
                                   class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        </div>
                    </div>
                    
                    <div class="mb-4">
                        <label class="block text-gray-700 font-bold mb-2">説明</label>
                        <textarea id="hospital-description" rows="3"
                                  class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"></textarea>
                    </div>
                    
                    <div class="mb-4">
                        <label class="block text-gray-700 font-bold mb-2">住所</label>
                        <div class="flex gap-2">
                            <input type="text" id="hospital-address"
                                   class="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <button type="button" onclick="geocodeAddress()" 
                                    class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition whitespace-nowrap">
                                <i class="fas fa-map-marker-alt"></i> 座標取得
                            </button>
                        </div>
                        <p class="text-xs text-gray-500 mt-1">住所を入力して「座標取得」ボタンを押すと、自動的に緯度・経度が入力されます</p>
                    </div>
                    
                    <div class="mb-4">
                        <label class="block text-gray-700 font-bold mb-2">医療機器（モダリティ）</label>
                        <div class="space-y-2">
                            <label class="flex items-center">
                                <input type="checkbox" id="hospital-has-ct" class="mr-2">
                                <span class="text-gray-700">CTスキャン</span>
                            </label>
                            <label class="flex items-center">
                                <input type="checkbox" id="hospital-has-mri" class="mr-2">
                                <span class="text-gray-700">MRI</span>
                            </label>
                            <label class="flex items-center">
                                <input type="checkbox" id="hospital-has-pet" class="mr-2">
                                <span class="text-gray-700">PET</span>
                            </label>
                        </div>
                    </div>
                    
                    <div class="mb-4">
                        <label class="flex items-center mb-2">
                            <input type="checkbox" id="hospital-has-remote-reading" class="mr-2">
                            <span class="text-gray-700 font-bold">遠隔読影サービス</span>
                        </label>
                        <input type="text" id="hospital-remote-reading-provider" placeholder="遠隔読影事業者名"
                               class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                    
                    <div class="mb-4">
                        <label class="block text-gray-700 font-bold mb-2">システム構成</label>
                        <div class="space-y-2">
                            <label class="flex items-center">
                                <input type="checkbox" id="hospital-has-onpremise" class="mr-2">
                                <span class="text-gray-700">オンプレ</span>
                            </label>
                            <label class="flex items-center">
                                <input type="checkbox" id="hospital-has-cloud" class="mr-2">
                                <span class="text-gray-700">クラウド</span>
                            </label>
                            <label class="flex items-center">
                                <input type="checkbox" id="hospital-has-ichigo" class="mr-2">
                                <span class="text-gray-700">医知悟</span>
                            </label>
                        </div>
                    </div>
                    
                    <div class="mb-4">
                        <label class="block text-gray-700 font-bold mb-2">ウェブサイト</label>
                        <input type="url" id="hospital-website"
                               class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                    
                    <div class="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label class="block text-gray-700 font-bold mb-2">緯度</label>
                            <input type="number" step="any" id="hospital-lat" placeholder="例: 35.6812"
                                   class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        </div>
                        <div>
                            <label class="block text-gray-700 font-bold mb-2">経度</label>
                            <input type="number" step="any" id="hospital-lng" placeholder="例: 139.7671"
                                   class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        </div>
                    </div>
                    
                    <div class="mb-6">
                        <label class="block text-gray-700 font-bold mb-2">病院画像</label>
                        <input type="file" id="hospital-image" accept="image/*"
                               class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <p class="text-xs text-gray-500 mt-1">JPG, PNG, GIF形式（最大5MB）</p>
                        <input type="hidden" id="hospital-image-url">
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

        <!-- Import Modal -->
        <div id="import-modal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-white rounded-lg p-8 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <h3 class="text-2xl font-bold text-gray-800 mb-4">
                    <i class="fas fa-file-excel mr-2 text-green-600"></i>
                    病院データインポート
                </h3>
                
                <!-- Step 1: File Upload -->
                <div id="import-step-1">
                    <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                        <h4 class="font-bold text-blue-800 mb-2">
                            <i class="fas fa-info-circle mr-2"></i>
                            対応ファイル形式とフォーマット
                        </h4>
                        <ul class="text-sm text-blue-700 space-y-1">
                            <li>• CSV形式（.csv）またはExcel形式（.xlsx）</li>
                            <li>• 必須列: name（病院名）</li>
                            <li>• オプション列: description, departments, latitude, longitude, address, phone, website, business_hours, closed_days, parking, emergency</li>
                            <li>• 1行目は列名として扱われます</li>
                        </ul>
                    </div>
                    
                    <div class="mb-6">
                        <label class="block text-gray-700 font-bold mb-2">ファイル選択</label>
                        <input type="file" id="import-file" accept=".csv,.xlsx" 
                               class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <p class="text-xs text-gray-500 mt-1">CSV または Excel ファイルを選択してください</p>
                    </div>
                    
                    <div class="flex gap-2">
                        <button onclick="parseImportFile()" 
                                class="flex-1 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition">
                            <i class="fas fa-search mr-2"></i>
                            データを確認
                        </button>
                        <button onclick="closeImportModal()" 
                                class="flex-1 bg-gray-400 text-white px-6 py-2 rounded-lg hover:bg-gray-500 transition">
                            <i class="fas fa-times mr-2"></i>
                            キャンセル
                        </button>
                    </div>
                </div>
                
                <!-- Step 2: Preview and Import -->
                <div id="import-step-2" class="hidden">
                    <div class="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                        <p class="text-green-800">
                            <i class="fas fa-check-circle mr-2"></i>
                            <span id="preview-count">0</span>件のデータが検出されました
                        </p>
                    </div>
                    
                    <div class="mb-4 max-h-96 overflow-auto border rounded-lg">
                        <table class="min-w-full bg-white">
                            <thead class="bg-gray-100 sticky top-0">
                                <tr>
                                    <th class="px-4 py-2 text-left text-sm font-bold text-gray-700">#</th>
                                    <th class="px-4 py-2 text-left text-sm font-bold text-gray-700">病院名</th>
                                    <th class="px-4 py-2 text-left text-sm font-bold text-gray-700">診療科目</th>
                                    <th class="px-4 py-2 text-left text-sm font-bold text-gray-700">座標状態</th>
                                    <th class="px-4 py-2 text-left text-sm font-bold text-gray-700">住所</th>
                                </tr>
                            </thead>
                            <tbody id="preview-table-body">
                                <!-- Preview data will be inserted here -->
                            </tbody>
                        </table>
                    </div>
                    
                    <div id="import-errors" class="hidden mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
                        <p class="text-red-800 font-bold mb-2">
                            <i class="fas fa-exclamation-triangle mr-2"></i>
                            エラーが検出されました
                        </p>
                        <ul id="error-list" class="text-sm text-red-700 space-y-1">
                            <!-- Errors will be listed here -->
                        </ul>
                    </div>
                    
                    <div class="flex gap-2">
                        <button onclick="executeImport()" 
                                class="flex-1 bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition">
                            <i class="fas fa-upload mr-2"></i>
                            インポート実行
                        </button>
                        <button onclick="resetImport()" 
                                class="flex-1 bg-gray-400 text-white px-6 py-2 rounded-lg hover:bg-gray-500 transition">
                            <i class="fas fa-redo mr-2"></i>
                            やり直し
                        </button>
                    </div>
                </div>
                
                <!-- Loading Indicator -->
                <div id="import-loading" class="hidden text-center py-8">
                    <i class="fas fa-spinner fa-spin text-4xl text-blue-600 mb-4"></i>
                    <p class="text-gray-700">処理中...</p>
                </div>
            </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>
        <script>
            async function logout() {
                try {
                    await axios.post('/api/auth/logout');
                    window.location.href = '/login';
                } catch (error) {
                    console.error('Logout failed:', error);
                    alert('ログアウトに失敗しました');
                }
            }
        </script>
        <script src="/static/admin.js"></script>
        <!-- Google Maps API for geocoding -->
        <script async defer src="https://maps.googleapis.com/maps/api/js?key=AIzaSyCEzrU58Z2R4awlzt8kBitIIpW-wILqzSk&libraries=places"></script>
        
        <!-- Footer -->
        <footer class="bg-gray-800 text-white py-4 mt-8">
            <div class="container mx-auto px-4 text-center">
                <p class="text-sm">© 2025 Y'sBESPOKE Co., Ltd.</p>
            </div>
        </footer>
    </body>
    </html>
  `)
})

// Login page
app.get('/login', (c) => {
  // If already authenticated, redirect to main page
  if (isAuthenticated(c)) {
    return c.redirect('/')
  }
  
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ログイン - Y's READING</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen flex flex-col">
        <div class="container mx-auto px-4 flex-grow flex items-center justify-center">
            <div class="max-w-md mx-auto w-full">
                <!-- Logo and Title -->
                <div class="text-center mb-8">
                    <h1 class="text-4xl font-bold mb-2"><img src="/static/ys-reading-logo.png" alt="Y's READING" class="h-12 inline-block"></h1>
                    <p class="text-gray-600">管理者ログイン</p>
                </div>

                <!-- Login Card -->
                <div class="bg-white rounded-lg shadow-xl p-8">
                    <form id="login-form">
                        <div class="mb-6">
                            <label class="block text-gray-700 font-bold mb-2">
                                <i class="fas fa-user mr-2"></i>
                                ユーザー名
                            </label>
                            <input type="text" id="username" required 
                                   class="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                   placeholder="ユーザー名を入力">
                        </div>
                        
                        <div class="mb-6">
                            <label class="block text-gray-700 font-bold mb-2">
                                <i class="fas fa-lock mr-2"></i>
                                パスワード
                            </label>
                            <input type="password" id="password" required 
                                   class="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                   placeholder="パスワードを入力">
                        </div>

                        <div id="error-message" class="hidden mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
                            <i class="fas fa-exclamation-circle mr-2"></i>
                            <span id="error-text"></span>
                        </div>
                        
                        <button type="submit" 
                                class="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition flex items-center justify-center gap-2">
                            <i class="fas fa-sign-in-alt"></i>
                            ログイン
                        </button>
                    </form>
                </div>
            </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
            const form = document.getElementById('login-form');
            const errorMessage = document.getElementById('error-message');
            const errorText = document.getElementById('error-text');

            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const username = document.getElementById('username').value;
                const password = document.getElementById('password').value;

                try {
                    const response = await axios.post('/api/auth/login', {
                        username,
                        password
                    });

                    if (response.data.success) {
                        window.location.href = '/';
                    }
                } catch (error) {
                    errorMessage.classList.remove('hidden');
                    errorText.textContent = error.response?.data?.error || 'ログインに失敗しました';
                }
            });
        </script>
        
        <!-- Footer -->
        <footer class="bg-gray-800 text-white py-4 mt-auto">
            <div class="container mx-auto px-4 text-center">
                <p class="text-sm">© 2025 Y'sBESPOKE Co., Ltd.</p>
            </div>
        </footer>
    </body>
    </html>
  `)
})

// Top page (requires authentication)
app.get('/', requireAuth, (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Y's READING（閲覧専用）</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <style>
            #map {
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
            .line-clamp-2 {
                overflow: hidden;
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
            }
            /* Search and filter input fields with light blue background */
            input[type="text"]:not([type="file"]):not([type="hidden"]),
            input[type="search"],
            select {
                background-color: #eff6ff !important; /* Light blue background */
            }
            input[type="text"]:focus:not([type="file"]):not([type="hidden"]),
            input[type="search"]:focus,
            select:focus {
                background-color: #dbeafe !important; /* Slightly darker blue on focus */
            }
            /* Make map and list container responsive to viewport height */
            body {
                overflow: hidden;
            }
            .map-container {
                height: calc(100vh - 180px);
            }
            @media (max-width: 1023px) {
                .map-container {
                    height: calc(100vh - 220px);
                }
                .mobile-map {
                    height: 50vh !important;
                    min-height: 300px;
                }
                .mobile-map #map {
                    height: 100% !important;
                }
                .mobile-list {
                    height: calc(50vh - 220px);
                    overflow-y: auto;
                }
            }
        </style>
    </head>
    <body class="bg-gray-50 h-screen flex flex-col overflow-hidden">
        <div class="px-4 py-4 flex-shrink-0">
            <div class="mb-4 flex justify-between items-center">
                <div>
                    <h1 class="text-2xl font-bold text-blue-600 mb-1"><img src="/static/ys-reading-logo.png" alt="Y's READING" class="h-8 inline-block"></h1>
                    <p class="text-sm text-gray-600 mt-1">Hospital Management Dashboard</p>
                </div>
                <div id="header-buttons">
                    <!-- Login link will be shown here for non-authenticated users -->
                </div>
            </div>

            <!-- Map and Facility List Container (Responsive Layout) -->
            <div class="flex flex-col lg:flex-row gap-4 map-container flex-1 overflow-hidden">
                <!-- Map Container (Top on mobile, Left on desktop) -->
                <div class="flex-1 bg-white rounded-lg shadow-lg overflow-hidden mobile-map h-full">
                    <div id="map" class="h-full w-full"></div>
                </div>

                <!-- Facility List (Bottom on mobile, Right on desktop) -->
                <div class="w-full lg:w-72 bg-white rounded-lg shadow-lg p-3 flex flex-col mobile-list h-full overflow-hidden">
                    <h2 class="text-lg font-bold text-gray-800 mb-3 flex-shrink-0">
                        <i class="fas fa-list mr-2"></i>
                        登録施設一覧
                    </h2>
                    
                    <!-- Search and Filter -->
                    <div class="mb-3 space-y-2 flex-shrink-0">
                        <div>
                            <label class="block text-xs font-medium text-gray-700 mb-1">施設名</label>
                            <input type="text" id="map-search-input" placeholder="施設名で検索..." 
                                   class="w-full px-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        </div>
                        <div>
                            <label class="block text-xs font-medium text-gray-700 mb-1">遠隔読影サービス</label>
                            <input type="text" id="map-remote-reading-filter" placeholder="事業者名で検索..." 
                                   class="w-full px-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        </div>
                    </div>
                    
                    <!-- Scrollable Facility List -->
                    <div class="flex-1 overflow-y-auto pr-2">
                        <div id="hospital-list" class="space-y-2">
                            <!-- Hospitals will be loaded here -->
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="/static/view.js"></script>
        <!-- Google Maps API -->
        <script async defer src="https://maps.googleapis.com/maps/api/js?key=AIzaSyCEzrU58Z2R4awlzt8kBitIIpW-wILqzSk&libraries=places&callback=initMap"></script>
        <script>
            // Check authentication status and show appropriate links
            async function checkAuth() {
                try {
                    const response = await axios.get('/api/auth/status');
                    const buttonsContainer = document.getElementById('header-buttons');
                    
                    if (response.data.authenticated) {
                        // Show admin link and logout for authenticated users
                        buttonsContainer.innerHTML = \`
                            <div class="flex items-center gap-3">
                                <a href="/admin" class="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow hover:bg-indigo-700 transition">
                                    <i class="fas fa-cog"></i>
                                    管理画面
                                </a>
                                <button onclick="logout()" class="text-sm text-gray-600 hover:text-gray-800 underline">
                                    ログアウト
                                </button>
                            </div>
                        \`;
                    } else {
                        // Show lock icon button for non-authenticated users
                        buttonsContainer.innerHTML = \`
                            <a href="/login" class="inline-flex items-center justify-center w-10 h-10 bg-gray-600 text-white rounded-lg shadow hover:bg-gray-700 transition">
                                <i class="fas fa-lock"></i>
                            </a>
                        \`;
                    }
                } catch (error) {
                    console.error('Failed to check auth status:', error);
                }
            }
            
            async function logout() {
                try {
                    await axios.post('/api/auth/logout');
                    window.location.href = '/login';
                } catch (error) {
                    console.error('Logout failed:', error);
                }
            }
            
            // Check auth on page load
            checkAuth();
        </script>
        <script src="/static/view.js"></script>
        
        <!-- Footer -->
        <footer class="bg-gray-800 text-white py-2 flex-shrink-0">
            <div class="container mx-auto px-4 text-center">
                <p class="text-xs">© 2025 Y'sBESPOKE Co., Ltd.</p>
            </div>
        </footer>
    </body>
    </html>
  `)
})

// Edit page (requires authentication)
app.get('/edit', requireAuth, (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Y's READING - 編集モード</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <style>
            #map {
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
            .admin-button {
                position: relative;
                background: #6366f1;
                border: 2px solid rgba(255, 255, 255, 0.2);
            }
            .admin-button:hover {
                background: #4f46e5;
            }
            .admin-button:active {
                transform: scale(0.98);
            }
            /* Make page fit without scrolling */
            body {
                overflow: hidden;
            }
            .map-container {
                height: calc(100vh - 200px);
            }
            @media (max-width: 1023px) {
                .map-container {
                    height: calc(100vh - 240px);
                }
            }
        </style>
    </head>
    <body class="bg-gray-50 h-screen flex flex-col overflow-hidden">
        <div class="px-4 py-4 flex-shrink-0">
            <div class="mb-4 flex justify-between items-center">
                <div>
                    <h1 class="text-4xl font-bold mb-1"><img src="/static/ys-reading-logo.png" alt="Y's READING" class="h-12 inline-block"></h1>
                    <p class="text-gray-600">編集モード</p>
                </div>
                <div class="flex gap-3 items-center">
                    <button onclick="showNewHospitalForm()" class="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white font-semibold rounded-lg shadow hover:bg-green-700 transition">
                        <i class="fas fa-plus"></i>
                        新規作成
                    </button>
                    <a href="/admin" class="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow hover:bg-indigo-700 transition">
                        <i class="fas fa-cog"></i>
                        管理画面
                    </a>
                    <button onclick="logout()" class="text-sm text-gray-600 hover:text-gray-800 underline">
                        ログアウト
                    </button>
                </div>
            </div>

            <!-- Map and Facility List Container (Horizontal Layout) -->
            <div class="flex flex-col lg:flex-row gap-4 map-container flex-1 overflow-hidden">
                <!-- Map Container (Left Side) -->
                <div class="flex-1 bg-white rounded-lg shadow-lg p-3 h-full overflow-hidden">
                    <div id="map" class="rounded-lg h-full w-full"></div>
                </div>

                <!-- Facility List (Right Side - Vertical Panel) -->
                <div class="lg:w-72 bg-white rounded-lg shadow-lg p-5 flex flex-col h-full">
                    <h2 class="text-2xl font-bold text-gray-800 mb-4 flex-shrink-0">
                        <i class="fas fa-list mr-2"></i>
                        登録施設一覧
                    </h2>
                    
                    <!-- Search and Filter -->
                    <div class="mb-4 space-y-3 flex-shrink-0">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">施設名</label>
                            <input type="text" id="map-search-input" placeholder="施設名で検索..." 
                                   class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">遠隔読影サービス</label>
                            <input type="text" id="map-remote-reading-filter" placeholder="事業者名で検索..." 
                                   class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        </div>
                    </div>
                    
                    <!-- Scrollable Facility List -->
                    <div class="flex-1 overflow-y-auto pr-2">
                        <div id="hospital-list" class="space-y-2">
                            <!-- Hospitals will be loaded here -->
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Hospital Form Modal -->
        <div id="hospital-modal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center overflow-y-auto py-8" style="z-index: 9999;">
            <div class="bg-white rounded-lg p-8 max-w-md w-full mx-4 my-auto max-h-[90vh] overflow-y-auto">
                <h3 class="text-2xl font-bold text-gray-800 mb-4" id="modal-title">新規病院登録</h3>
                <form id="hospital-form">
                    <input type="hidden" id="hospital-id">
                    
                    <div class="mb-4">
                        <label class="block text-gray-700 font-bold mb-2">病院名 *</label>
                        <input type="text" id="hospital-name" required 
                               class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                    
                    <div class="mb-4">
                        <label class="block text-gray-700 font-bold mb-2">診療科目</label>
                        <input type="text" id="hospital-departments" placeholder="例: 内科,外科,小児科"
                                class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <p class="text-xs text-gray-500 mt-1">カンマ区切りで入力してください</p>
                    </div>
                    
                    <div class="mb-4">
                        <label class="block text-gray-700 font-bold mb-2">説明</label>
                        <textarea id="hospital-description" rows="3"
                                  class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"></textarea>
                    </div>
                    
                    <div class="mb-4">
                        <label class="block text-gray-700 font-bold mb-2">住所</label>
                        <div class="flex gap-2">
                            <input type="text" id="hospital-address"
                                   class="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <button type="button" onclick="geocodeAddress()" 
                                    class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition whitespace-nowrap">
                                <i class="fas fa-map-marker-alt"></i> 座標取得
                            </button>
                        </div>
                        <p class="text-xs text-gray-500 mt-1">住所を入力して「座標取得」ボタンを押すと、自動的に緯度・経度が入力されます</p>
                    </div>
                    
                    <div class="mb-4">
                        <label class="block text-gray-700 font-bold mb-2">電話番号</label>
                        <input type="tel" id="hospital-phone"
                               class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                    
                    <div class="mb-4">
                        <label class="block text-gray-700 font-bold mb-2">医療機器（モダリティ）</label>
                        <div class="space-y-2">
                            <label class="flex items-center">
                                <input type="checkbox" id="hospital-has-ct" class="mr-2">
                                <span class="text-gray-700">CTスキャン</span>
                            </label>
                            <label class="flex items-center">
                                <input type="checkbox" id="hospital-has-mri" class="mr-2">
                                <span class="text-gray-700">MRI</span>
                            </label>
                            <label class="flex items-center">
                                <input type="checkbox" id="hospital-has-pet" class="mr-2">
                                <span class="text-gray-700">PET</span>
                            </label>
                        </div>
                    </div>
                    
                    <div class="mb-4">
                        <label class="flex items-center mb-2">
                            <input type="checkbox" id="hospital-has-remote-reading" class="mr-2">
                            <span class="text-gray-700 font-bold">遠隔読影サービス</span>
                        </label>
                        <input type="text" id="hospital-remote-reading-provider" placeholder="遠隔読影事業者名"
                               class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                    
                    <div class="mb-4">
                        <label class="block text-gray-700 font-bold mb-2">システム構成</label>
                        <div class="space-y-2">
                            <label class="flex items-center">
                                <input type="checkbox" id="hospital-has-onpremise" class="mr-2">
                                <span class="text-gray-700">オンプレ</span>
                            </label>
                            <label class="flex items-center">
                                <input type="checkbox" id="hospital-has-cloud" class="mr-2">
                                <span class="text-gray-700">クラウド</span>
                            </label>
                            <label class="flex items-center">
                                <input type="checkbox" id="hospital-has-ichigo" class="mr-2">
                                <span class="text-gray-700">医知悟</span>
                            </label>
                        </div>
                    </div>
                    
                    <div class="mb-4">
                        <label class="block text-gray-700 font-bold mb-2">ウェブサイト</label>
                        <input type="url" id="hospital-website"
                               class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                    
                    <div class="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label class="block text-gray-700 font-bold mb-2">緯度</label>
                            <input type="number" step="any" id="hospital-lat" placeholder="例: 35.6812"
                                   class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        </div>
                        <div>
                            <label class="block text-gray-700 font-bold mb-2">経度</label>
                            <input type="number" step="any" id="hospital-lng" placeholder="例: 139.7671"
                                   class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        </div>
                    </div>
                    
                    <div class="mb-6">
                        <label class="block text-gray-700 font-bold mb-2">病院画像</label>
                        <input type="file" id="hospital-image" accept="image/*"
                               class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <p class="text-xs text-gray-500 mt-1">JPG, PNG, GIF形式（最大5MB）</p>
                        <input type="hidden" id="hospital-image-url">
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

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
            async function logout() {
                try {
                    await axios.post('/api/auth/logout');
                    window.location.href = '/login';
                } catch (error) {
                    console.error('Logout failed:', error);
                    alert('ログアウトに失敗しました');
                }
            }
        </script>
        <script src="/static/app.js"></script>
        <!-- Google Maps API -->
        <script async defer src="https://maps.googleapis.com/maps/api/js?key=AIzaSyCEzrU58Z2R4awlzt8kBitIIpW-wILqzSk&libraries=places&callback=initMap"></script>
        
        <!-- Footer -->
        <footer class="bg-gray-800 text-white py-2 flex-shrink-0">
            <div class="container mx-auto px-4 text-center">
                <p class="text-xs">© 2025 Y'sBESPOKE Co., Ltd.</p>
            </div>
        </footer>
    </body>
    </html>
  `)
})

export default app
