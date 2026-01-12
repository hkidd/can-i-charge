import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM_EMAIL = 'Can I Charge <noreply@canicharge.com>'

export async function sendApiKeyEmail(params: {
    to: string
    apiKey: string
}): Promise<{ success: boolean; error?: string }> {
    try {
        const { data, error } = await resend.emails.send({
            from: FROM_EMAIL,
            to: params.to,
            subject: 'Your Can I Charge API Key',
            html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 20px;">
    <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <!-- Header -->
        <div style="background: #030712; padding: 32px; text-align: center;">
            <div style="display: inline-flex; align-items: center; gap: 8px;">
                <div style="width: 32px; height: 32px; background: #2563eb; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                    <span style="color: white; font-size: 16px;">⚡</span>
                </div>
                <span style="color: white; font-size: 20px; font-weight: 600;">Can I Charge<span style="color: #3b82f6;">?</span></span>
            </div>
        </div>

        <!-- Content -->
        <div style="padding: 32px;">
            <h1 style="color: #111827; font-size: 24px; margin: 0 0 16px 0;">Welcome to Pro!</h1>
            <p style="color: #6b7280; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                Thanks for subscribing. Here's your API key to start integrating EV readiness scores into your application.
            </p>

            <!-- API Key Box -->
            <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                <p style="color: #6b7280; font-size: 12px; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 0.05em;">Your API Key</p>
                <code style="display: block; background: #111827; color: #10b981; padding: 12px; border-radius: 6px; font-size: 14px; word-break: break-all;">${params.apiKey}</code>
            </div>

            <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 24px 0;">
                <strong style="color: #111827;">Keep this key secure.</strong> Don't share it publicly or commit it to version control. You can use environment variables to keep it safe.
            </p>

            <!-- CTA Buttons -->
            <div style="margin-bottom: 24px;">
                <a href="https://canicharge.com/docs" style="display: inline-block; background: #2563eb; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px; margin-right: 8px;">Read the Docs</a>
                <a href="https://canicharge.com/widget-demo" style="display: inline-block; background: #f3f4f6; color: #374151; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px;">Try the Widget</a>
            </div>

            <p style="color: #9ca3af; font-size: 14px; margin: 0;">
                Questions? Reply to this email or visit our <a href="https://canicharge.com/support" style="color: #2563eb;">support page</a>.
            </p>
        </div>

        <!-- Footer -->
        <div style="background: #f9fafb; padding: 24px 32px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0; text-align: center;">
                © ${new Date().getFullYear()} Can I Charge? • <a href="https://canicharge.com" style="color: #6b7280;">canicharge.com</a>
            </p>
        </div>
    </div>
</body>
</html>
            `,
        })

        if (error) {
            console.error('Error sending email:', error)
            return { success: false, error: error.message }
        }

        return { success: true }
    } catch (err) {
        console.error('Error sending email:', err)
        return { success: false, error: 'Failed to send email' }
    }
}

export async function sendApiKeyReminderEmail(params: {
    to: string
    apiKey: string
}): Promise<{ success: boolean; error?: string }> {
    try {
        const { data, error } = await resend.emails.send({
            from: FROM_EMAIL,
            to: params.to,
            subject: 'Your Can I Charge API Key',
            html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 20px;">
    <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <!-- Header -->
        <div style="background: #030712; padding: 32px; text-align: center;">
            <div style="display: inline-flex; align-items: center; gap: 8px;">
                <div style="width: 32px; height: 32px; background: #2563eb; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                    <span style="color: white; font-size: 16px;">⚡</span>
                </div>
                <span style="color: white; font-size: 20px; font-weight: 600;">Can I Charge<span style="color: #3b82f6;">?</span></span>
            </div>
        </div>

        <!-- Content -->
        <div style="padding: 32px;">
            <h1 style="color: #111827; font-size: 24px; margin: 0 0 16px 0;">Here's your API key</h1>
            <p style="color: #6b7280; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                You requested a reminder of your API key. Here it is:
            </p>

            <!-- API Key Box -->
            <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                <p style="color: #6b7280; font-size: 12px; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 0.05em;">Your API Key</p>
                <code style="display: block; background: #111827; color: #10b981; padding: 12px; border-radius: 6px; font-size: 14px; word-break: break-all;">${params.apiKey}</code>
            </div>

            <p style="color: #9ca3af; font-size: 14px; margin: 0;">
                Didn't request this? You can safely ignore this email.
            </p>
        </div>

        <!-- Footer -->
        <div style="background: #f9fafb; padding: 24px 32px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0; text-align: center;">
                © ${new Date().getFullYear()} Can I Charge? • <a href="https://canicharge.com" style="color: #6b7280;">canicharge.com</a>
            </p>
        </div>
    </div>
</body>
</html>
            `,
        })

        if (error) {
            console.error('Error sending email:', error)
            return { success: false, error: error.message }
        }

        return { success: true }
    } catch (err) {
        console.error('Error sending email:', err)
        return { success: false, error: 'Failed to send email' }
    }
}
