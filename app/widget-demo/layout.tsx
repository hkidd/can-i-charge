'use client'

export default function WidgetDemoLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="widget-demo-container">
            <style jsx global>{`
                html, body {
                    overflow: auto !important;
                    position: static !important;
                    height: auto !important;
                }
            `}</style>
            {children}
        </div>
    )
}
