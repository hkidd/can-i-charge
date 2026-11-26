import { NextRequest } from 'next/server'
import { GET as refresh } from '../daily-refresh/route'

export const maxDuration = 300
export async function POST(request: NextRequest) { return refresh(request) }
export async function GET(request: NextRequest) { return refresh(request) }
