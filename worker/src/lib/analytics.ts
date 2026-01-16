import { Firebase } from './firebase'

export interface AnalyticsEvent {
    userId?: string
    sessionId?: string
    eventType: string
    timestamp: string
    metadata?: Record<string, any>
    ip?: string
    userAgent?: string
}

export class Analytics {
    private firebase: Firebase
    private gaMeasurementId: string | undefined
    private gaApiSecret: string | undefined

    constructor(firebase: Firebase, env?: any) {
        this.firebase = firebase
        this.gaMeasurementId = env?.GA_MEASUREMENT_ID
        this.gaApiSecret = env?.GA_API_SECRET
    }

    /**
     * Log a raw event to the 'events' collection.
     */
    async logEvent(
        eventType: string,
        userId: string | undefined,
        metadata: Record<string, any> = {},
        requestInfo?: { ip?: string, userAgent?: string, sessionId?: string }
    ) {
        try {
            const event: AnalyticsEvent = {
                userId,
                eventType,
                timestamp: new Date().toISOString(),
                metadata,
                sessionId: requestInfo?.sessionId,
                ip: requestInfo?.ip,
                userAgent: requestInfo?.userAgent
            }

            const fields: any = {
                eventType: { stringValue: event.eventType },
                timestamp: { timestampValue: event.timestamp },
                metadata: {
                    mapValue: {
                        fields: Object.entries(metadata || {}).reduce((acc: any, [key, val]) => {
                            if (typeof val === 'string') acc[key] = { stringValue: val }
                            else if (typeof val === 'number') acc[key] = { integerValue: val }
                            else if (typeof val === 'boolean') acc[key] = { booleanValue: val }
                            else if (val === null) acc[key] = { nullValue: null }
                            return acc
                        }, {})
                    }
                }
            }

            if (userId) fields.userId = { stringValue: userId }
            if (requestInfo?.sessionId) fields.sessionId = { stringValue: requestInfo.sessionId }
            if (requestInfo?.ip) fields.ip = { stringValue: requestInfo.ip }
            if (requestInfo?.userAgent) fields.userAgent = { stringValue: requestInfo.userAgent }

            await this.firebase.firestore('POST', 'events', { fields })
            console.log(`[Analytics] Logged ${eventType} for ${userId || 'anon'}`)

            if (this.gaMeasurementId && this.gaApiSecret) {
                try {
                    const clientId = userId || requestInfo?.sessionId || 'anonymous_user';
                    const gaPayload = {
                        client_id: clientId,
                        events: [{
                            name: eventType,
                            params: {
                                ...metadata,
                                session_id: requestInfo?.sessionId,
                                engagement_time_msec: '100',
                            }
                        }]
                    };

                    const gaUrl = `https://www.google-analytics.com/mp/collect?measurement_id=${this.gaMeasurementId}&api_secret=${this.gaApiSecret}`;
                    fetch(gaUrl, {
                        method: 'POST',
                        body: JSON.stringify(gaPayload)
                    }).catch(err => console.error('[Analytics] GA fetch error:', err));
                } catch (gaError) {
                    console.error('[Analytics] GA formatting error:', gaError);
                }
            }
        } catch (e) {
            console.error(`[Analytics] Failed to log event ${eventType}:`, e)
        }
    }

    async aggregateDailyStats(dateStr?: string) {
        const targetDate = dateStr || new Date().toISOString().split('T')[0]
        const start = `${targetDate}T00:00:00.000Z`
        const end = `${targetDate}T23:59:59.999Z`

        console.log(`[Analytics] Aggregating stats for ${targetDate}`)

        const events = await this.firebase.query('events', {
            where: {
                compositeFilter: {
                    op: 'AND',
                    filters: [
                        { fieldFilter: { field: { fieldPath: 'timestamp' }, op: 'GREATER_THAN_OR_EQUAL', value: { timestampValue: start } } },
                        { fieldFilter: { field: { fieldPath: 'timestamp' }, op: 'LESS_THAN_OR_EQUAL', value: { timestampValue: end } } }
                    ]
                }
            },
            limit: 10000
        }) as any[]

        const stats = {
            activeUsers: new Set<string>(),
            newUsers: 0,
            revenue: 0,
            generations: 0,
            generationFailures: 0,
            totalLatency: 0,
            latencyCount: 0,
            totalTokens: 0
        }

        for (const doc of events) {
            const e = doc.fields || {}
            const type = e.eventType?.stringValue
            const uid = e.userId?.stringValue

            if (uid) stats.activeUsers.add(uid)

            if (type === 'user_login') {
                const isNew = e.metadata?.mapValue?.fields?.isNewUser?.booleanValue
                if (isNew) stats.newUsers++
            } else if (type === 'payment_success') {
                const amount = parseInt(e.metadata?.mapValue?.fields?.amount?.integerValue || '0')
                stats.revenue += amount
            } else if (type === 'generate_completed') {
                stats.generations++
                const time = parseFloat(e.metadata?.mapValue?.fields?.processingTime?.doubleValue ||
                    e.metadata?.mapValue?.fields?.processingTime?.integerValue || '0')
                if (time > 0) {
                    stats.totalLatency += time
                    stats.latencyCount++
                }
                const tokens = parseInt(e.metadata?.mapValue?.fields?.tokens?.integerValue || e.metadata?.mapValue?.fields?.tokens?.doubleValue || '0')
                stats.totalTokens += tokens
            } else if (type === 'generate_failed') {
                stats.generationFailures++
            }
        }

        const avgLatency = stats.latencyCount > 0 ? (stats.totalLatency / stats.latencyCount) / 1000 : 0
        const finalRevenue = stats.revenue / 100

        const payload = {
            fields: {
                date: { stringValue: targetDate },
                activeUsers: { integerValue: stats.activeUsers.size },
                newUsers: { integerValue: stats.newUsers },
                revenue: { doubleValue: finalRevenue },
                generations: { integerValue: stats.generations },
                generationFailures: { integerValue: stats.generationFailures },
                avgLatency: { doubleValue: avgLatency },
                totalTokens: { integerValue: stats.totalTokens },
                updatedAt: { timestampValue: new Date().toISOString() }
            }
        }

        await this.firebase.firestore('PATCH', `daily_stats/${targetDate}`, payload)

        return {
            date: targetDate,
            activeUsers: stats.activeUsers.size,
            newUsers: stats.newUsers,
            revenue: finalRevenue,
            generations: stats.generations,
            avgLatency,
            totalTokens: stats.totalTokens
        }
    }

    /**
     * Deep Sync: Reconstruct stats from primary collections (users, generations).
     */
    async reconstructDailyStats(dateStr: string) {
        const start = `${dateStr}T00:00:00.000Z`
        const end = `${dateStr}T23:59:59.999Z`

        console.log(`[Analytics] Reconstructing stats for ${dateStr} from primary data`)

        const newUsersRes: any = await this.firebase.query('users', {
            where: {
                compositeFilter: {
                    op: 'AND',
                    filters: [
                        { fieldFilter: { field: { fieldPath: 'createdAt' }, op: 'GREATER_THAN_OR_EQUAL', value: { timestampValue: start } } },
                        { fieldFilter: { field: { fieldPath: 'createdAt' }, op: 'LESS_THAN_OR_EQUAL', value: { timestampValue: end } } }
                    ]
                }
            }
        })
        const newUsersCount = (newUsersRes || []).length

        const gensRes: any = await this.firebase.query('generations', {
            where: {
                compositeFilter: {
                    op: 'AND',
                    filters: [
                        { fieldFilter: { field: { fieldPath: 'createdAt' }, op: 'GREATER_THAN_OR_EQUAL', value: { timestampValue: start } } },
                        { fieldFilter: { field: { fieldPath: 'createdAt' }, op: 'LESS_THAN_OR_EQUAL', value: { timestampValue: end } } }
                    ]
                }
            }
        })
        const gens = gensRes || []
        const activeUsersCount = new Set(gens.map((g: any) => g.fields?.userId?.stringValue)).size

        const eventsRes: any = await this.firebase.query('events', {
            where: {
                compositeFilter: {
                    op: 'AND',
                    filters: [
                        { fieldFilter: { field: { fieldPath: 'eventType' }, op: 'EQUAL', value: { stringValue: 'payment_success' } } },
                        { fieldFilter: { field: { fieldPath: 'timestamp' }, op: 'GREATER_THAN_OR_EQUAL', value: { timestampValue: start } } },
                        { fieldFilter: { field: { fieldPath: 'timestamp' }, op: 'LESS_THAN_OR_EQUAL', value: { timestampValue: end } } }
                    ]
                }
            }
        })
        const revenueCents = (eventsRes || []).reduce((acc: number, e: any) => acc + parseInt(e.fields?.metadata?.mapValue?.fields?.amount?.integerValue || '0'), 0)

        const payload = {
            fields: {
                date: { stringValue: dateStr },
                activeUsers: { integerValue: Math.max(activeUsersCount, newUsersCount) },
                newUsers: { integerValue: newUsersCount },
                revenue: { doubleValue: revenueCents / 100 },
                generations: { integerValue: gens.length },
                generationFailures: { integerValue: 0 },
                avgLatency: { doubleValue: 0 },
                totalTokens: { integerValue: gens.length * 400 },
                updatedAt: { timestampValue: new Date().toISOString() }
            }
        }

        await this.firebase.firestore('PATCH', `daily_stats/${dateStr}`, payload)

        return {
            date: dateStr,
            activeUsers: Math.max(activeUsersCount, newUsersCount),
            newUsers: newUsersCount,
            revenue: revenueCents / 100,
            generations: gens.length,
            totalTokens: gens.length * 400
        }
    }
}
