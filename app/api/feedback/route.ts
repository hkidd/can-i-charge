import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { logError } from '@/lib/error-handling'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { email, message } = body

        // Validate
        if (!message || message.trim().length === 0) {
            return NextResponse.json(
                { error: 'Message is required' },
                { status: 400 }
            )
        }

        if (message.length > 5000) {
            return NextResponse.json(
                { error: 'Message is too long (max 5000 characters)' },
                { status: 400 }
            )
        }

        // Optional email validation
        if (email && email.length > 0) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
            if (!emailRegex.test(email)) {
                return NextResponse.json(
                    { error: 'Invalid email format' },
                    { status: 400 }
                )
            }
        }

        // Get user agent for context
        const userAgent = request.headers.get('user-agent') || 'Unknown'

        // Insert feedback
        const { error } = await supabaseAdmin.from('feedback').insert({
            email: email || null,
            message: message.trim(),
            user_agent: userAgent
        })

        if (error) {
            logError(error, 'api.feedback.insert', { emailProvided: !!email, messageLength: message.trim().length })
            return NextResponse.json(
                { error: 'Failed to submit feedback' },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            message: 'Thank you for your feedback!'
        })
    } catch (error) {
        logError(error, 'api.feedback', { userAgent: request.headers.get('user-agent') })
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
