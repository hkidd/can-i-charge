import { NextRequest, NextResponse } from 'next/server'
import { getApiKeyByEmail } from '@/lib/api-keys'
import { sendApiKeyReminderEmail } from '@/lib/email'
import { rateLimit, getClientId } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
    // Rate limit - max 3 requests per hour per IP
    const clientId = getClientId(request)
    const rateLimitResult = rateLimit({
        id: `resend-key-${clientId}`,
        limit: 3,
        duration: 3600000, // 1 hour
    })

    if (!rateLimitResult.success) {
        return NextResponse.json(
            { error: 'Too many requests. Please try again later.' },
            { status: 429 }
        )
    }

    try {
        const body = await request.json()
        const { email } = body

        if (!email || typeof email !== 'string') {
            return NextResponse.json(
                { error: 'Email is required' },
                { status: 400 }
            )
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email)) {
            return NextResponse.json(
                { error: 'Invalid email format' },
                { status: 400 }
            )
        }

        // Look up API key
        const result = await getApiKeyByEmail(email)

        // Always return success to prevent email enumeration
        // but only send email if key exists
        if (result.success && result.apiKey) {
            await sendApiKeyReminderEmail({
                to: email,
                apiKey: result.apiKey,
            })
        }

        // Generic success message (don't reveal if email exists)
        return NextResponse.json({
            success: true,
            message: 'If an active subscription exists for this email, your API key has been sent.',
        })
    } catch (error) {
        console.error('Error resending API key:', error)
        return NextResponse.json(
            { error: 'Failed to process request' },
            { status: 500 }
        )
    }
}
