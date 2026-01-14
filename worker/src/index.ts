import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { Firebase } from './lib/firebase'
import { getStripe } from './lib/stripe'

type Bindings = {
  FIREBASE_PROJECT_ID: string
  FIREBASE_CLIENT_EMAIL: string
  FIREBASE_PRIVATE_KEY: string
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

  // Protected routes check
  if (c.req.path !== '/api/auth/verify' && !c.req.path.includes('/stripe/webhook') && !c.req.path.includes('/api/image/')) {
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
  const { token } = await c.req.json()
  const firebase = c.get('firebase')

  try {
    const payload = await firebase.verifyToken(token)
    const uid = payload.sub

    // Check if user exists, if not create
    const userDoc = await firebase.firestore('GET', `users/${uid}`)

    if (!userDoc) {
      await firebase.firestore('PATCH', `users/${uid}`, {
        fields: {
          email: { stringValue: payload.email },
          name: { stringValue: payload.name || 'Anonymous' },
          credits: { integerValue: 5 }, // Free 5 credits
          createdAt: { timestampValue: new Date().toISOString() }
        }
      })
    }

    return c.json({ status: 'ok', user: payload })
  } catch (e: any) {
    return c.json({ error: e.message }, 400)
  }
})

// Generate: Upload Image -> AI -> Store Result
app.post('/api/generate', async (c) => {
  const user = c.get('user')
  const firebase = c.get('firebase')

  // 1. Check credits
  const userDoc = await firebase.firestore('GET', `users/${user.sub}`)
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
  let aiImage: ReadableStream | ArrayBuffer

  try {
    // Using @cf/stabilityai/stable-diffusion-xl-base-1.0 (text-to-image)
    // Note: This is generating from PROMPT, not IMG2IMG. 
    // If the requirement is strict img2img, we should swap the model string when available.
    const response = await c.env.AI.run('@cf/stabilityai/stable-diffusion-xl-base-1.0', {
      prompt: prompt
    })

    aiImage = response as unknown as ReadableStream
  } catch (e: any) {
    // Refund credit on failure
    await firebase.firestore('PATCH', `users/${user.sub}?updateMask.fieldPaths=credits`, {
      fields: { credits: { integerValue: credits } }
    })
    return c.json({ error: `AI Generation failed: ${e.message}` }, 500)
  }

  // 5. Store Result to R2
  await c.env.BUCKET.put(resultPath, aiImage)

  // 6. Record Generation in Firestore
  await firebase.firestore('PATCH', `generations/${genId}`, {
    fields: {
      userId: { stringValue: user.sub },
      originalPath: { stringValue: uploadPath },
      resultPath: { stringValue: resultPath },
      prompt: { stringValue: prompt },
      createdAt: { timestampValue: new Date().toISOString() },
      status: { stringValue: 'completed' }
    }
  })

  return c.json({
    status: 'success',
    genId,
    remainingCredits: credits - 1,
    imageUrl: `/api/image/${encodeURIComponent(resultPath)}`
  })
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
        userId: user.sub
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

      if (userId) {
        const firebase = new Firebase(c.env)
        const userDoc = await firebase.firestore('GET', `users/${userId}`)
        const currentCredits = parseInt(userDoc?.fields?.credits?.integerValue || '0')

        await firebase.firestore('PATCH', `users/${userId}?updateMask.fieldPaths=credits`, {
          fields: {
            credits: { integerValue: currentCredits + 50 }
          }
        })
      }
    }

    return c.text('Received')
  } catch (e: any) {
    return c.text(`Webhook Error: ${e.message}`, 400)
  }
})

export default app
