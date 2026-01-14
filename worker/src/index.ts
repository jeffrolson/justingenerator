import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { Firebase } from './lib/firebase'
import { getStripe } from './lib/stripe'

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
  user: any // Payload from JWT
}

const app = new Hono<{ Bindings: Bindings, Variables: Variables }>()

app.use('/*', cors())

// Middleware to initialize Firebase and Auth
app.use('/api/*', async (c, next) => {
  // Skip auth for webhooks
  if (c.req.path.includes('/stripe/webhook')) {
    return next()
  }

  const firebase = new Firebase(c.env)
  c.set('firebase', firebase)

  // Authentication Middleware
  const path = c.req.path
  const isPublic = path === '/' ||
    path === '/api/auth/verify' ||
    path === '/api/debug' ||
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

  if (credits < 1) {
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
  const prompt = body['prompt'] as string || 'A stylized portrait'

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

  try {
    if (!c.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured')
    }

    console.log(`Starting generation with prompt: ${prompt}`)
    const start = Date.now()

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

  // 6. Store Result to R2
  await c.env.BUCKET.put(resultPath, aiImage)

  // 7. Record Generation in Firestore
  await firebase.firestore('PATCH', `generations/${genId}`, {
    fields: {
      userId: { stringValue: user.sub },
      originalPath: { stringValue: uploadPath },
      resultPath: { stringValue: resultPath },
      prompt: { stringValue: prompt },
      summary: { stringValue: summary },
      createdAt: { timestampValue: new Date().toISOString() },
      status: { stringValue: 'completed' },
      votes: { integerValue: 0 },
      isPublic: { booleanValue: false }
    }
  })

  return c.json({
    status: 'success',
    genId,
    remainingCredits: credits - 1,
    imageUrl: `/api/image/${encodeURIComponent(resultPath)}`,
    summary
  })
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

  try {
    const results = await firebase.query('generations', {
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
                value: { stringValue: 'completed' }
              }
            }
          ]
        }
      },
      orderBy: [{
        field: { fieldPath: 'createdAt' },
        direction: 'DESCENDING'
      }],
      limit: 20
    })

    return c.json({
      status: 'success',
      generations: results.map(g => ({
        id: g.id,
        prompt: g.prompt?.stringValue,
        summary: g.summary?.stringValue || g.prompt?.stringValue?.substring(0, 30),
        imageUrl: `/api/image/${encodeURIComponent(g.resultPath?.stringValue)}`,
        createdAt: g.createdAt?.timestampValue,
        votes: parseInt(g.votes?.integerValue || '0'),
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
    id,
    summary: gen.fields?.summary?.stringValue || gen.fields?.prompt?.stringValue?.substring(0, 30),
    imageUrl: `/api/public/image/${encodeURIComponent(gen.fields?.resultPath?.stringValue)}`,
    createdAt: gen.fields?.createdAt?.timestampValue
  })
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
