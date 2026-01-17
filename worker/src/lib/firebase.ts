import { createRemoteJWKSet, jwtVerify, importPKCS8, SignJWT } from 'jose'

export interface Env {
    FIREBASE_PROJECT_ID: string
    FIREBASE_CLIENT_EMAIL: string
    FIREBASE_PRIVATE_KEY: string
}

export class Firebase {
    projectId: string
    clientEmail: string
    privateKey: string
    databaseId: string

    constructor(env: Env & { FIREBASE_DATABASE_ID?: string }) {
        if (!env.FIREBASE_PROJECT_ID || !env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) {
            throw new Error('Missing Firebase configuration')
        }
        this.projectId = env.FIREBASE_PROJECT_ID.trim()
        this.clientEmail = env.FIREBASE_CLIENT_EMAIL.trim()
        // Handle both escaped \n and actual newlines
        this.privateKey = env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n').trim()
        this.databaseId = env.FIREBASE_DATABASE_ID?.trim() || '(default)'
    }

    async verifyToken(token: string) {
        if (!token) throw new Error("Token is missing")
        if (typeof token !== 'string') throw new Error("Token must be a string")

        console.log(`Verifying token (len: ${token.length}) for project: [${this.projectId}]`)

        const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'))

        const { payload } = await jwtVerify(token, JWKS, {
            issuer: `https://securetoken.google.com/${this.projectId}`,
            audience: this.projectId,
        })

        return payload
    }

    async getAccessToken() {
        const algorithm = 'RS256'
        const privateKey = await importPKCS8(this.privateKey, algorithm)

        const jwt = await new SignJWT({
            iss: this.clientEmail,
            sub: this.clientEmail,
            aud: 'https://oauth2.googleapis.com/token',
            scope: 'https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/identitytoolkit'
        })
            .setProtectedHeader({ alg: algorithm, typ: 'JWT' })
            .setIssuedAt()
            .setExpirationTime('1h')
            .sign(privateKey)

        const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                assertion: jwt
            })
        })

        if (!response.ok) {
            const text = await response.text()
            throw new Error(`Failed to get access token: ${text}`)
        }

        const data = await response.json() as { access_token: string }
        return data.access_token
    }

    async firestore(method: string, path: string, body?: any) {
        const accessToken = await this.getAccessToken()
        const url = `https://firestore.googleapis.com/v1/projects/${this.projectId}/databases/${this.databaseId}/documents/${path}`

        const res = await fetch(url, {
            method,
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: body ? JSON.stringify(body) : undefined
        })

        if (!res.ok) {
            const errorText = await res.text()
            console.error(`Firestore Error [${method} ${path}]:`, {
                status: res.status,
                error: errorText
            })
            if (res.status === 404) return null
            throw new Error(`Firestore error: ${res.status} ${errorText}`)
        }

        const result = await res.json()
        console.log(`Firestore Success [${method} ${path}]`)
        return result
    }

    async query(collection: string, structuredQuery: any) {
        const accessToken = await this.getAccessToken()
        const url = `https://firestore.googleapis.com/v1/projects/${this.projectId}/databases/${this.databaseId}/documents:runQuery`

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                structuredQuery: {
                    from: [{ collectionId: collection }],
                    ...structuredQuery
                }
            })
        })

        if (!res.ok) {
            const errorText = await res.text()
            throw new Error(`Firestore Query Error: ${res.status} ${errorText}`)
        }

        const results = await res.json() as any[]
        // runQuery returns an array of objects like [{ document: {...} }, { readTime: ... }]
        return results
            .filter(r => r.document)
            .map(r => ({
                id: r.document.name.split('/').pop(),
                ...r.document.fields
            }))
    }
}
