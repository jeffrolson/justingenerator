import Stripe from 'stripe'

export interface Env {
    STRIPE_SECRET_KEY: string
}

export const getStripe = (env: Env) => {
    if (!env.STRIPE_SECRET_KEY) {
        throw new Error('Missing STRIPE_SECRET_KEY')
    }
    return new Stripe(env.STRIPE_SECRET_KEY, {
        apiVersion: '2024-12-18.acacia', // Use latest or pinned version
        httpClient: Stripe.createFetchHttpClient(), // Important for Workers
    })
}
