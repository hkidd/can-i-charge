import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
    return new ImageResponse(
        (
            <div
                style={{
                    background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '6px',
                    border: '1px solid #334155'
                }}
            >
                <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    style={{
                        filter: 'drop-shadow(0 0 4px #10b981)'
                    }}
                >
                    <path
                        d="M13 2L3 14h8l-1 8 10-12h-8l1-8z"
                        fill="#10b981"
                        stroke="#10b981"
                        strokeWidth="1"
                    />
                </svg>
            </div>
        ),
        { ...size }
    )
}