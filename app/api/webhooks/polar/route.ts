import { NextRequest, NextResponse } from 'next/server'
import { applySubscriptionEvent, subscriptionSchema } from '@/lib/subscription-access'
import { webhooks } from '@polar-sh/sdk/2026-10'
import { z } from 'zod'

const handledSubscriptionEvents = new Set([
    'subscription.created', 'subscription.active', 'subscription.canceled',
    'subscription.revoked', 'subscription.updated', 'subscription.uncanceled',
    'subscription.past_due', 'subscription.paused', 'subscription.resumed', 'subscription.trial_ended'
])

export async function POST(request: NextRequest) {
    const webhookSecret = process.env.POLAR_WEBHOOK_SECRET
    if (!webhookSecret?.trim()) {
        return NextResponse.json(
            { error: 'Webhook service is not configured' },
            { status: 503 }
        )
    }

    try {
        const payload = await request.text()
        let event: Awaited<ReturnType<typeof webhooks.validateEvent>>
        try {
            event = await webhooks.validateEvent(payload, {
                'webhook-id': request.headers.get('webhook-id') || '',
                'webhook-timestamp': request.headers.get('webhook-timestamp') || '',
                'webhook-signature': request.headers.get('webhook-signature') || ''
            }, webhookSecret)
        } catch (error) {
            if (error instanceof webhooks.PolarWebhookVerificationError) {
                return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 })
            }
            return NextResponse.json({ error: 'Invalid webhook event' }, { status: 400 })
        }

        if (handledSubscriptionEvents.has(event.type)) {
            if (!process.env.POLAR_PRODUCT_ID?.trim()) {
                return NextResponse.json({ error: 'Subscription product is not configured' }, { status: 503 })
            }
            const subscription = subscriptionSchema.safeParse(event.data)
            const timestamp = z.iso.datetime({ offset: true }).safeParse(event.timestamp)
            if (!subscription.success || !timestamp.success) {
                return NextResponse.json({ error: 'Invalid subscription event' }, { status: 400 })
            }
            await applySubscriptionEvent(event.type, timestamp.data, subscription.data)
        }

        return NextResponse.json({ received: true })
    } catch (error) {
        console.error('Webhook error:', error)
        return NextResponse.json(
            { error: 'Webhook processing failed' },
            { status: 500 }
        )
    }
}
