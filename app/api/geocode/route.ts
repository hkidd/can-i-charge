import { NextRequest, NextResponse } from 'next/server'
import { searchAddress } from '@/lib/geocoding'
import { z } from 'zod'
import { logError } from '@/lib/error-handling'

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const address = searchParams.get('address')

    if (!address) {
        return NextResponse.json(
            { error: 'Address parameter is required' },
            { status: 400 }
        )
    }

    try {
        const result = await searchAddress(address)

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 404 })
        }

        // Define and validate response schema
        const ResponseSchema = z.object({
            success: z.literal(true),
            latitude: z.number(),
            longitude: z.number(),
            formatted_address: z.string()
        })
        
        const response = {
            success: true as const,
            latitude: result.latitude!,
            longitude: result.longitude!,
            formatted_address: result.formatted_address!
        }
        
        const validatedResponse = ResponseSchema.parse(response)
        return NextResponse.json(validatedResponse)
    } catch (error) {
        logError(error, 'api.geocode', { address })
        
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: 'Invalid geocoding response format' },
                { status: 500 }
            )
        }
        
        return NextResponse.json(
            { error: 'Geocoding service unavailable' },
            { status: 500 }
        )
    }
}
