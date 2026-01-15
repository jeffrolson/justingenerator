import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { Firebase } from './lib/firebase'
import { getStripe } from './lib/stripe'
import { Analytics } from './lib/analytics'

type Bindings = {
  FIREBASE_PROJECT_ID: string
  FIREBASE_CLIENT_EMAIL: string
  FIREBASE_PRIVATE_KEY: string
  FIREBASE_DATABASE_ID?: string
  GEMINI_API_KEY?: string
  STRIPE_SECRET_KEY: string
  STRIPE_WEBHOOK_SECRET: string
  BUCKET: R2Bucket
  AI: Ai
}

type Variables = {
  firebase: Firebase
  analytics: Analytics
  user: any // Payload from JWT
}

const PRESETS = [
  {
    id: 'cyberpunk',
    title: 'Cyberpunk',
    description: 'Neon-drenched futuristic style',
    prompt: 'A futuristic cyberpunk portrait, neon lights, high tech, highly detailed, cinematic lighting',
    tags: ['cyberpunk', 'futuristic', 'neon', 'sci-fi'],
    sampleUrl: '/examples/cyberpunk.png'
  },
  {
    id: 'vintage-90s',
    title: 'Vintage 90s',
    description: 'Nostalgic disposable camera look',
    prompt: 'A vintage 90s disposable camera photo, heavy flash, grainy texture, nostalgic atmosphere, suburban setting',
    tags: ['vintage', '90s', 'retro', 'film'],
    sampleUrl: '/examples/vintage.png'
  },
  {
    id: 'oil-painting',
    title: 'Oil Painting',
    description: 'Classical masterpiece aesthetic',
    prompt: 'A classical oil painting portrait, visible brushstrokes, textured canvas, dramatic chiaroscuro lighting, museum quality',
    tags: ['art', 'painting', 'classical', 'oil'],
    sampleUrl: '/examples/painting.png'
  },
  {
    id: 'anime',
    title: 'Anime',
    description: 'Clean and vibrant cel-shaded style',
    prompt: 'A clean anime style portrait, cel-shaded, vibrant colors, expressive lines, studio ghibli inspired background',
    tags: ['anime', 'illustration', 'vibrant', 'cartoon'],
    sampleUrl: 'https://images.unsplash.com/photo-1578632292335-df3abbb0d586?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'pencil-sketch',
    title: 'Pencil Sketch',
    description: 'Hand-drawn artistic charcoal look',
    prompt: 'A hand-drawn pencil and charcoal sketch portrait, detailed cross-hatching, artistic paper texture, expressive graphite strokes',
    tags: ['sketch', 'drawing', 'artistic', 'charcoal'],
    sampleUrl: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=800&q=80'
  }
]

const app = new Hono<{ Bindings: Bindings, Variables: Variables }>()

app.use('/*', cors())

// Middleware to initialize Firebase and Auth
app.use('/api/*', async (c, next) => {
  // Skip auth for webhooks
  if (c.req.path.includes('/stripe/webhook')) {
    return next()
  }

  const firebase = new Firebase(c.env)
  const analytics = new Analytics(firebase)

  c.set('firebase', firebase)
  c.set('analytics', analytics)

  // Authentication Middleware
  const path = c.req.path
  const isPublic = path === '/' ||
    path === '/api/auth/verify' ||
    path === '/api/debug' ||
    path === '/api/presets' ||
    path.startsWith('/stripe/webhook') ||
    path.includes('/image/') ||
    path.startsWith('/api/public/')

  if (!isPublic) {
    const authHeader = c.req.header('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized' }, 401)
    }
    const token = authHeader.split(' ')[1]
    try {
      const payload = await firebase.verifyToken(token)
      c.set('user', payload)
    } catch (e) {
      return c.json({ error: 'Invalid token' }, 401)
    }
  }
  await next()
})

app.get('/', (c) => {
  return c.text('Justin Generator API')
})

// Client-side event logging
app.post('/api/events', async (c) => {
  const analytics = c.get('analytics')
  const user = c.get('user')
  let body: any = {}
  try {
    body = await c.req.json()
  } catch (e) {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const { eventType, metadata } = body
  if (!eventType) return c.json({ error: 'Missing eventType' }, 400)

  // We await this one to ensure client knows it succeeded, but we could also fire-and-forget
  await analytics.logEvent(
    eventType,
    user?.sub, // Might be undefined if public event (handled by middleware if auth required)
    metadata,
    { ip: c.req.header('CF-Connecting-IP'), userAgent: c.req.header('User-Agent') }
  )

  return c.json({ status: 'ok' })
})

// Auth: Verify token and sync user to Firestore
app.post('/api/auth/verify', async (c) => {
  let body: any = {}
  try {
    body = await c.req.json()
  } catch (e) {
    return c.json({ error: "Failed to parse request JSON", details: { raw: await c.req.text() } }, 400)
  }

  const { token } = body
  const firebase = c.get('firebase')

  console.log(`[Verify] Starting for project: ${firebase.projectId}`)

  try {
    if (!token) throw new Error("No token provided in request body")

    // 1. Verify Token
    console.log(`[Verify] Verifying token (length: ${token.length})`)
    const payload = await firebase.verifyToken(token)
    const uid = payload.sub
    console.log(`[Verify] Token verified for UID: ${uid}`)

    // 2. Fetch/Create User in Firestore
    let userDoc: any
    try {
      userDoc = await firebase.firestore('GET', `users/${uid}`)
      console.log(`[Verify] Firestore GET user: ${userDoc ? 'Found' : 'Not Found'}`)
    } catch (fe: any) {
      console.error(`[Verify] Firestore GET failed:`, fe.message)
      throw new Error(`Cloud Firestore access failed: ${fe.message}`)
    }

    if (!userDoc) {
      console.log(`[Verify] Creating new user: ${uid}`)
      try {
        userDoc = await firebase.firestore('PATCH', `users/${uid}`, {
          fields: {
            email: { stringValue: payload.email },
            name: { stringValue: payload.name || 'Anonymous' },
            credits: { integerValue: 5 }, // Free 5 credits
            createdAt: { timestampValue: new Date().toISOString() }
          }
        })

        if (!userDoc) {
          console.error(`[Verify] PATCH returned null for users/${uid}`)
          throw new Error("Backend failed to create user record (404 on PATCH)")
        }

        console.log(`[Verify] User created successfully:`, !!userDoc.fields)
      } catch (ce: any) {
        console.error(`[Verify] Firestore CREATE failed:`, ce.message)
        throw new Error(`Failed to initialize user in database: ${ce.message}`)
      }
    }

    if (!userDoc || !userDoc.fields) {
      console.error(`[Verify] userDoc missing fields:`, JSON.stringify(userDoc))
      throw new Error("User record found but data is corrupted or missing fields")
    }

    // Log successful login/signup
    const analytics = c.get('analytics')
    c.executionCtx.waitUntil(analytics.logEvent(
      'user_login',
      uid,
      { email: payload.email, isNewUser: !userDoc },
      { ip: c.req.header('CF-Connecting-IP') || 'unknown', userAgent: c.req.header('User-Agent') }
    ))

    return c.json({ status: 'ok', user: userDoc.fields })
  } catch (e: any) {
    const errorDetails = {
      message: e.message,
      stack: e.stack,
      projectId: firebase.projectId,
      tokenLength: token?.length,
      tokenPrefix: token?.substring(0, 10),
      cause: e.cause
    }
    console.error("Auth Verify Full Error:", errorDetails)
    return c.json({ error: e.message, details: errorDetails }, 400)
  }
})

// Generate: Upload Image -> AI -> Store Result
app.post('/api/generate', async (c) => {
  const user = c.get('user')
  const firebase = c.get('firebase')

  // 1. Check credits
  const userDoc: any = await firebase.firestore('GET', `users/${user.sub}`)
  const credits = parseInt(userDoc.fields?.credits?.integerValue || '0')
  const analytics = c.get('analytics')

  if (credits < 1) {
    c.executionCtx.waitUntil(analytics.logEvent('generate_failed', user.sub, { reason: 'insufficient_credits', credits }))
    return c.json({ error: 'Insufficient credits' }, 402)
  }

  // 2. Handle Upload
  let body;
  try {
    body = await c.req.parseBody()
  } catch (e) {
    return c.json({ error: 'Invalid form data' }, 400)
  }

  const file = body['image'] as File
  const presetId = body['presetId'] as string
  const remixFrom = body['remixFrom'] as string
  // To track usage if it came from a stored prompt
  let storedPromptId: string | undefined = undefined;

  let prompt = 'A stylish portrait'

  if (presetId) {
    const preset = PRESETS.find(p => p.id === presetId)
    if (preset) {
      prompt = preset.prompt
    } else {
      // Check stored prompts
      try {
        const stored = await firebase.firestore('GET', `stored_prompts/${presetId}`) as any;
        if (stored && stored.fields) {
          prompt = stored.fields.prompt?.stringValue;
          storedPromptId = presetId;
        }
      } catch (e) {
        console.warn(`Preset ${presetId} not found in hardcoded or stored list`);
      }
    }
  } else if (remixFrom) {
    if (remixFrom.startsWith('seed-')) {
      const presetId = remixFrom.replace('seed-', '')
      const preset = PRESETS.find(p => p.id === presetId)
      if (preset) {
        prompt = preset.prompt
        console.log(`Remixing from seed preset: ${presetId}`)
      } else {
        // Check stored prompts for seed remix
        try {
          const stored = await firebase.firestore('GET', `stored_prompts/${presetId}`) as any;
          if (stored && stored.fields) {
            prompt = stored.fields.prompt?.stringValue;
            storedPromptId = presetId;
          }
        } catch (e) {
          console.warn(`Remix seed preset ${presetId} not found`);
        }
      }
    } else {
      try {
        const sourceGen: any = await firebase.firestore('GET', `generations/${remixFrom}`)
        if (sourceGen && sourceGen.fields?.prompt?.stringValue) {
          prompt = sourceGen.fields.prompt.stringValue
          console.log(`Remixing from ${remixFrom}. Using hidden prompt: ${prompt.substring(0, 50)}...`)
        }
      } catch (e) {
        console.warn(`Failed to fetch remix source ${remixFrom}, falling back to provided prompt`)
      }
    }
  }

  c.executionCtx.waitUntil(analytics.logEvent(
    'generate_started',
    user.sub,
    { prompt, presetId: presetId || storedPromptId || 'custom', creditsBefore: credits, remixFrom }
  ))

  if (!file) {
    return c.json({ error: 'No image uploaded' }, 400)
  }

  const fileExt = file.name.split('.').pop() || 'jpg'
  const genId = crypto.randomUUID()
  const uploadPath = `uploads/${user.sub}/${genId}.${fileExt}`
  const resultPath = `generations/${user.sub}/${genId}.png`

  // Upload to R2
  await c.env.BUCKET.put(uploadPath, await file.arrayBuffer(), {
    customMetadata: { userId: user.sub }
  })

  // 3. Deduct Credit (Optimistic)
  await firebase.firestore('PATCH', `users/${user.sub}?updateMask.fieldPaths=credits`, {
    fields: { credits: { integerValue: credits - 1 } }
  })

  // 4. Generate Image
  let aiImage: ArrayBuffer
  const start = Date.now()

  try {
    if (!c.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured')
    }

    console.log(`Starting generation with prompt: ${prompt}`)

    const fileData = await file.arrayBuffer()
    // Use Buffer for more efficient Base64 conversion (requires nodejs_compat)
    const base64Image = Buffer.from(fileData).toString('base64')

    // Using gemini-2.5-flash-image for speed (Nano Banana)
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${c.env.GEMINI_API_KEY}`

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: file.type || 'image/jpeg',
                data: base64Image
              }
            }
          ]
        }],
        generationConfig: {
          responseModalities: ['IMAGE'],
        }
      })
    })

    console.log(`Gemini response status: ${response.status} (took ${Date.now() - start}ms)`)

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Gemini API error: ${response.status} ${errorText}`)
    }

    const result = await response.json() as any
    const imagePart = result.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)

    if (!imagePart) {
      throw new Error('No image returned from Gemini')
    }

    // Convert base64 back to ArrayBuffer using Buffer
    aiImage = Buffer.from(imagePart.inlineData.data, 'base64').buffer
    console.log(`Generation successful! Processing took ${Date.now() - start}ms`)
  } catch (e: any) {
    // Refund credit on failure
    await firebase.firestore('PATCH', `users/${user.sub}?updateMask.fieldPaths=credits`, {
      fields: { credits: { integerValue: credits } }
    })
    return c.json({ error: `AI Generation failed: ${e.message}` }, 500)
  }

  // 5. Generate Summary (1-phrase)
  let summary = prompt
  try {
    const geminiSummaryUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${c.env.GEMINI_API_KEY}`
    const summaryRes = await fetch(geminiSummaryUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [{ text: `Summarize this image generation prompt into a single short catchy phrase (max 5 words): "${prompt}"` }]
        }],
        generationConfig: { maxOutputTokens: 20 }
      })
    })
    if (summaryRes.ok) {
      const sData = await summaryRes.json() as any
      summary = sData.candidates?.[0]?.content?.parts?.[0]?.text?.replace(/["\n\r]/g, '').trim() || prompt
    }
  } catch (se) {
    console.error("Summary generation failed:", se)
  }

  // 6. Generate Tags (using Gemini)
  let tags: string[] = []
  try {
    const geminiTagUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${c.env.GEMINI_API_KEY}`
    const tagRes = await fetch(geminiTagUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [{ text: `Generate 3-5 relevant single-word tags for an image based on this prompt: "${prompt}". Return ONLY the tags separated by commas.` }]
        }],
        generationConfig: { maxOutputTokens: 50 }
      })
    })
    if (tagRes.ok) {
      const tData = await tagRes.json() as any
      const tagText = tData.candidates?.[0]?.content?.parts?.[0]?.text || ''
      tags = tagText.split(',').map((t: string) => t.trim().toLowerCase()).filter((t: string) => t.length > 0)
    }
  } catch (te) {
    console.error("Tag generation failed:", te)
  }

  // 7. Store Result to R2
  await c.env.BUCKET.put(resultPath, aiImage)



  await firebase.firestore('PATCH', `generations/${genId}`, {
    fields: {
      userId: { stringValue: user.sub },
      originalPath: { stringValue: uploadPath },
      resultPath: { stringValue: resultPath },
      prompt: { stringValue: prompt },
      summary: { stringValue: summary },
      tags: { arrayValue: { values: tags.map(t => ({ stringValue: t })) } },
      createdAt: { timestampValue: new Date().toISOString() },
      status: { stringValue: 'completed' },
      votes: { integerValue: 0 },
      likesCount: { integerValue: 0 },
      bookmarksCount: { integerValue: 0 },
      isPublic: { booleanValue: false },
      remixFrom: remixFrom ? { stringValue: remixFrom } : { nullValue: null },
      storedPromptId: storedPromptId ? { stringValue: storedPromptId } : { nullValue: null }
    }
  })

  // Increment Generations Count (Optimistic)
  try {
    // Re-fetch to get current count if needed, or just increment blindly if supported. 
    // Firestore REST API doesn't support atomic increment easily without a transaction or transform.
    // Using transform with updateMask for credits was shown above, let's try similar for generationsCount.
    // However, we just decremented credits. Let's try to update generationsCount.
    // Since we don't know the previous value for sure without reading, and we read credits earlier.
    // We'll read user again? No, let's just do a blind PATCH assuming we have a base, or ignore race conditions for this stat.
    // BETTER: We already read 'userDoc' at step 1.
    const currentGens = parseInt(userDoc.fields?.generationsCount?.integerValue || '0')
    await firebase.firestore('PATCH', `users/${user.sub}?updateMask.fieldPaths=generationsCount`, {
      fields: { generationsCount: { integerValue: currentGens + 1 } }
    })
  } catch (e) {
    console.warn("Failed to increment generations count", e)
  }

  // Increment Stored Prompt Usage (Optimistic)
  if (storedPromptId) {
    try {
      // We'll trust that the prompt exists if we found it earlier, but check for safety or just blind patch?
      // Blind PATCH with transform would be ideal but sticking to read-modify for consistency with limited Firestore REST API support in this codebase
      const promptDoc: any = await firebase.firestore('GET', `stored_prompts/${storedPromptId}`);
      const currentCount = parseInt(promptDoc.fields?.generationsCount?.integerValue || '0');
      await firebase.firestore('PATCH', `stored_prompts/${storedPromptId}?updateMask.fieldPaths=generationsCount`, {
        fields: { generationsCount: { integerValue: currentCount + 1 } }
      });
    } catch (e) {
      console.warn(`Failed to increment stats for prompt ${storedPromptId}`, e);
    }
  }

  // Log success
  c.executionCtx.waitUntil(analytics.logEvent(
    'generate_completed',
    user.sub,
    { genId, prompt, tags, processingTime: Date.now() - start, success: true }
  ))

  return c.json({
    status: 'success',
    genId,
    remainingCredits: credits - 1,
    imageUrl: `/api/image/${encodeURIComponent(resultPath)}`,
    summary,
    tags
  })
})

// Presets: Get all available styles (Hardcoded + Stored)
app.get('/api/presets', async (c) => {
  const firebase = c.get('firebase')

  // Fetch stored prompts from Firestore
  let storedPrompts: any[] = []
  try {
    const query = {
      from: [{ collectionId: 'stored_prompts' }],
      orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }]
    }
    const results = await firebase.query('stored_prompts', query)

    storedPrompts = results.map((doc: any) => ({
      id: doc.id,
      title: doc.name?.stringValue || 'Untitled',
      description: 'Custom Preset', // or add description field
      prompt: doc.prompt?.stringValue,
      tags: doc.tags?.arrayValue?.values?.map((v: any) => v.stringValue) || [],
      sampleUrl: doc.imageUrl?.stringValue ?
        (doc.imageUrl.stringValue.startsWith('http') ? doc.imageUrl.stringValue : `/api/image/${encodeURIComponent(doc.imageUrl.stringValue)}`)
        : '/placeholder.png'
    }))
  } catch (e) {
    console.warn('Failed to fetch stored prompts', e)
    // Fallback to just hardcoded
  }

  return c.json({
    status: 'success',
    presets: [
      ...storedPrompts,
      ...PRESETS.map(p => ({
        id: p.id,
        title: p.title,
        description: p.description,
        sampleUrl: p.sampleUrl,
        tags: p.tags
      }))
    ]
  })
})

// --- Admin Endpoints ---

// Admin Middleware: strict role check
app.use('/api/admin/*', async (c, next) => {
  const user = c.get('user')
  const firebase = c.get('firebase')

  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  // Fetch full user doc to check role
  try {
    const userDoc: any = await firebase.firestore('GET', `users/${user.sub}`)
    const role = userDoc.fields?.role?.stringValue
    if (role !== 'admin') {
      console.warn(`[AdminAccess] Denied for user ${user.sub} (role: ${role})`)
      return c.json({ error: 'Forbidden' }, 403)
    }
  } catch (e) {
    console.error('Admin role check failed', e)
    return c.json({ error: 'Internal Server Error' }, 500)
  }
  await next()
})

// Trigger Aggregation (Manual for now, can be CRON)
app.post('/api/admin/aggregate', async (c) => {
  const analytics = c.get('analytics')
  const date = c.req.query('date') // Optional YYYY-MM-DD
  try {
    const stats = await analytics.aggregateDailyStats(date)
    return c.json({ status: 'success', stats })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// KPI Dashboard Data (Real)
app.get('/api/admin/kpis', async (c) => {
  const firebase = c.get('firebase')
  const analytics = c.get('analytics')

  try {
    // 1. Fetch last 7 days of aggregated stats
    const dates = [...Array(7)].map((_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - i)
      return d.toISOString().split('T')[0]
    }).reverse()

    // Fetch in parallel
    const docs = await Promise.all(
      dates.map(date => firebase.firestore('GET', `daily_stats/${date}`).catch(() => null))
    )

    // Parse stats
    const stats = docs.map((doc: any, i) => {
      const date = dates[i]
      if (!doc || !doc.fields) return { date, activeUsers: 0, newUsers: 0, revenue: 0, generations: 0, latency: 0 }
      return {
        date,
        activeUsers: parseInt(doc.fields.activeUsers?.integerValue || '0'),
        newUsers: parseInt(doc.fields.newUsers?.integerValue || '0'),
        revenue: parseFloat(doc.fields.revenue?.doubleValue || '0'),
        generations: parseInt(doc.fields.generations?.integerValue || '0'),
        latency: parseFloat(doc.fields.avgLatency?.doubleValue || '0')
      }
    })

    // Calculate Totals/Trends (Simplistic comparison of last day vs avg or similar)
    const current = stats[stats.length - 1]
    const prev = stats[stats.length - 2] || current

    const kpis = {
      activeUsers: { value: current.activeUsers, trend: calcTrend(current.activeUsers, prev.activeUsers) },
      revenue: { value: current.revenue.toFixed(2), trend: calcTrend(current.revenue, prev.revenue) },
      newUsers: { value: current.newUsers, trend: calcTrend(current.newUsers, prev.newUsers) },
      generationSuccess: { value: calcSuccessRate(current), trend: 0 },
      avgLatency: { value: current.latency.toFixed(2), trend: 0 },
      conversionRate: { value: 0, trend: 0 } // TBD
    }

    return c.json({
      status: 'success',
      kpis,
      charts: {
        growth: stats
      }
    })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

function calcTrend(curr: number, prev: number) {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 100);
}

function calcSuccessRate(stat: any) {
  // If we had failure counts
  return 100;
}

// Admin User Search
app.get('/api/admin/users', async (c) => {
  const firebase = c.get('firebase')
  const search = c.req.query('q')
  // Simple limit for now
  try {
    const results = await firebase.firestore('GET', 'users?pageSize=50') as any
    const users = results.documents?.map((doc: any) => {
      const f = doc.fields
      return {
        id: doc.name.split('/').pop(),
        email: f.email?.stringValue,
        name: f.name?.stringValue,
        role: f.role?.stringValue || 'user',
        credits: parseInt(f.credits?.integerValue || '0'),
        generationsCount: parseInt(f.generationsCount?.integerValue || '0'),
        totalSpent: parseFloat(f.totalSpent?.doubleValue || '0'),
        createdAt: f.createdAt?.timestampValue
      }
    }) || []

    // In-memory search if q provided (Firestore doesn't support substring search easily)
    const filtered = search
      ? users.filter((u: any) => u.email?.includes(search) || u.name?.includes(search))
      : users

    return c.json({ status: 'success', users: filtered })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// List all stored prompts
app.get('/api/admin/prompts', async (c) => {
  const firebase = c.get('firebase')

  try {
    const query = {
      from: [{ collectionId: 'stored_prompts' }],
      orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }]
    }
    const results = await firebase.query('stored_prompts', query)

    const prompts = results.map((doc: any) => ({
      id: doc.id,
      name: doc.name?.stringValue || 'Untitled',
      prompt: doc.prompt?.stringValue,
      tags: doc.tags?.arrayValue?.values?.map((v: any) => v.stringValue) || [],
      imageUrl: doc.imageUrl?.stringValue,
      createdAt: doc.createdAt?.timestampValue,
      generationsCount: parseInt(doc.generationsCount?.integerValue || '0'),
      updatedAt: doc.updatedAt?.timestampValue
    }))

    return c.json({ status: 'success', prompts })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// Create new stored prompt
app.post('/api/admin/prompts', async (c) => {
  const user = c.get('user')
  const firebase = c.get('firebase')

  // Basic Admin Check (Allow all authenticated users for now, or check for specific email)
  // if (user.email !== 'admin@example.com') return c.json({ error: 'Unauthorized' }, 403)

  let body;
  try {
    body = await c.req.parseBody()
  } catch (e) {
    return c.json({ error: 'Invalid form data' }, 400)
  }

  const name = body['name'] as string
  const prompt = body['prompt'] as string
  const tagsStr = body['tags'] as string
  const file = body['image'] as File

  if (!name || !prompt || !file) {
    return c.json({ error: 'Missing required fields' }, 400)
  }

  const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(Boolean) : []
  const fileExt = file.name.split('.').pop() || 'jpg'
  const promptId = crypto.randomUUID()
  const imagePath = `prompts/${promptId}.${fileExt}`

  // Upload Reference Image
  await c.env.BUCKET.put(imagePath, await file.arrayBuffer(), {
    customMetadata: { type: 'prompt-reference' }
  })

  // Create Firestore Doc
  await firebase.firestore('PATCH', `stored_prompts/${promptId}`, {
    fields: {
      name: { stringValue: name },
      prompt: { stringValue: prompt },
      tags: { arrayValue: { values: tags.map(t => ({ stringValue: t })) } },
      imageUrl: { stringValue: imagePath },
      createdAt: { timestampValue: new Date().toISOString() },
      updatedAt: { timestampValue: new Date().toISOString() },
      createdBy: { stringValue: user.sub },
      generationsCount: { integerValue: 0 }
    }
  })

  return c.json({ status: 'success', id: promptId })
})

// Update existing stored prompt
app.put('/api/admin/prompts/:id', async (c) => {
  const id = c.req.param('id')
  const user = c.get('user')
  const firebase = c.get('firebase')

  let body;
  try {
    body = await c.req.parseBody()
  } catch (e) {
    return c.json({ error: 'Invalid form data' }, 400)
  }

  const name = body['name'] as string
  const prompt = body['prompt'] as string
  const tagsStr = body['tags'] as string
  const file = body['image'] as File

  if (!name || !prompt) {
    return c.json({ error: 'Missing required fields' }, 400)
  }

  const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(Boolean) : []

  let fieldsToUpdate: any = {
    name: { stringValue: name },
    prompt: { stringValue: prompt },
    tags: { arrayValue: { values: tags.map(t => ({ stringValue: t })) } },
    updatedAt: { timestampValue: new Date().toISOString() }
  };

  let updateMask = 'updateMask.fieldPaths=name&updateMask.fieldPaths=prompt&updateMask.fieldPaths=tags&updateMask.fieldPaths=updatedAt';

  // Handle Image Update if provided
  if (file) {
    const fileExt = file.name.split('.').pop() || 'jpg'
    const imagePath = `prompts/${id}.${fileExt}` // Overwrite existing path likely, or new one
    // We should probably check existing path but for now reusing ID is fine or simple suffix

    await c.env.BUCKET.put(imagePath, await file.arrayBuffer(), {
      customMetadata: { type: 'prompt-reference-update' }
    })

    fieldsToUpdate.imageUrl = { stringValue: imagePath };
    updateMask += '&updateMask.fieldPaths=imageUrl';
  }

  try {
    await firebase.firestore('PATCH', `stored_prompts/${id}?${updateMask}`, {
      fields: fieldsToUpdate
    })
    return c.json({ status: 'success', id })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// Delete stored prompt
app.delete('/api/admin/prompts/:id', async (c) => {
  const id = c.req.param('id')
  const firebase = c.get('firebase')

  // 1. Get doc to find image path
  const doc: any = await firebase.firestore('GET', `stored_prompts/${id}`).catch(() => null)
  if (!doc) return c.json({ error: 'Not found' }, 404)

  const imagePath = doc.fields?.imageUrl?.stringValue

  // 2. Delete from Firestore
  await firebase.firestore('DELETE', `stored_prompts/${id}`)

  // 3. Delete from R2 (Optional, but good cleanup)
  if (imagePath && !imagePath.startsWith('http')) {
    await c.env.BUCKET.delete(imagePath)
  }

  return c.json({ status: 'success', deleted: id })
})

// Upload-only: Pre-upload for batch jobs
app.post('/api/upload-only', async (c) => {
  const user = c.get('user')
  const body = await c.req.parseBody()
  const file = body['image'] as File

  if (!file) return c.json({ error: 'No image' }, 400)

  const fileExt = file.name.split('.').pop() || 'jpg'
  const uploadId = crypto.randomUUID()
  const path = `uploads/${user.sub}/pending/${uploadId}.${fileExt}`

  await c.env.BUCKET.put(path, await file.arrayBuffer(), {
    customMetadata: { userId: user.sub, type: 'pending' }
  })

  return c.json({ path })
})

// Active Job Search
app.get('/api/jobs/active', async (c) => {
  const user = c.get('user')
  const firebase = c.get('firebase')

  try {
    const results = await firebase.query('jobs', {
      where: {
        compositeFilter: {
          op: 'AND',
          filters: [
            {
              fieldFilter: {
                field: { fieldPath: 'userId' },
                op: 'EQUAL',
                value: { stringValue: user.sub }
              }
            },
            {
              fieldFilter: {
                field: { fieldPath: 'status' },
                op: 'EQUAL',
                value: { stringValue: 'processing' }
              }
            }
          ]
        }
      },
      orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }],
      limit: 1
    })

    if (results.length > 0) {
      const job = results[0]
      return c.json({
        job: {
          id: job.id,
          status: job.status?.stringValue,
          completed: parseInt(job.completed_images?.integerValue || '0'),
          total: parseInt(job.total_images?.integerValue || '10'),
          results: job.results?.arrayValue?.values?.map((v: any) => v.stringValue) || []
        }
      })
    }

    return c.json({ job: null })
  } catch (e) {
    return c.json({ error: 'Failed to fetch active job' }, 500)
  }
})

// Fetch history
app.get('/api/generations', async (c) => {
  const user = c.get('user')
  const firebase = c.get('firebase')
  const filter = c.req.query('filter') || 'my' // 'my', 'likes', 'bookmarks'
  const tag = c.req.query('tag')

  try {
    let structuredQuery: any = {
      from: [{ collectionId: 'generations' }],
      // Remove orderBy to avoid index requirement
      // limit: 50 // We'll limit after filtering
    }

    const filters: any[] = []

    if (filter === 'my') {
      filters.push({ fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: user.sub } } })
      // Remove status filter here, do it in memory
    }

    // Tag filter can be kept if it doesn't require composite index with userId, 
    // but to be safe and consistent, let's do it in memory if we are already doing in-memory sort
    // However, fetching ALL user generations to filter for one tag might be expensive eventually.
    // For now, let's keep it simple and safe.

    if (filters.length > 0) {
      if (filters.length === 1) {
        structuredQuery.where = filters[0]
      } else {
        structuredQuery.where = {
          compositeFilter: {
            op: 'AND',
            filters
          }
        }
      }
    }

    // For likes/bookmarks, we fetch by ID, so query is different
    if (filter === 'likes' || filter === 'bookmarks') {
      // ... (existing logic for fetching IDs) ...
      // 1. Fetch the IDs from the interaction subcollection
      const interactionPath = `users/${user.sub}/${filter}`
      const interactions: any = await firebase.firestore('GET', interactionPath)

      if (!interactions || !interactions.documents || interactions.documents.length === 0) {
        return c.json({ status: 'success', generations: [] })
      }

      const ids = interactions.documents.map((d: any) => d.name.split('/').pop())

      // Use ID filter
      const idFilter = {
        fieldFilter: {
          field: { fieldPath: '__name__' },
          op: 'IN',
          value: {
            arrayValue: {
              values: ids.map((id: string) => ({ stringValue: `projects/${firebase.projectId}/databases/${firebase.databaseId}/documents/generations/${id}` }))
            }
          }
        }
      }
      structuredQuery.where = idFilter
    }

    let results = await firebase.query('generations', structuredQuery)

    // In-memory Filter & Sort
    if (filter === 'my') {
      results = results.filter((g: any) => g.status?.stringValue === 'completed');
    }

    if (tag) {
      const lowerTag = tag.toLowerCase();
      results = results.filter((g: any) =>
        g.tags?.arrayValue?.values?.some((v: any) => v.stringValue === lowerTag)
      );
    }

    // Sort by createdAt desc
    results.sort((a: any, b: any) => {
      const dateA = new Date(a.createdAt?.timestampValue || 0).getTime();
      const dateB = new Date(b.createdAt?.timestampValue || 0).getTime();
      return dateB - dateA;
    });

    // Apply limit
    results = results.slice(0, 50);

    return c.json({
      status: 'success',
      generations: results.map((g: any) => ({
        id: g.id,
        prompt: g.prompt?.stringValue,
        summary: g.summary?.stringValue || g.prompt?.stringValue?.substring(0, 30),
        imageUrl: `/api/image/${encodeURIComponent(g.resultPath?.stringValue)}`,
        tags: g.tags?.arrayValue?.values?.map((v: any) => v.stringValue) || [],
        createdAt: g.createdAt?.timestampValue,
        votes: parseInt(g.votes?.integerValue || '0'),
        likesCount: parseInt(g.likesCount?.integerValue || '0'),
        bookmarksCount: parseInt(g.bookmarksCount?.integerValue || '0'),
        isPublic: g.isPublic?.booleanValue || false
      }))
    })
  } catch (e: any) {
    console.error('History fetch failed:', e.message)
    return c.json({ error: 'Failed to fetch history', details: e.message }, 500)
  }
})

// Vote on generation
app.post('/api/generations/:id/vote', async (c) => {
  const id = c.req.param('id')
  const { type } = await c.req.json() as { type: 'up' | 'down' }
  const firebase = c.get('firebase')

  const gen: any = await firebase.firestore('GET', `generations/${id}`)
  if (!gen) return c.json({ error: 'Not found' }, 404)

  const currentVotes = parseInt(gen.fields?.votes?.integerValue || '0')
  const newVotes = type === 'up' ? currentVotes + 1 : currentVotes - 1

  await firebase.firestore('PATCH', `generations/${id}?updateMask.fieldPaths=votes`, {
    fields: { votes: { integerValue: newVotes } }
  })

  // Log vote
  /* const analytics = c.get('analytics') // Analytics already in context?
     Check middleware: Yes, explicitly set. But typescript might complain if I don't get it.
  */
  const analytics = c.get('analytics')
  c.executionCtx.waitUntil(analytics.logEvent(
    'generation_voted',
    c.get('user')?.sub,
    { generationId: id, voteType: type, newCount: newVotes }
  ))

  return c.json({ status: 'ok', votes: newVotes })
})

// Toggle public sharing
app.post('/api/generations/:id/share', async (c) => {
  const id = c.req.param('id')
  const firebase = c.get('firebase')

  const gen: any = await firebase.firestore('GET', `generations/${id}`)
  if (!gen) return c.json({ error: 'Not found' }, 404)

  const isPublic = !gen.fields?.isPublic?.booleanValue

  await firebase.firestore('PATCH', `generations/${id}?updateMask.fieldPaths=isPublic`, {
    fields: { isPublic: { booleanValue: isPublic } }
  })

  const analytics = c.get('analytics')
  c.executionCtx.waitUntil(analytics.logEvent(
    'share_toggled',
    c.get('user')?.sub,
    { generationId: id, isPublic }
  ))

  return c.json({ status: 'ok', isPublic })
})

// Public access to shared generation
app.get('/api/public/share/:id', async (c) => {
  const id = c.req.param('id')
  const firebase = new Firebase(c.env)

  const gen: any = await firebase.firestore('GET', `generations/${id}`)
  if (!gen || !gen.fields?.isPublic?.booleanValue) {
    return c.json({ error: 'Generation not found or not public' }, 404)
  }

  return c.json({
    status: 'success',
    generation: {
      id,
      summary: gen.fields?.summary?.stringValue || gen.fields?.prompt?.stringValue?.substring(0, 30),
      prompt: gen.fields?.prompt?.stringValue,
      imageUrl: `/api/public/image/${encodeURIComponent(gen.fields?.resultPath?.stringValue)}`,
      createdAt: gen.fields?.createdAt?.timestampValue,
      votes: parseInt(gen.fields?.votes?.integerValue || '0'),
      likesCount: parseInt(gen.fields?.likesCount?.integerValue || '0'),
      bookmarksCount: parseInt(gen.fields?.bookmarksCount?.integerValue || '0'),
      resultPath: gen.fields?.resultPath?.stringValue
    }
  })
})

// Public Feed (Instagram Explore Style)
app.get('/api/public/feed', async (c) => {
  const firebase = new Firebase(c.env)

  // Fetch latest public generations
  // Fetch latest public generations
  const structuredQuery = {
    where: {
      fieldFilter: {
        field: { fieldPath: 'isPublic' },
        op: 'EQUAL',
        value: { booleanValue: true }
      }
    },
    // Remove orderBy to avoid index requirement
    // limit: 50 // We'll limit after sorting
  }

  let feed: any[] = []
  try {
    let results: any = await firebase.query('generations', structuredQuery)
    if (results && Array.isArray(results)) {
      // Sort in memory
      results.sort((a: any, b: any) => {
        const dateA = new Date(a.createdAt?.timestampValue || 0).getTime();
        const dateB = new Date(b.createdAt?.timestampValue || 0).getTime();
        return dateB - dateA;
      });

      results = results.slice(0, 50);

      feed = results.map((g: any) => ({
        id: g.id,
        summary: g.summary?.stringValue || g.prompt?.stringValue?.substring(0, 30),
        imageUrl: g.resultPath?.stringValue?.startsWith('http')
          ? g.resultPath.stringValue
          : `/api/image/${encodeURIComponent(g.resultPath?.stringValue)}`,
        likesCount: parseInt(g.likesCount?.integerValue || '0'),
        bookmarksCount: parseInt(g.bookmarksCount?.integerValue || '0'),
        createdAt: g.createdAt?.timestampValue
      }))
    }
  } catch (e: any) {
    console.warn('Firestore feed query failed. Proceeding with seed data only.', e.message)
  }

  // Add seed data from PRESETS
  const seedFeed = PRESETS.map(p => ({
    id: `seed-${p.id}`,
    summary: p.title,
    imageUrl: p.sampleUrl,
    likesCount: Math.floor(Math.random() * 50) + 10,
    bookmarksCount: Math.floor(Math.random() * 20) + 5,
    createdAt: new Date().toISOString()
  }))

  return c.json({
    status: 'success',
    feed: [...seedFeed, ...feed]
  })
})

// Like a generation
app.post('/api/generations/:id/like', async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const firebase = c.get('firebase')

  // 1. Toggle like in user's collection
  const likePath = `users/${user.sub}/likes/${id}`
  const existingLike: any = await firebase.firestore('GET', likePath).catch(() => null)
  const isLiked = !!existingLike

  if (isLiked) {
    await firebase.firestore('DELETE', likePath)
  } else {
    await firebase.firestore('PATCH', likePath, {
      fields: { createdAt: { timestampValue: new Date().toISOString() } }
    })
  }

  // 2. Update likesCount on the generation
  const gen: any = await firebase.firestore('GET', `generations/${id}`)
  if (gen) {
    const currentLikes = parseInt(gen.fields?.likesCount?.integerValue || '0')
    const newLikes = isLiked ? Math.max(0, currentLikes - 1) : currentLikes + 1
    await firebase.firestore('PATCH', `generations/${id}?updateMask.fieldPaths=likesCount`, {
      fields: { likesCount: { integerValue: newLikes } }
    })
  }

  return c.json({ status: 'success', isLiked: !isLiked })
})

// Bookmark a generation
app.post('/api/generations/:id/bookmark', async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const firebase = c.get('firebase')

  // 1. Toggle bookmark in user's collection
  const bookmarkPath = `users/${user.sub}/bookmarks/${id}`
  const existingBookmark: any = await firebase.firestore('GET', bookmarkPath).catch(() => null)
  const isBookmarked = !!existingBookmark

  if (isBookmarked) {
    await firebase.firestore('DELETE', bookmarkPath)
  } else {
    await firebase.firestore('PATCH', bookmarkPath, {
      fields: { createdAt: { timestampValue: new Date().toISOString() } }
    })
  }

  // 2. Update bookmarksCount on the generation
  const gen: any = await firebase.firestore('GET', `generations/${id}`)
  if (gen) {
    const currentBookmarks = parseInt(gen.fields?.bookmarksCount?.integerValue || '0')
    const newBookmarks = isBookmarked ? Math.max(0, currentBookmarks - 1) : currentBookmarks + 1
    await firebase.firestore('PATCH', `generations/${id}?updateMask.fieldPaths=bookmarksCount`, {
      fields: { bookmarksCount: { integerValue: newBookmarks } }
    })
  }

  return c.json({ status: 'success', isBookmarked: !isBookmarked })
})

// Public image proxy
app.get('/api/public/image/:path', async (c) => {
  const path = c.req.param('path')
  const object = await c.env.BUCKET.get(path)
  if (!object) return c.text('Not found', 404)

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('etag', object.httpEtag)
  headers.set('Cache-Control', 'public, max-age=31536000')

  return new Response(object.body, { headers })
})

// Serve Image helper
app.get('/api/image/:path', async (c) => {
  const path = c.req.param('path')
  // Decoding path is handled by param, but if slashes are encoded we might need manual decode or check
  const object = await c.env.BUCKET.get(path)
  if (!object) return c.text('Not found', 404)

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('etag', object.httpEtag)

  return new Response(object.body, {
    headers
  })
})

// Stripe: Create Checkout Session
app.post('/api/stripe/checkout', async (c) => {
  const stripe = getStripe(c.env)
  const user = c.get('user')
  const { priceId } = await c.req.json() as { priceId: string }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'payment',
      success_url: `${c.req.header('origin')}/success`,
      cancel_url: `${c.req.header('origin')}/cancel`,
      metadata: {
        userId: user.sub,
        originalPath: (await c.req.json() as any).originalPath,
        prompt: (await c.req.json() as any).prompt
      }
    })
    return c.json({ url: session.url })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// Stripe: Webhook
app.post('/api/stripe/webhook', async (c) => {
  const stripe = getStripe(c.env)
  const signature = c.req.header('stripe-signature')
  const body = await c.req.text()

  if (!signature) return c.text('Missing signature', 400)

  try {
    const event = await stripe.webhooks.constructEventAsync(body, signature, c.env.STRIPE_WEBHOOK_SECRET)

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as any
      const userId = session.metadata?.userId
      const originalPath = session.metadata?.originalPath
      const prompt = session.metadata?.prompt || 'A stylized portrait'

      if (userId && originalPath) {
        const firebase = new Firebase(c.env)
        const jobId = crypto.randomUUID()

        // 1. Create Job record
        await firebase.firestore('PATCH', `jobs/${jobId}`, {
          fields: {
            userId: { stringValue: userId },
            status: { stringValue: 'processing' },
            total_images: { integerValue: 10 },
            completed_images: { integerValue: 0 },
            results: { arrayValue: { values: [] } },
            originalPath: { stringValue: originalPath },
            prompt: { stringValue: prompt },
            createdAt: { timestampValue: new Date().toISOString() }
          }
        })

        // 2. Start Async Batch Process
        c.executionCtx.waitUntil(processBatch(c.env, firebase, jobId, userId, originalPath, prompt))

        // 3. Log Payment Analytics
        const analytics = new Analytics(firebase)
        c.executionCtx.waitUntil(analytics.logEvent(
          'payment_success',
          userId,
          {
            amount: session.amount_total, // cents
            currency: session.currency,
            jobId,
            productId: 'batch_generation'
          }
        ))
      }
    }

    return c.text('Received')
  } catch (e: any) {
    return c.text(`Webhook Error: ${e.message}`, 400)
  }
})


async function processBatch(env: Bindings, firebase: Firebase, jobId: string, userId: string, originalPath: string, basePrompt: string) {
  const prompts = [
    `${basePrompt}, cinematic lighting, masterpiece`,
    `${basePrompt}, digital art style, vibrant`,
    `${basePrompt}, oil painting style, textured`,
    `${basePrompt}, cyberpunk neon aesthetic`,
    `${basePrompt}, sketch drawing, hand-drawn`,
    `${basePrompt}, anime style, clean lines`,
    `${basePrompt}, 3d render, unreal engine 5, octane`,
    `${basePrompt}, black and white, dramatic shadows`,
    `${basePrompt}, watercolor painting, soft`,
    `${basePrompt}, pop art style, bold colors`
  ]

  const results: string[] = []

  try {
    // Get the original image from R2 once
    const object = await env.BUCKET.get(originalPath)
    if (!object) throw new Error("Original image not found in R2")
    const originalBuffer = await object.arrayBuffer()
    const base64Image = Buffer.from(originalBuffer).toString('base64')

    for (let i = 0; i < prompts.length; i++) {
      try {
        const prompt = prompts[i]
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${env.GEMINI_API_KEY}`

        const response = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              role: 'user',
              parts: [
                { text: prompt },
                { inlineData: { mimeType: 'image/jpeg', data: base64Image } }
              ]
            }],
            generationConfig: { responseModalities: ['IMAGE'] }
          })
        })

        if (!response.ok) continue

        const data = await response.json() as any
        const imagePart = data.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)
        if (!imagePart) continue

        const aiImage = Buffer.from(imagePart.inlineData.data, 'base64')
        const genId = crypto.randomUUID()
        const resultPath = `generations/${userId}/batch_${jobId}/${genId}.png`

        // Upload to R2
        await env.BUCKET.put(resultPath, aiImage)
        results.push(`/api/image/${encodeURIComponent(resultPath)}`)

        // Update Job in Firestore
        await firebase.firestore('PATCH', `jobs/${jobId}?updateMask.fieldPaths=completed_images&updateMask.fieldPaths=results`, {
          fields: {
            completed_images: { integerValue: i + 1 },
            results: {
              arrayValue: {
                values: results.map(url => ({ stringValue: url }))
              }
            }
          }
        })

        // Artificial delay if needed to avoid rate limits, though Gemini flash is fast
      } catch (e) {
        console.error(`Batch generation error at index ${i}:`, e)
      }
    }

    // Final status update
    await firebase.firestore('PATCH', `jobs/${jobId}?updateMask.fieldPaths=status`, {
      fields: { status: { stringValue: 'completed' } }
    })

  } catch (e) {
    console.error("Batch job failed fatal:", e)
    await firebase.firestore('PATCH', `jobs/${jobId}?updateMask.fieldPaths=status`, {
      fields: { status: { stringValue: 'failed' } }
    })
  }
}





export default app
