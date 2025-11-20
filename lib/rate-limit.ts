// Simple in-memory rate limiter for development and basic production use
// For production scale, consider using Redis or Upstash

interface RateLimitData {
    count: number
    resetTime: number
}

const rateLimitMap = new Map<string, RateLimitData>()

// Cleanup old entries every 10 minutes
setInterval(() => {
    const now = Date.now()
    for (const [key, data] of rateLimitMap.entries()) {
        if (now > data.resetTime) {
            rateLimitMap.delete(key)
        }
    }
}, 10 * 60 * 1000)

export interface RateLimitResult {
    success: boolean
    limit: number
    remaining: number
    resetTime: number
}

export function rateLimit({
    id,
    limit = 10,
    duration = 60000 // 1 minute
}: {
    id: string
    limit?: number
    duration?: number
}): RateLimitResult {
    const now = Date.now()
    const existing = rateLimitMap.get(id)
    
    // If no existing data or window has passed, create new entry
    if (!existing || now > existing.resetTime) {
        const resetTime = now + duration
        rateLimitMap.set(id, { count: 1, resetTime })
        return {
            success: true,
            limit,
            remaining: limit - 1,
            resetTime
        }
    }
    
    // Check if limit exceeded
    if (existing.count >= limit) {
        return {
            success: false,
            limit,
            remaining: 0,
            resetTime: existing.resetTime
        }
    }
    
    // Increment count
    existing.count++
    rateLimitMap.set(id, existing)
    
    return {
        success: true,
        limit,
        remaining: limit - existing.count,
        resetTime: existing.resetTime
    }
}

export function getClientId(request: Request): string {
    // Try to get IP address from headers (works with most hosting providers)
    const forwardedFor = request.headers.get('x-forwarded-for')
    const realIp = request.headers.get('x-real-ip')
    
    if (forwardedFor) {
        return forwardedFor.split(',')[0].trim()
    }
    
    if (realIp) {
        return realIp
    }
    
    // Fallback to user-agent + some randomness (less reliable but better than nothing)
    const userAgent = request.headers.get('user-agent') || 'unknown'
    return `fallback-${userAgent.slice(0, 20)}`
}