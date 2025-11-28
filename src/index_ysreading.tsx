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
    const filename = `hospital-${timestamp}-${randomStr}.${extension}`
    
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
    ).bind(
      name, 
      description || null, 
      departments || null, 
      latitude, 
      longitude, 
      address || null, 
      phone || null, 
      website || null, 
      image_url || null,
      has_ct ? 1 : 0,
      has_mri ? 1 : 0,
      has_pet ? 1 : 0,
      has_remote_reading ? 1 : 0,
      remote_reading_provider || null,
      has_onpremise ? 1 : 0,
      has_cloud ? 1 : 0,
      has_ichigo ? 1 : 0
    ).run()
    
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
           has_onpremise = ?, has_cloud = ?, has_ichigo = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).bind(
      name, 
      description || null, 
      departments || null, 
      latitude, 
      longitude, 
      address || null, 
      phone || null, 
      website || null, 
      image_url || null,
      has_ct ? 1 : 0,
      has_mri ? 1 : 0,
      has_pet ? 1 : 0,
      has_remote_reading ? 1 : 0,
      remote_reading_provider || null,
      has_onpremise ? 1 : 0,
      has_cloud ? 1 : 0,
      has_ichigo ? 1 : 0,
      id
    ).run()
    
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

// Delete all hospitals
app.delete('/api/hospitals', async (c) => {
  try {
    const result = await c.env.DB.prepare(
      'DELETE FROM hospitals'
    ).run()
    
    return c.json({ 
      success: true, 
      message: `${result.meta.changes}件の病院を削除しました`,
      deletedCount: result.meta.changes
    })
  } catch (error) {
    return c.json({ success: false, error: 'Failed to delete hospitals' }, 500)
  }
})

// Export hospitals to CSV
app.get('/api/hospitals/export', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      'SELECT * FROM hospitals ORDER BY created_at DESC'
    ).all()
    
    // UTF-8 BOM for Excel compatibility
    let csv = '\uFEFF'
    
    // CSV header
    csv += 'ID,施設名,説明,診療科目,緯度,経度,住所,電話番号,ウェブサイト,画像URL,CT,MRI,PET,遠隔読影サービス,遠隔読影事業者,オンプレ,クラウド,医知悟,作成日時,更新日時\n'
    
    // Add data rows
    for (const hospital of results) {
      csv += [
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
      ].join(',') + '\n'
    }
    
    const filename = `hospitals_export_${new Date().toISOString().split('T')[0]}.csv`
    
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    })
  } catch (error) {
    console.error('Export error:', error)
    return c.json({ success: false, error: 'Failed to export hospitals' }, 500)
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
      
      // Validate required field (name)
      if (!hospital.name) {
        errorCount++
        errors.push({ row: i + 1, error: '必須項目（施設名）が不足しています' })
        continue
      }
      
      try {
        // Convert boolean-like values
        const has_ct = [true, 'true', '有', '1', 1].includes(hospital.has_ct) ? 1 : 0
        const has_mri = [true, 'true', '有', '1', 1].includes(hospital.has_mri) ? 1 : 0
        const has_pet = [true, 'true', '有', '1', 1].includes(hospital.has_pet) ? 1 : 0
        const has_remote_reading = [true, 'true', '有', '1', 1].includes(hospital.has_remote_reading) ? 1 : 0
        const has_onpremise = [true, 'true', '有', '1', 1].includes(hospital.has_onpremise) ? 1 : 0
        const has_cloud = [true, 'true', '有', '1', 1].includes(hospital.has_cloud) ? 1 : 0
        const has_ichigo = [true, 'true', '有', '1', 1].includes(hospital.has_ichigo) ? 1 : 0
        
        // Check if hospital exists (by name and address)
        const { results: existing } = await c.env.DB.prepare(
          'SELECT id FROM hospitals WHERE name = ? AND address = ?'
        ).bind(hospital.name, hospital.address || '').all()
        
        if (existing && existing.length > 0) {
          // Update existing hospital
          await c.env.DB.prepare(
            `UPDATE hospitals SET
              description = ?, departments = ?, latitude = ?, longitude = ?, phone = ?, website = ?, image_url = ?,
              has_ct = ?, has_mri = ?, has_pet = ?, has_remote_reading = ?, remote_reading_provider = ?,
              has_onpremise = ?, has_cloud = ?, has_ichigo = ?, updated_at = CURRENT_TIMESTAMP
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
      message: `インポート完了: ${successCount}件新規作成, ${updateCount}件更新, ${errorCount}件失敗`,
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

// Temporary migration endpoint for system types
app.post('/api/migrate/add-system-types', async (c) => {
  try {
    // Add system type columns if they don't exist
    await c.env.DB.prepare(`
      ALTER TABLE hospitals ADD COLUMN has_onpremise BOOLEAN DEFAULT 0;
    `).run().catch(() => {})
    
    await c.env.DB.prepare(`
      ALTER TABLE hospitals ADD COLUMN has_cloud BOOLEAN DEFAULT 0;
    `).run().catch(() => {})
    
    await c.env.DB.prepare(`
      ALTER TABLE hospitals ADD COLUMN has_ichigo BOOLEAN DEFAULT 0;
    `).run().catch(() => {})
    
    return c.json({ success: true, message: 'Migration applied successfully' })
  } catch (error) {
    return c.json({ success: false, error: 'Migration failed', details: error.message }, 500)
  }
})

export default app
