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

    constructor(env: Env) {
        if (!env.FIREBASE_PROJECT_ID || !env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) {
            throw new Error('Missing Firebase configuration')
        }
        this.projectId = env.FIREBASE_PROJECT_ID
        this.clientEmail = env.FIREBASE_CLIENT_EMAIL
        this.privateKey = env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    }

    async verifyToken(token: string) {
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
            scope: 'https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/datastore'
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
        const token = await this.getAccessToken()
        const url = `https://firestore.googleapis.com/v1/projects/${this.projectId}/databases/(default)/documents/${path}`

        const response = await fetch(url, {
            method,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: body ? JSON.stringify(body) : undefined
        })

        if (!response.ok) {
            // Handle 404 cleanly for gets
            if (method === 'GET' && response.status === 404) return null
            const text = await response.text()
            throw new Error(`Firestore ${method} ${path} failed: ${response.status} ${text}`)
        }

        return response.json()
    }
}
