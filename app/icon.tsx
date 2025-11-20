import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const size = {
    width: 32,
    height: 32
}

export const contentType = 'image/png'

export default function Icon() {
    return new ImageResponse(
        (
            <div
                style={{
                    background:
                        'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '6px'
                }}
            >
                <svg
                    width='20'
                    height='20'
                    viewBox='0 0 24 24'
                    fill='none'
                    xmlns='http://www.w3.org/2000/svg'
                >
                    <path
                        d='M13 2L3 14h8l-1 8 10-12h-8l1-8z'
                        fill='white'
                        stroke='white'
                        strokeWidth='1'
                        strokeLinecap='round'
                        strokeLinejoin='round'
                    />
                </svg>
            </div>
        ),
        {
            ...size
        }
    )
}
