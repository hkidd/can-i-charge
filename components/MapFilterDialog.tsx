'use client'

import { useEffect, useRef, type ReactNode } from 'react'

export default function MapFilterDialog({ children, titleId, onDismiss }: {
    children: ReactNode
    titleId: string
    onDismiss: () => void
}) {
    const dialogRef = useRef<HTMLDialogElement>(null)

    useEffect(() => {
        const dialog = dialogRef.current!
        const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
        dialog.showModal()
        return () => {
            dialog.close()
            if (opener?.isConnected) opener.focus({ preventScroll: true })
        }
    }, [])

    return (
        <dialog
            ref={dialogRef}
            aria-labelledby={titleId}
            className='fixed inset-x-0 bottom-0 top-auto m-0 w-full max-w-none max-h-none border-0 bg-transparent p-0 text-foreground backdrop:bg-black/60 backdrop:backdrop-blur-sm'
            onCancel={event => {
                event.preventDefault()
                onDismiss()
            }}
            onKeyDown={event => {
                if (event.key !== 'Tab') return
                const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
                    'button, a[href], input, select, textarea, [tabindex]'
                )).filter(element => element.tabIndex >= 0 &&
                    !element.matches(':disabled') && element.getClientRects().length > 0)
                const first = controls[0]
                const last = controls.at(-1)
                if (event.shiftKey && document.activeElement === first && last) {
                    event.preventDefault()
                    last.focus()
                } else if (!event.shiftKey && document.activeElement === last && first) {
                    event.preventDefault()
                    first.focus()
                }
            }}
            onClick={event => {
                if (event.target !== event.currentTarget) return
                const bounds = event.currentTarget.getBoundingClientRect()
                if (event.clientY < bounds.top || event.clientY > bounds.bottom ||
                    event.clientX < bounds.left || event.clientX > bounds.right) onDismiss()
            }}
        >
            {children}
        </dialog>
    )
}
