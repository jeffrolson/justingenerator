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

    constructor(firebase: Firebase) {
        this.firebase = firebase
    }

    /**
     * Log a raw event to the 'events' collection.
     * Fire-and-forget style (we await it but don't block critical flows if possible).
     */
    async logEvent(
        eventType: string,
        userId: string | undefined, // undefined for anonymous
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

            // Firestore format
            const fields: any = {
                eventType: { stringValue: event.eventType },
                timestamp: { timestampValue: event.timestamp },
                metadata: {
                    mapValue: {
                        fields: Object.entries(metadata || {}).reduce((acc: any, [key, val]) => {
                            if (typeof val === 'string') acc[key] = { stringValue: val }
                            else if (typeof val === 'number') acc[key] = { integerValue: val } // or double
                            else if (typeof val === 'boolean') acc[key] = { booleanValue: val }
                            else if (val === null) acc[key] = { nullValue: null }
                            // Simple handling for now, can extend for arrays/objects if needed
                            return acc
                        }, {})
                    }
                }
            }

            if (userId) fields.userId = { stringValue: userId }
            if (requestInfo?.sessionId) fields.sessionId = { stringValue: requestInfo.sessionId }
            if (requestInfo?.ip) fields.ip = { stringValue: requestInfo.ip }
            if (requestInfo?.userAgent) fields.userAgent = { stringValue: requestInfo.userAgent }

            // Use a new doc ID
            // Note: In high volume, we might want to batch these or use a different ingest method
            // But for this project scope, direct Firestore writes are fine.
            await this.firebase.firestore('create', 'events', { fields })
            console.log(`[Analytics] Logged ${eventType} for ${userId || 'anon'}`)
        } catch (e) {
            console.error(`[Analytics] Failed to log event ${eventType}:`, e)
            // Don't throw, we don't want to break the app
        }
    }

    /**
     * Helper to update daily aggregated stats.
     * In a real system, this might run on a schedule or trigger.
     * Here we can call it periodically or "on write" for critical stats if needed.
     * For now, this is a placeholder for the aggregation logic we will build.
     */
    async aggregateDailyStats(dateStr?: string) {
        const targetDate = dateStr || new Date().toISOString().split('T')[0]
        const start = `${targetDate}T00:00:00.000Z`
        const end = `${targetDate}T23:59:59.999Z`

        console.log(`[Analytics] Aggregating stats for ${targetDate}`)

        // 1. Fetch all events for the day
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
            limit: 10000 // Cap for safety, pagination needed for scale
        }) as any[]

        // 2. Calculate Metrics
        const stats = {
            activeUsers: new Set<string>(),
            newUsers: 0,
            revenue: 0,
            generations: 0,
            generationFailures: 0,
            totalLatency: 0,
            latencyCount: 0
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
                // metadata.amount is integer cents
                const amount = parseInt(e.metadata?.mapValue?.fields?.amount?.integerValue || '0')
                stats.revenue += amount
            } else if (type === 'generate_completed') {
                stats.generations++
                // processingTime usually in metadata
                const time = parseFloat(e.metadata?.mapValue?.fields?.processingTime?.doubleValue ||
                    e.metadata?.mapValue?.fields?.processingTime?.integerValue || '0')
                if (time > 0) {
                    stats.totalLatency += time
                    stats.latencyCount++
                }
            } else if (type === 'generate_failed') {
                stats.generationFailures++
            }
        }

        const avgLatency = stats.latencyCount > 0 ? (stats.totalLatency / stats.latencyCount) / 1000 : 0 // Seconds
        const finalRevenue = stats.revenue / 100 // Dollars

        // 3. Write to daily_stats collection
        const docId = targetDate
        const payload = {
            fields: {
                date: { stringValue: targetDate },
                activeUsers: { integerValue: stats.activeUsers.size },
                newUsers: { integerValue: stats.newUsers },
                revenue: { doubleValue: finalRevenue },
                generations: { integerValue: stats.generations },
                generationFailures: { integerValue: stats.generationFailures },
                avgLatency: { doubleValue: avgLatency },
                updatedAt: { timestampValue: new Date().toISOString() }
            }
        }

        console.log(`[Analytics] Wrote stats for ${targetDate}:`, JSON.stringify(payload.fields))
        await this.firebase.firestore('PATCH', `daily_stats/${docId}`, payload)

        return {
            date: targetDate,
            activeUsers: stats.activeUsers.size,
            newUsers: stats.newUsers,
            revenue: finalRevenue,
            generations: stats.generations,
            avgLatency
        }
    }
}
