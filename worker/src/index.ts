import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { Firebase } from './lib/firebase'
import { getStripe } from './lib/stripe'
import { Analytics } from './lib/analytics'
import { sendTelegramMessage } from './lib/telegram'

type Bindings = {
  FIREBASE_PROJECT_ID: string
  FIREBASE_CLIENT_EMAIL: string
  FIREBASE_PRIVATE_KEY: string
  FIREBASE_DATABASE_ID?: string
  GEMINI_API_KEY?: string
  STRIPE_SECRET_KEY: string
  STRIPE_WEBHOOK_SECRET: string
  TELEGRAM_BOT_TOKEN?: string
  TELEGRAM_CHAT_ID?: string
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
  const analytics = new Analytics(firebase, c.env)

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



// TEMP: Migration Endpoint to seed database


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
    const { firstName, lastName, displayName: bodyDisplayName } = body
    console.log(`[Verify] Token verified for UID: ${uid}. Name metadata:`, { firstName, lastName, bodyDisplayName })

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

      // Robust Name Handling
      // 1. Prioritize explicitly provided names (from body)
      // 2. Fallback to token claims (payload.name)
      // 3. Fallback to "Anonymous"

      let fName = firstName || ''
      let lName = lastName || ''
      let displayName = (payload.name as string) || bodyDisplayName || ''

      // If we don't have a display name from token, try to construct from parts
      if (!displayName && (fName || lName)) {
        displayName = `${fName} ${lName}`.trim()
      }

      // If we still don't have a display name, fallback to Anonymous
      if (!displayName) {
        displayName = 'Anonymous'
      }

      // Conversely, if we have a display name but no parts (e.g. Google Sign In), split it
      if ((!fName || !lName) && displayName !== 'Anonymous') {
        const parts = displayName.split(' ')
        if (!fName) fName = parts[0]
        if (!lName) lName = parts.slice(1).join(' ') || ''
      }

      const isAdmin = payload.email === 'jeffrolson@gmail.com'

      try {
        userDoc = await firebase.firestore('PATCH', `users/${uid}`, {
          fields: {
            email: { stringValue: payload.email },
            name: { stringValue: displayName },
            firstName: { stringValue: fName },
            lastName: { stringValue: lName },
            credits: { integerValue: 5 }, // Free 5 credits
            role: isAdmin ? { stringValue: 'admin' } : { stringValue: 'user' },
            createdAt: { timestampValue: new Date().toISOString() }
          }
        })

        if (!userDoc) {
          console.error(`[Verify] PATCH returned null for users/${uid}`)
          throw new Error("Backend failed to create user record (404 on PATCH)")
        }

        console.log(`[Verify] User created successfully:`, !!userDoc.fields)

        // Send Telegram Notification for New Users
        const notificationEmail = payload.email || 'unknown';
        const notificationName = `${fName || ''} ${lName || ''}`.trim() || (payload.name as string) || 'Anonymous';
        const notificationMessage = `🚀 *New User Signup!*
        
👤 *Name:* ${notificationName}
📧 *Email:* ${notificationEmail}
🆔 *UID:* \`${uid}\``;

        if (c.env.TELEGRAM_BOT_TOKEN && c.env.TELEGRAM_CHAT_ID) {
          // Check settings before sending
          const settingsDoc: any = await firebase.firestore('GET', 'settings/config').catch(() => null)
          const telegramSettings = settingsDoc?.fields?.telegram?.mapValue?.fields
          const enabled = telegramSettings?.enabled?.booleanValue ?? true // Default to true if not set
          const events = telegramSettings?.events?.arrayValue?.values?.map((v: any) => v.stringValue) || ['signup']

          if (enabled && events.includes('signup')) {
            c.executionCtx.waitUntil(sendTelegramMessage(
              c.env.TELEGRAM_BOT_TOKEN,
              c.env.TELEGRAM_CHAT_ID,
              notificationMessage
            ));
          }
        }
      } catch (ce: any) {
        console.error(`[Verify] Firestore CREATE failed:`, ce.message)
        throw new Error(`Failed to initialize user in database: ${ce.message}`)
      }
    } else {
      // Repair missing email or name
      const currentEmail = userDoc.fields?.email?.stringValue
      const currentName = userDoc.fields?.name?.stringValue

      const updateMask = []
      const updateFields: any = {}

      if (!currentEmail && payload.email) {
        console.log(`[Verify] Repairing missing email for user ${uid}`)
        updateMask.push('updateMask.fieldPaths=email')
        updateFields.email = { stringValue: payload.email }
      }

      // Repair missing createdAt
      if (!userDoc.fields?.createdAt?.timestampValue) {
        console.log(`[Verify] Repairing missing createdAt for user ${uid}`)
        updateMask.push('updateMask.fieldPaths=createdAt')
        updateFields.createdAt = { timestampValue: new Date().toISOString() }
      }

      // Check if existing user needs admin upgrade
      if (payload.email === 'jeffrolson@gmail.com' && userDoc.fields?.role?.stringValue !== 'admin') {
        console.log(`[Verify] Upgrading existing user ${payload.email} to admin`)
        updateMask.push('updateMask.fieldPaths=role')
        updateFields.role = { stringValue: 'admin' }
      }

      // Check if user has a broken name ("undefined undefined") and fix it
      if (currentName === 'undefined undefined' || currentName === 'Anonymous' || !currentName) {
        console.log(`[Verify] Fixing broken/missing name for user ${uid}: ${currentName}`)

        let fName = firstName || ''
        let lName = lastName || ''
        let displayName = (payload.name as string) || bodyDisplayName || ''

        if (!displayName && (fName || lName)) displayName = `${fName} ${lName}`.trim()
        if (!displayName) displayName = 'Anonymous'

        if ((!fName || !lName) && displayName !== 'Anonymous') {
          const parts = displayName.split(' ')
          if (!fName) fName = parts[0]
          if (!lName) lName = parts.slice(1).join(' ') || ''
        }

        if (displayName !== 'undefined undefined' && displayName !== 'Anonymous') {
          updateMask.push('updateMask.fieldPaths=name', 'updateMask.fieldPaths=firstName', 'updateMask.fieldPaths=lastName')
          updateFields.name = { stringValue: displayName }
          updateFields.firstName = { stringValue: fName }
          updateFields.lastName = { stringValue: lName }
        }
      }

      if (updateMask.length > 0) {
        try {
          userDoc = await firebase.firestore('PATCH', `users/${uid}?${updateMask.join('&')}`, {
            fields: updateFields
          })
          console.log(`[Verify] User data repaired successfully`)
        } catch (ue: any) {
          console.error(`[Verify] Repair failed:`, ue.message)
        }
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
  const analytics = c.get('analytics')
  let usageStats = { total: 0, prompt: 0, candidates: 0 };
  let imageModel = 'gemini-2.5-flash-image'

  // 1. Check/Reset Credits & Subscription
  const userDoc: any = await firebase.firestore('GET', `users/${user.sub}`)
  let credits = parseInt(userDoc.fields?.credits?.integerValue || '0')
  const subscriptionStatus = userDoc.fields?.subscriptionStatus?.stringValue
  const subscriptionEnd = userDoc.fields?.subscriptionEnd?.timestampValue
  const lastCreditReset = userDoc.fields?.lastCreditReset?.timestampValue

  // Check Monthly Reset (Free Tier)
  const now = new Date()
  const lastResetDate = lastCreditReset ? new Date(lastCreditReset) : new Date(0)
  const isPro = subscriptionStatus === 'active' && subscriptionEnd && new Date(subscriptionEnd) > now

  // If not pro, check if month passed since last reset
  if (!isPro && (now.getTime() - lastResetDate.getTime() > 30 * 24 * 60 * 60 * 1000)) {
    if (credits < 5) {
      credits = 5
      c.executionCtx.waitUntil(firebase.firestore('PATCH', `users/${user.sub}`, {
        fields: {
          credits: { integerValue: 5 },
          lastCreditReset: { timestampValue: now.toISOString() }
        }
      }))
    }
  }

  // Deduct credit if NOT pro
  if (!isPro) {
    if (credits < 1) {
      c.executionCtx.waitUntil(analytics.logEvent('generate_failed', user.sub, { reason: 'insufficient_credits', credits }))
      return c.json({ error: 'Insufficient credits' }, 402)
    }
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
  let usage: any = {}
  const start = Date.now()

  try {
    if (!c.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured')
    }

    // Fetch model from settings
    try {
      const settingsDoc: any = await firebase.firestore('GET', 'settings/config')
      if (settingsDoc?.fields?.imageModel?.stringValue) {
        imageModel = settingsDoc.fields.imageModel.stringValue
      }
    } catch (e) {
      console.warn('Failed to fetch image model from settings, using default', e)
    }

    console.log(`Starting generation with model: ${imageModel}, prompt: ${prompt}`)

    const fileData = await file.arrayBuffer()
    // Use Buffer for more efficient Base64 conversion (requires nodejs_compat)
    const base64Image = Buffer.from(fileData).toString('base64')

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${imageModel}:generateContent?key=${c.env.GEMINI_API_KEY}`

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
    const candidate = result.candidates?.[0]
    const imagePart = candidate?.content?.parts?.find((p: any) => p.inlineData)
    const geminiUsage = result.usageMetadata || {}

    if (!imagePart) {
      const finishReason = candidate?.finishReason
      const blockReason = result.promptFeedback?.blockReason || candidate?.safetyRatings?.find((r: any) => r.blocked)?.category

      if (finishReason === 'SAFETY' || blockReason) {
        throw new Error('Generation blocked by safety filters. Gemini is sensitive about transformations of certain photos (like children).')
      }
      throw new Error(`No image returned from Gemini (Reason: ${finishReason || 'Unknown'})`)
    }

    // Convert base64 back to ArrayBuffer using Buffer
    aiImage = Buffer.from(imagePart.inlineData.data, 'base64').buffer
    console.log(`Generation successful! Tokens: ${geminiUsage.totalTokenCount || 0}. Processing took ${Date.now() - start}ms`)

    // Usage stats for later logging
    usageStats = {
      prompt: geminiUsage.promptTokenCount || 0,
      candidates: geminiUsage.candidatesTokenCount || 0,
      total: geminiUsage.totalTokenCount || 0
    }
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
      storedPromptId: storedPromptId ? { stringValue: storedPromptId } : { nullValue: null },
      model: { stringValue: imageModel },
      tokens: { integerValue: usageStats.total || 0 }
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

  // Log success with token metadata
  c.executionCtx.waitUntil(analytics.logEvent(
    'generate_completed',
    user.sub,
    {
      genId,
      prompt,
      tags,
      processingTime: Date.now() - start,
      success: true,
      tokens: usageStats.total || 0,
      model: imageModel
    }
  ))

  return c.json({
    status: 'success',
    genId,
    remainingCredits: isPro ? 'Unlimited' : credits - 1,
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
        ((doc.imageUrl.stringValue.startsWith('http') || doc.imageUrl.stringValue.startsWith('/examples/')) ?
          doc.imageUrl.stringValue : `/api/image/${encodeURIComponent(doc.imageUrl.stringValue)}`)
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
  const date = c.req.query('date')
  const full = c.req.query('full') === 'true' // If true, reconstruct from primary data (slower but accurate)
  const last30 = c.req.query('last30') === 'true' // If true, sync last 30 days

  try {
    if (last30) {
      const results = await analytics.aggregateRange(30, full)
      return c.json({ status: 'success', days: results.length })
    }

    const stats = full && date
      ? await analytics.reconstructDailyStats(date)
      : await analytics.aggregateDailyStats(date)

    return c.json({ status: 'success', stats })
  } catch (e: any) {
    console.error("Aggregation failed", e)
    return c.json({ error: e.message }, 500)
  }
})

// KPI Dashboard Data (Real)
app.get('/api/admin/kpis', async (c) => {
  const firebase = c.get('firebase')
  const analytics = c.get('analytics')
  const range = c.req.query('range') || '7d'

  try {
    // 1. Determine Date Range
    let days = 7
    if (range === '30d') days = 30
    if (range === '90d') days = 90
    if (range === 'all') days = 365

    const dates = [...Array(days)].map((_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - i)
      return d.toISOString().split('T')[0]
    }).reverse()

    // 2. Fetch all-time stats for "Overall" metrics
    // We can get this by querying all documents in daily_stats or calculating from users/generations
    // For now, let's query all daily_stats to get a better "All Time" than just the range
    const allStatsRes: any = await firebase.query('daily_stats', {
      orderBy: [{ field: { fieldPath: 'date' }, direction: 'ASCENDING' }]
    }) as any[]

    const allTimeDocs = allStatsRes || []
    const totalTokensAllTime = allTimeDocs.reduce((acc: number, d: any) => acc + parseInt(d.totalTokens?.integerValue || '0'), 0)
    const totalRevenueAllTime = allTimeDocs.reduce((acc: number, d: any) => acc + parseFloat(d.revenue?.doubleValue || '0'), 0)
    const totalCostAllTime = allTimeDocs.reduce((acc: number, d: any) => acc + (parseInt(d.totalTokens?.integerValue || '0') / 1000000) * 0.50, 0)

    // 3. Fetch range-specific docs
    let docs: any[] = []
    const start = dates[0]
    const end = dates[dates.length - 1]

    // Filter allTimeDocs for the current range
    const docMap = new Map(allTimeDocs.map((d: any) => [d.date.stringValue, d]))
    docs = dates.map(date => docMap.get(date) || null)

    // Always re-aggregate today's stats for live accuracy
    const todayStr = new Date().toISOString().split('T')[0]
    const todayIdx = dates.indexOf(todayStr)

    // If today is in the requested range, re-calculate it live
    if (todayIdx !== -1) {
      try {
        // console.log(`[KPIs] Refreshing today's stats (${todayStr}) for live view`)
        const todayStats = await analytics.aggregateDailyStats(todayStr)
        docs[todayIdx] = {
          date: { stringValue: todayStr },
          activeUsers: { integerValue: todayStats.activeUsers },
          newUsers: { integerValue: todayStats.newUsers },
          revenue: { doubleValue: todayStats.revenue },
          generations: { integerValue: todayStats.generations },
          totalTokens: { integerValue: todayStats.totalTokens || 0 }
        }
      } catch (ae) {
        console.warn("Failed to auto-aggregate today's stats", ae)
      }
    }

    // Parse stats
    const stats = docs.map((doc: any, i) => {
      const date = dates[i]
      if (!doc) return {
        date, activeUsers: 0, newUsers: 0, revenue: 0,
        generations: 0, latency: 0, totalTokens: 0, cost: 0
      }

      const revenue = parseFloat(doc.revenue?.doubleValue || '0')
      const tokens = parseInt(doc.totalTokens?.integerValue || '0')
      const estimatedCost = (tokens / 1000000) * 0.50

      return {
        date,
        activeUsers: parseInt(doc.activeUsers?.integerValue || '0'),
        newUsers: parseInt(doc.newUsers?.integerValue || '0'),
        revenue,
        generations: parseInt(doc.generations?.integerValue || '0'),
        totalTokens: tokens,
        cost: estimatedCost
      }
    })

    // Calculate Range Totals
    const avgDAU = Math.round(stats.reduce((acc, curr) => acc + curr.activeUsers, 0) / (stats.length || 1))
    const totalRevenueRange = stats.reduce((acc, curr) => acc + curr.revenue, 0)
    const totalNewUsersRange = stats.reduce((acc, curr) => acc + curr.newUsers, 0)
    const totalTokensRange = stats.reduce((acc, curr) => acc + curr.totalTokens, 0)
    const totalCostRange = stats.reduce((acc, curr) => acc + curr.cost, 0)

    const currentDay = stats[stats.length - 1]
    const prevDay = stats[stats.length - 2] || currentDay

    const currentProfit = currentDay.revenue - currentDay.cost
    const prevProfit = prevDay.revenue - prevDay.cost

    const kpis = {
      activeUsers: { value: avgDAU, label: 'Avg Daily Users', trend: calcTrend(currentDay.activeUsers, prevDay.activeUsers) },
      revenue: { value: totalRevenueRange.toFixed(2), label: 'Total Revenue', trend: calcTrend(currentDay.revenue, prevDay.revenue) },
      newUsers: { value: totalNewUsersRange, label: 'New Signups', trend: calcTrend(currentDay.newUsers, prevDay.newUsers) },
      tokens: { value: (totalTokensRange / 1000000).toFixed(2) + 'M', label: 'Tokens Used', trend: calcTrend(currentDay.totalTokens, prevDay.totalTokens) },
      cost: { value: totalCostRange.toFixed(3), label: 'Est. Cost', trend: calcTrend(currentDay.cost, prevDay.cost) },
      netProfit: { value: (totalRevenueRange - totalCostRange).toFixed(2), label: 'Est. Net Profit', trend: calcTrend(currentDay.revenue - currentDay.cost, prevDay.revenue - prevDay.cost) },
      // All-Time metrics
      allTime: {
        tokens: (totalTokensAllTime / 1000000).toFixed(2) + 'M',
        cost: totalCostAllTime.toFixed(2),
        revenue: totalRevenueAllTime.toFixed(2)
      }
    }

    return c.json({
      status: 'success',
      kpis,
      charts: {
        growth: stats
      }
    })
  } catch (e: any) {
    console.error("KPI Error", e)
    return c.json({ error: e.message }, 500)
  }
})

function calcTrend(curr: number, prev: number) {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 100);
}

function calcSuccessRate(stat: any) {
  const total = stat.generations + stat.generationFailures;
  if (total === 0) return 100;
  return Math.round((stat.generations / total) * 100);
}

// Admin User Search
app.get('/api/admin/users', async (c) => {
  const firebase = c.get('firebase')
  const search = c.req.query('q')
  const sortField = c.req.query('sortField') || 'createdAt'
  const sortOrder = c.req.query('sortOrder') || 'DESC'

  try {
    // 1. Fetch latest 500 users using structured query to ensure newest are always seen
    const users = await firebase.query('users', {
      limit: 1000 // Increased limit, removed orderBy to ensure we get users missing createdAt
    }) as any[]

    // Background Repair: Fix users missing metadata
    const usersToRepair = users.filter((u: any) => !u.createdAt?.timestampValue || !u.email?.stringValue || !u.name?.stringValue);

    if (usersToRepair.length > 0) {
      const repairCount = usersToRepair.length;
      console.log(`[Admin] Found ${repairCount} users with missing metadata. Scheduling repair...`);

      c.executionCtx.waitUntil((async () => {
        let successCount = 0;
        for (const u of usersToRepair) {
          try {
            const updatePaths = [];
            const fields: any = {};

            if (!u.createdAt?.timestampValue) {
              updatePaths.push('updateMask.fieldPaths=createdAt');
              fields.createdAt = { timestampValue: new Date().toISOString() };
            }
            // For email/name, we can't invent them, but if we have one part we might fix others? 
            // Or just ensure the createdAt exists so they sort correctly.
            // If they are missing email, we can't really fix it without auth data which we don't have here.

            if (updatePaths.length > 0) {
              await firebase.firestore('PATCH', `users/${u.id}?${updatePaths.join('&')}`, { fields });
              successCount++;
            }
          } catch (e) {
            console.error(`Failed to repair user ${u.id}`, e);
          }
        }
        console.log(`[Admin] Repaired ${successCount}/${repairCount} users.`);
      })());
    }

    const mappedUsers = users.map(u => ({
      id: u.id,
      email: u.email?.stringValue,
      name: u.name?.stringValue,
      role: u.role?.stringValue || 'user',
      credits: parseInt(u.credits?.integerValue || '0'),
      generationsCount: parseInt(u.generationsCount?.integerValue || '0'),
      totalSpent: parseFloat(u.totalSpent?.doubleValue || '0'),
      createdAt: u.createdAt?.timestampValue
    }))

    // 2. Filter based on search query if provided
    let filtered = mappedUsers.filter((u: any) => {
      if (search) {
        const s = search.toLowerCase();
        return (u.email?.toLowerCase().includes(s) || u.name?.toLowerCase().includes(s));
      }
      return true;
    });

    // 3. Sort in-memory (the frontend handles this by passing field/order)
    filtered.sort((a: any, b: any) => {
      let valA = a[sortField];
      let valB = b[sortField];

      // Handle numbers vs strings
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      // Handle nulls
      if (valA === undefined || valA === null) return 1;
      if (valB === undefined || valB === null) return -1;

      if (valA < valB) return sortOrder === 'ASC' ? -1 : 1;
      if (valA > valB) return sortOrder === 'ASC' ? 1 : -1;
      return 0;
    });

    return c.json({
      status: 'success',
      users: filtered
    })
  } catch (e: any) {
    console.error("User List Error", e)
    return c.json({ error: e.message }, 500)
  }
})

app.post('/api/admin/users/sync-auth', async (c) => {
  const firebase = c.get('firebase')
  try {
    // 1. Find users needing repair
    const usersRes = await firebase.query('users', { limit: 1000 }) as any[]
    const needsRepair = usersRes.filter(u => {
      const email = u.email?.stringValue
      const name = u.name?.stringValue
      return !email || name === 'Anonymous' || name === 'undefined undefined' || !name
    })

    if (needsRepair.length === 0) {
      return c.json({ message: 'No users found needing repair' })
    }

    console.log(`[Sync] Found ${needsRepair.length} users needing sync from Auth`)

    // 2. Perform repair (foreground to ensure it finishes for the admin)
    let repaired = 0
    const accessToken = await firebase.getAccessToken()

    for (const u of needsRepair) {
      try {
        console.log(`[Sync] Fetching Auth data for user: ${u.id}`)
        const res = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${firebase.projectId}/accounts:lookup`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ localId: [u.id] })
        })

        if (!res.ok) {
          const err = await res.text()
          console.error(`[Sync] Auth Lookup failed for ${u.id}: ${res.status} ${err}`)
          continue
        }

        const data = await res.json() as any
        const authUser = data.users?.[0]

        if (authUser) {
          const email = authUser.email
          const displayName = authUser.displayName || email?.split('@')[0] || 'Anonymous'
          const parts = displayName.split(' ')
          const firstName = parts[0] || ''
          const lastName = parts.slice(1).join(' ') || ''

          const fields: any = {}
          const updatePaths = []

          if (email) {
            fields.email = { stringValue: email }
            updatePaths.push('updateMask.fieldPaths=email')
          }
          if (displayName && displayName !== 'Anonymous') {
            fields.name = { stringValue: displayName }
            fields.firstName = { stringValue: firstName }
            fields.lastName = { stringValue: lastName }
            updatePaths.push('updateMask.fieldPaths=name', 'updateMask.fieldPaths=firstName', 'updateMask.fieldPaths=lastName')
          }

          if (updatePaths.length > 0) {
            await firebase.firestore('PATCH', `users/${u.id}?${updatePaths.join('&')}`, { fields })
            repaired++
          }
        }
      } catch (e) {
        console.error(`[Sync] Failed to repair user ${u.id}:`, e)
      }
    }

    return c.json({ status: 'success', repaired, total: needsRepair.length })
  } catch (e: any) {
    console.error("Sync Auth Error", e)
    return c.json({ error: e.message }, 500)
  }
})

// Get user generations for monitoring
app.get('/api/admin/users/:id/generations', async (c) => {
  const firebase = c.get('firebase')
  const userId = c.req.param('id')

  try {
    const results = await firebase.query('generations', {
      where: {
        fieldFilter: {
          field: { fieldPath: 'userId' },
          op: 'EQUAL',
          value: { stringValue: userId }
        }
      },
      orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }],
      limit: 50
    })

    const generations = results.map((doc: any) => ({
      id: doc.id,
      prompt: doc.prompt?.stringValue,
      summary: doc.summary?.stringValue,
      imageUrl: `/api/image/${encodeURIComponent(doc.resultPath?.stringValue)}`,
      createdAt: doc.createdAt?.timestampValue,
      status: doc.status?.stringValue
    }))

    return c.json({ status: 'success', generations })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// Analytics: User Details & Interaction
app.get('/api/admin/analytics/users/:id', async (c) => {
  const firebase = c.get('firebase')
  const userId = c.req.param('id')

  try {
    const [userDoc, gensRes, loginsRes] = await Promise.all([
      firebase.firestore('GET', `users/${userId}`),
      firebase.query('generations', {
        where: { fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: userId } } },
        limit: 1000
      }),
      firebase.query('events', {
        where: {
          compositeFilter: {
            op: 'AND',
            filters: [
              { fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: userId } } },
              { fieldFilter: { field: { fieldPath: 'eventType' }, op: 'EQUAL', value: { stringValue: 'user_login' } } }
            ]
          }
        },
        limit: 1000
      })
    ])

    if (!userDoc) return c.json({ error: 'User not found' }, 404)

    const gens = gensRes as any[]
    const logins = loginsRes as any[]

    const stats = {
      totalLogins: logins.length,
      totalGenerations: gens.length,
      types: {
        remix: gens.filter(g => g.remixFrom?.stringValue).length,
        preset: gens.filter(g => g.storedPromptId?.stringValue && !g.remixFrom?.stringValue).length,
        custom: gens.filter(g => !g.storedPromptId?.stringValue && !g.remixFrom?.stringValue).length
      },
      totalTokens: gens.reduce((sum, g) => sum + parseInt(g.tokens?.integerValue || '0'), 0),
      models: gens.reduce((acc: Record<string, number>, g) => {
        const m = g.model?.stringValue || 'gemini-2.5-flash-image'
        acc[m] = (acc[m] || 0) + 1
        return acc
      }, {}),
      lastActive: gens.length > 0 ? gens[0].createdAt?.timestampValue : (logins.length > 0 ? logins[0].timestamp?.timestampValue : null)
    }

    return c.json({ status: 'success', stats })
  } catch (e: any) {
    console.error("User Analytics Error", e)
    return c.json({ error: e.message }, 500)
  }
})

// Analytics: Global Generation Popularity
app.get('/api/admin/analytics/popularity', async (c) => {
  const firebase = c.get('firebase')

  try {
    // Fetch last 1000 generations to measure recent popularity
    const gens = await firebase.query('generations', {
      orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }],
      limit: 1000
    }) as any[]

    const typeStats = { remix: 0, preset: 0, custom: 0 }
    const presetCounts: Record<string, number> = {}
    const userCounts: Record<string, number> = {}

    for (const g of gens) {
      // Type breakdown
      if (g.remixFrom?.stringValue) typeStats.remix++
      else if (g.storedPromptId?.stringValue) typeStats.preset++
      else typeStats.custom++

      // Preset popularity
      if (g.storedPromptId?.stringValue) {
        presetCounts[g.storedPromptId.stringValue] = (presetCounts[g.storedPromptId.stringValue] || 0) + 1
      }

      // Power users
      const uid = g.userId?.stringValue
      if (uid) {
        userCounts[uid] = (userCounts[uid] || 0) + 1
      }
    }

    // Format top presets
    const topPresets = Object.entries(presetCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, count]) => ({ id, count }))

    // Format top users with emails
    const powerUsers = await Promise.all(
      Object.entries(userCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(async ([id, count]) => {
          try {
            const userDoc: any = await firebase.firestore('GET', `users/${id}`)
            return { id, count, email: userDoc?.fields?.email?.stringValue || 'Unknown' }
          } catch (e) {
            return { id, count, email: 'Unknown' }
          }
        })
    )

    return c.json({
      status: 'success',
      generationTypes: typeStats,
      topPresets,
      powerUsers
    })
  } catch (e: any) {
    console.error("Popularity Analytics Error", e)
    return c.json({ error: e.message }, 500)
  }
})

// Delete user
app.delete('/api/admin/users/:id', async (c) => {
  const firebase = c.get('firebase')
  const id = c.req.param('id')
  try {
    // Delete from Firestore
    await firebase.firestore('DELETE', `users/${id}`)
    return c.json({ status: 'success' })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// Update user role
app.patch('/api/admin/users/:id/role', async (c) => {
  const firebase = c.get('firebase')
  const id = c.req.param('id')
  const { role } = await c.req.json()

  if (!['admin', 'user'].includes(role)) {
    return c.json({ error: 'Invalid role' }, 400)
  }

  try {
    await firebase.firestore('PATCH', `users/${id}?updateMask.fieldPaths=role`, {
      fields: { role: { stringValue: role } }
    })
    return c.json({ status: 'success' })
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


// Add these Settings endpoints:

// Get Settings
app.get('/api/admin/settings', async (c) => {
  const firebase = c.get('firebase')
  try {
    const doc: any = await firebase.firestore('GET', 'settings/config').catch(() => null)
    const model = doc?.fields?.imageModel?.stringValue || 'gemini-2.5-flash-image'
    const telegram = {
      enabled: doc?.fields?.telegram?.mapValue?.fields?.enabled?.booleanValue ?? true,
      events: doc?.fields?.telegram?.mapValue?.fields?.events?.arrayValue?.values?.map((v: any) => v.stringValue) || ['signup']
    }
    const featureFlags = {
      dailyRewards: doc?.fields?.featureFlags?.mapValue?.fields?.dailyRewards?.booleanValue ?? true,
      referrals: doc?.fields?.featureFlags?.mapValue?.fields?.referrals?.booleanValue ?? true
    }
    return c.json({ status: 'success', settings: { imageModel: model, telegram, featureFlags } })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// Update Settings
// Update Settings
app.post('/api/admin/settings', async (c) => {
  const firebase = c.get('firebase')
  const { imageModel, telegram, featureFlags } = await c.req.json() as { imageModel?: string, telegram?: any, featureFlags?: any }

  try {
    const fields: any = {
      updatedAt: { timestampValue: new Date().toISOString() }
    }

    if (imageModel) fields.imageModel = { stringValue: imageModel }
    if (telegram) {
      fields.telegram = {
        mapValue: {
          fields: {
            enabled: { booleanValue: telegram.enabled },
            events: {
              arrayValue: {
                values: (telegram.events || []).map((e: string) => ({ stringValue: e }))
              }
            }
          }
        }
      }
    }
    if (featureFlags) {
      fields.featureFlags = {
        mapValue: {
          fields: {
            dailyRewards: { booleanValue: featureFlags.dailyRewards },
            referrals: { booleanValue: featureFlags.referrals }
          }
        }
      }
    }

    await firebase.firestore('PATCH', 'settings/config', { fields })
    return c.json({ status: 'success' })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// Test Telegram Notification
app.post('/api/admin/test-telegram', async (c) => {
  const user = c.get('user')
  const firebase = c.get('firebase')

  // Double check admin role? Middleware already checks user existence, but role check is good.
  const userDoc: any = await firebase.firestore('GET', `users/${user.sub}`)
  if (userDoc?.fields?.role?.stringValue !== 'admin') {
    return c.json({ error: 'Unauthorized' }, 403)
  }

  const token = c.env.TELEGRAM_BOT_TOKEN
  const chatId = c.env.TELEGRAM_CHAT_ID

  if (!token || !chatId) {
    return c.json({ error: 'Telegram credentials missing in worker environment.' }, 500)
  }

  try {
    await sendTelegramMessage(token, chatId, "🔔 *Test Notification*\n\nThis is a test message from your Admin Portal. If you prefer, you can disable these in Settings.")
    return c.json({ status: 'success' })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
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
    // Query only by userId and orderBy createdAt to get the latest job.
    // We omit the 'status' filter to avoid requiring a composite index.
    // Query only by userId. We omit the 'orderBy' to avoid requiring a composite index.
    const results = await firebase.query('jobs', {
      where: {
        fieldFilter: {
          field: { fieldPath: 'userId' },
          op: 'EQUAL',
          value: { stringValue: user.sub }
        }
      },
      limit: 10 // Get a few recent ones
    })

    // Sort in-memory to find the most recent processing or recently completed job
    const sortedJobs = results.sort((a: any, b: any) =>
      new Date(b.createdAt?.timestampValue || 0).getTime() - new Date(a.createdAt?.timestampValue || 0).getTime()
    );

    const activeJob = sortedJobs.find((j: any) => j.status?.stringValue === 'processing') ||
      sortedJobs.find((j: any) => j.status?.stringValue === 'completed' &&
        (new Date().getTime() - new Date(j.createdAt?.timestampValue).getTime() < 30000));

    if (activeJob) {
      return c.json({
        job: {
          id: activeJob.id,
          status: activeJob.status?.stringValue,
          completed: parseInt(activeJob.completed_images?.integerValue || '0'),
          total: parseInt(activeJob.total_images?.integerValue || '10'),
          results: activeJob.results?.arrayValue?.values?.map((v: any) => v.stringValue) || []
        }
      })
    }

    return c.json({ job: null })
  } catch (e) {
    return c.json({ error: 'Failed to fetch active job' }, 500)
  }
})

// Fetch history
// Fetch history
app.get('/api/generations', async (c) => {
  const user = c.get('user')
  const firebase = c.get('firebase')
  const filter = c.req.query('filter') || 'my' // 'my', 'likes', 'bookmarks'
  const tag = c.req.query('tag')
  const q = c.req.query('q')

  try {
    // 1. Fetch user's likes and bookmarks IDs first (useful for flags and for filtering)
    const [likesRes, bookmarksRes]: any[] = await Promise.all([
      firebase.firestore('GET', `users/${user.sub}/likes`).catch(() => ({ documents: [] })),
      firebase.firestore('GET', `users/${user.sub}/bookmarks`).catch(() => ({ documents: [] }))
    ]);

    const likedIds = new Set((likesRes?.documents || []).map((d: any) => d.name.split('/').pop()));
    const bookmarkedIds = new Set((bookmarksRes?.documents || []).map((d: any) => d.name.split('/').pop()));

    let results: any[] = [];

    if (filter === 'my') {
      results = await firebase.query('generations', {
        where: { fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: user.sub } } }
      });
      // Filter for completed items
      results = results.filter((g: any) => g.status?.stringValue === 'completed');
    } else {
      // Filter by 'likes' or 'bookmarks'
      const targetIds = Array.from(filter === 'likes' ? likedIds : bookmarkedIds);

      if (targetIds.length > 0) {
        // Chunk into groups of 30 for Firestore 'IN' limit
        const chunks = [];
        for (let i = 0; i < targetIds.length; i += 30) {
          chunks.push(targetIds.slice(i, i + 30));
        }

        const queryPromises = chunks.map(chunk => {
          return firebase.query('generations', {
            where: {
              fieldFilter: {
                field: { fieldPath: '__name__' },
                op: 'IN',
                value: {
                  arrayValue: {
                    values: chunk.map((id: any) => ({
                      stringValue: `projects/${firebase.projectId}/databases/${firebase.databaseId}/documents/generations/${id}`
                    }))
                  }
                }
              }
            }
          });
        });

        const queryResults = await Promise.all(queryPromises);
        results = queryResults.flat();
      }
    }

    // 2. In-memory Filter (Tag and Search Query)
    if (tag) {
      const lowerTag = tag.toLowerCase();
      results = results.filter((g: any) =>
        g.tags?.arrayValue?.values?.some((v: any) => v.stringValue?.toLowerCase() === lowerTag)
      );
    }

    if (q) {
      const lowerQ = q.toLowerCase();
      results = results.filter((g: any) =>
        g.prompt?.stringValue?.toLowerCase().includes(lowerQ) ||
        g.summary?.stringValue?.toLowerCase().includes(lowerQ) ||
        g.tags?.arrayValue?.values?.some((v: any) => v.stringValue?.toLowerCase().includes(lowerQ))
      );
    }

    // 3. Sort by createdAt desc
    results.sort((a: any, b: any) => {
      const dateA = new Date(a.createdAt?.timestampValue || 0).getTime();
      const dateB = new Date(b.createdAt?.timestampValue || 0).getTime();
      return dateB - dateA;
    });

    // 4. Apply limit
    results = results.slice(0, 50);

    // 5. Build final response with flags
    return c.json({
      status: 'success',
      generations: results.map((g: any) => ({
        id: g.id,
        prompt: g.prompt?.stringValue,
        summary: g.summary?.stringValue || g.prompt?.stringValue?.substring(0, 30),
        imageUrl: `/api/image/${encodeURIComponent(g.resultPath?.stringValue || '')}`,
        tags: g.tags?.arrayValue?.values?.map((v: any) => v.stringValue) || [],
        createdAt: g.createdAt?.timestampValue,
        votes: parseInt(g.votes?.integerValue || '0'),
        likesCount: parseInt(g.likesCount?.integerValue || '0'),
        bookmarksCount: parseInt(g.bookmarksCount?.integerValue || '0'),
        isPublic: g.isPublic?.booleanValue || false,
        isLiked: likedIds.has(g.id),
        isBookmarked: bookmarkedIds.has(g.id)
      }))
    });
  } catch (e: any) {
    console.error('History fetch failed:', e);
    return c.json({ error: 'Failed to fetch history', details: e.message }, 500);
  }
});

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

  // Handle seed images (presets)
  if (id.startsWith('seed-')) {
    const presetId = id.replace('seed-', '')
    const preset = PRESETS.find(p => p.id === presetId)
    if (preset) {
      return c.json({
        status: 'success',
        generation: {
          id,
          summary: preset.title,
          imageUrl: preset.sampleUrl,
          isSeed: true
        }
      })
    }
  }

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
        imageUrl: (g.resultPath?.stringValue?.startsWith('http') || g.resultPath?.stringValue?.startsWith('/examples/'))
          ? g.resultPath.stringValue
          : `/api/image/${encodeURIComponent(g.resultPath?.stringValue || '')}`,
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
    feed: [...feed, ...seedFeed]
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

// Public Config (Feature Flags)
app.get('/api/public/config', async (c) => {
  const firebase = c.get('firebase')
  try {
    // We cache this heavily in a real app, here we rely on KV or simple reads
    const doc: any = await firebase.firestore('GET', 'settings/config').catch(() => null)

    // Default features to true if not set
    const features = {
      dailyRewards: doc?.fields?.featureFlags?.mapValue?.fields?.dailyRewards?.booleanValue ?? true,
      referrals: doc?.fields?.featureFlags?.mapValue?.fields?.referrals?.booleanValue ?? true
    }

    return c.json({ status: 'success', features })
  } catch (e) {
    // If fail, default to enabled to not break UI
    return c.json({
      status: 'success',
      features: { dailyRewards: true, referrals: true }
    })
  }
})

// Public image proxy
app.get('/api/public/image/:path', async (c) => {
  const path = c.req.param('path')
  const object = await c.env.BUCKET.get(path)
  if (!object) return c.text('Not found', 404)

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('etag', object.httpEtag)
  headers.set('Cache-Control', 'public, max-age=31536000, immutable')
  headers.set('Access-Control-Allow-Origin', '*')

  return new Response(object.body, { headers })
})

// Serve Image helper
app.get('/api/image/:path', async (c) => {
  const path = c.req.param('path')
  const object = await c.env.BUCKET.get(path)
  if (!object) return c.text('Not found', 404)

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('etag', object.httpEtag)
  headers.set('Cache-Control', 'public, max-age=31536000, immutable')
  headers.set('Access-Control-Allow-Origin', '*')

  return new Response(object.body, {
    headers
  })
})

// Stripe: Create Checkout Session
// Stripe: Create Checkout Session
app.post('/api/stripe/checkout', async (c) => {
  const stripe = getStripe(c.env)
  const user = c.get('user')
  const { priceId, originalPath, presetId } = await c.req.json() as { priceId: string, originalPath?: string, presetId?: string }

  // Determine mode based on Price ID
  const isSubscription = priceId === 'price_1Spj39FYNUGeLOIpFYcccsqI';
  const mode = isSubscription ? 'subscription' : 'payment';

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: mode,
      success_url: `${c.req.header('origin')}/?checkout=success`,
      cancel_url: `${c.req.header('origin')}/pricing?checkout=cancel`,
      metadata: {
        userId: user.sub,
        type: mode === 'subscription' ? 'pro_sub' : 'credit_pack',
        originalPath: originalPath || '',
        presetId: presetId || ''
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
    const firebase = new Firebase(c.env)
    const analytics = new Analytics(firebase, c.env)

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as any
      const userId = session.metadata?.userId
      const type = session.metadata?.type // 'credit_pack' | 'pro_sub'
      const originalPath = session.metadata?.originalPath
      const presetId = session.metadata?.presetId

      if (userId) {
        if (type === 'credit_pack') {
          // Increment Credits (Read-Modify-Write)
          const userDoc: any = await firebase.firestore('GET', `users/${userId}`)
          const current = parseInt(userDoc.fields?.credits?.integerValue || '0')
          const currentSpent = parseFloat(userDoc.fields?.totalSpent?.doubleValue || '0')

          await firebase.firestore('PATCH', `users/${userId}`, {
            fields: {
              credits: { integerValue: current + 10 },
              totalSpent: { doubleValue: currentSpent + (session.amount_total / 100) }
            }
          })

          // Trigger Batch Processing if an image was pre-uploaded
          if (originalPath) {
            const jobId = crypto.randomUUID()
            let basePrompt = 'A stylish portrait'
            if (presetId) {
              const preset = PRESETS.find(p => p.id === presetId)
              if (preset) {
                basePrompt = preset.prompt
              } else {
                // Check stored prompts
                try {
                  const stored: any = await firebase.firestore('GET', `stored_prompts/${presetId}`)
                  if (stored && stored.fields) {
                    basePrompt = stored.fields.prompt?.stringValue || basePrompt
                  }
                } catch (e) {
                  console.warn(`Webhook: Preset ${presetId} not found`)
                }
              }
            }

            // Create Job Document
            await firebase.firestore('PATCH', `jobs/${jobId}`, {
              fields: {
                userId: { stringValue: userId },
                status: { stringValue: 'processing' },
                total_images: { integerValue: 10 },
                completed_images: { integerValue: 0 },
                createdAt: { timestampValue: new Date().toISOString() },
                originalPath: { stringValue: originalPath }
              }
            })

            // Start Async Process
            c.executionCtx.waitUntil(processBatch(c.env, firebase, jobId, userId, originalPath, basePrompt))
          }
        } else if (type === 'pro_sub') {
          // Activate Subscription
          // Also track initial payment as revenue
          const userDoc: any = await firebase.firestore('GET', `users/${userId}`)
          const currentSpent = parseFloat(userDoc.fields?.totalSpent?.doubleValue || '0')

          await firebase.firestore('PATCH', `users/${userId}`, {
            fields: {
              subscriptionStatus: { stringValue: 'active' },
              subscriptionEnd: { timestampValue: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() },
              subscriptionId: { stringValue: session.subscription },
              totalSpent: { doubleValue: currentSpent + (session.amount_total / 100) }
            }
          })
        }

        c.executionCtx.waitUntil(analytics.logEvent('payment_success', userId, { amount: session.amount_total, type, batchTriggered: !!originalPath }))

        // Send Telegram Notification for Payments
        if (c.env.TELEGRAM_BOT_TOKEN && c.env.TELEGRAM_CHAT_ID) {
          try {
            const settingsDoc: any = await firebase.firestore('GET', 'settings/config').catch(() => null)
            const telegramSettings = settingsDoc?.fields?.telegram?.mapValue?.fields
            const enabled = telegramSettings?.enabled?.booleanValue ?? true
            const events = telegramSettings?.events?.arrayValue?.values?.map((v: any) => v.stringValue) || ['signup']

            if (enabled && events.includes('payment')) {
              const amount = (session.amount_total / 100).toFixed(2)
              const currency = (session.currency || 'usd').toUpperCase()
              const typeLabel = type === 'pro_sub' ? 'Pro Subscription' : '10 Credits Pack'
              const userEmail = session.customer_details?.email || 'Unknown User'

              const paymentMsg = `💰 *New Payment Received!*

💵 *Amount:* ${amount} ${currency}
📦 *Product:* ${typeLabel}
📧 *Customer:* ${userEmail}
🆔 *User ID:* \`${userId}\``

              c.executionCtx.waitUntil(sendTelegramMessage(
                c.env.TELEGRAM_BOT_TOKEN,
                c.env.TELEGRAM_CHAT_ID,
                paymentMsg
              ))
            }
          } catch (te) {
            console.error('[Webhook] Telegram notification failed:', te)
          }
        }
      }
    }

    return c.text('OK')
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

    // Fetch model from settings
    let imageModel = 'gemini-2.5-flash-image'
    try {
      const settingsDoc: any = await firebase.firestore('GET', 'settings/config')
      if (settingsDoc?.fields?.imageModel?.stringValue) {
        imageModel = settingsDoc.fields.imageModel.stringValue
      }
    } catch (e) {
      console.warn('Batch: Failed to fetch image model from settings, using default', e)
    }

    for (let i = 0; i < prompts.length; i++) {
      try {
        const prompt = prompts[i]
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${imageModel}:generateContent?key=${env.GEMINI_API_KEY}`

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
