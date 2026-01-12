import { NextRequest, NextResponse } from 'next/server'
import { createApiKey, revokeApiKey } from '@/lib/api-keys'
import { sendApiKeyEmail } from '@/lib/email'
import crypto from 'crypto'

// Verify webhook signature from Polar
function verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string
): boolean {
    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex')

    return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
    )
}

export async function POST(request: NextRequest) {
    try {
        const payload = await request.text()
        const signature = request.headers.get('webhook-signature') ||
                          request.headers.get('x-polar-signature') || ''

        // Verify webhook signature - required when secret is configured
        const webhookSecret = process.env.POLAR_WEBHOOK_SECRET
        if (webhookSecret) {
            if (!signature) {
                console.error('Missing webhook signature')
                return NextResponse.json(
                    { error: 'Missing signature' },
                    { status: 401 }
                )
            }

            const isValid = verifyWebhookSignature(payload, signature, webhookSecret)
            if (!isValid) {
                console.error('Invalid webhook signature')
                return NextResponse.json(
                    { error: 'Invalid signature' },
                    { status: 401 }
                )
            }
        }

        const event = JSON.parse(payload)
        console.log('Polar webhook received:', event.type)

        // Handle different event types
        switch (event.type) {
            case 'subscription.created':
            case 'subscription.active': {
                // New subscription - create API key and send email
                const subscription = event.data
                const customerEmail = subscription.customer?.email ||
                                     subscription.user?.email ||
                                     subscription.email

                if (!customerEmail) {
                    console.error('No customer email in subscription event')
                    return NextResponse.json(
                        { error: 'No customer email' },
                        { status: 400 }
                    )
                }

                // Create API key
                const result = await createApiKey({
                    email: customerEmail,
                    polarCustomerId: subscription.customer?.id || subscription.user?.id,
                    polarSubscriptionId: subscription.id,
                })

                if (!result.success || !result.apiKey) {
                    console.error('Failed to create API key:', result.error)
                    return NextResponse.json(
                        { error: 'Failed to create API key' },
                        { status: 500 }
                    )
                }

                // Send welcome email with API key
                const emailResult = await sendApiKeyEmail({
                    to: customerEmail,
                    apiKey: result.apiKey,
                })

                if (!emailResult.success) {
                    console.error('Failed to send email:', emailResult.error)
                    // Don't fail the webhook - key was created, email can be resent
                }

                console.log(`API key created and emailed to ${customerEmail}`)
                break
            }

            case 'subscription.canceled':
            case 'subscription.revoked': {
                // Subscription cancelled - revoke API key
                const subscription = event.data

                if (subscription.id) {
                    const result = await revokeApiKey(subscription.id)
                    if (!result.success) {
                        console.error('Failed to revoke API key:', result.error)
                    } else {
                        console.log(`API key revoked for subscription ${subscription.id}`)
                    }
                }
                break
            }

            case 'subscription.updated': {
                // Subscription updated - check if status changed
                const subscription = event.data

                if (subscription.status === 'canceled' || subscription.status === 'revoked') {
                    const result = await revokeApiKey(subscription.id)
                    if (!result.success) {
                        console.error('Failed to revoke API key:', result.error)
                    }
                }
                break
            }

            default:
                console.log(`Unhandled webhook event type: ${event.type}`)
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
