import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const alt = 'Can I Charge? - EV Charging Infrastructure Map'
export const size = {
    width: 1200,
    height: 630
}
export const contentType = 'image/png'

export default function Image() {
    return new ImageResponse(
        (
            <div
                style={{
                    height: '100%',
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#09090b',
                    backgroundImage: 'radial-gradient(circle at 25% 25%, #2e1065 0%, transparent 50%), radial-gradient(circle at 75% 75%, #10b981 0%, transparent 50%)',
                }}
            >
                {/* App Icon */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 120,
                        height: 120,
                        borderRadius: 24,
                        background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                        marginBottom: 32,
                        boxShadow: '0 0 60px rgba(59, 130, 246, 0.5)',
                    }}
                >
                    <svg
                        width="60"
                        height="60"
                        viewBox="0 0 24 24"
                        fill="none"
                    >
                        <path
                            d="M13 2L3 14h8l-1 8 10-12h-8l1-8z"
                            fill="white"
                            stroke="white"
                            strokeWidth="1"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                </div>

                {/* Title */}
                <div
                    style={{
                        fontSize: 72,
                        fontWeight: 'bold',
                        background: 'linear-gradient(90deg, #ecfdf5 0%, #10b981 50%, #06b6d4 100%)',
                        backgroundClip: 'text',
                        color: 'transparent',
                        marginBottom: 16,
                        textAlign: 'center',
                    }}
                >
                    Can I Charge?
                </div>

                {/* Subtitle */}
                <div
                    style={{
                        fontSize: 32,
                        color: '#ecfdf5',
                        opacity: 0.8,
                        textAlign: 'center',
                        marginBottom: 48,
                    }}
                >
                    EV Charging Infrastructure Scores
                </div>

                {/* Feature highlights */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 48,
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div
                            style={{
                                width: 12,
                                height: 12,
                                borderRadius: '50%',
                                backgroundColor: '#10b981',
                                boxShadow: '0 0 20px rgba(16, 185, 129, 0.8)',
                            }}
                        />
                        <span style={{ fontSize: 24, color: '#ecfdf5' }}>Real-time Data</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div
                            style={{
                                width: 12,
                                height: 12,
                                borderRadius: '50%',
                                backgroundColor: '#06b6d4',
                                boxShadow: '0 0 20px rgba(6, 182, 212, 0.8)',
                            }}
                        />
                        <span style={{ fontSize: 24, color: '#ecfdf5' }}>Traffic Analysis</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div
                            style={{
                                width: 12,
                                height: 12,
                                borderRadius: '50%',
                                backgroundColor: '#6366f1',
                                boxShadow: '0 0 20px rgba(99, 102, 241, 0.8)',
                            }}
                        />
                        <span style={{ fontSize: 24, color: '#ecfdf5' }}>Interactive Map</span>
                    </div>
                </div>
            </div>
        ),
        {
            ...size,
        }
    )
}