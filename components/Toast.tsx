'use client'

import { useEffect, useState } from 'react'
import type { ToastMessage } from '@/lib/error-handling'

interface ToastProps {
  message: ToastMessage
  onDismiss: (id: string) => void
}

export function Toast({ message, onDismiss }: ToastProps) {
  useEffect(() => {
    if (message.duration) {
      const timer = setTimeout(() => {
        onDismiss(message.id)
      }, message.duration)
      return () => clearTimeout(timer)
    }
  }, [message, onDismiss])

  const bgColor = {
    error: 'bg-red-500',
    warning: 'bg-yellow-500',
    info: 'bg-blue-500',
    success: 'bg-green-500'
  }[message.level]

  const icon = {
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
    success: '✓'
  }[message.level]

  return (
    <div className={`${bgColor} text-white p-4 rounded-lg shadow-lg flex items-start gap-3 min-w-[300px] max-w-md animate-slide-in`}>
      <span className="text-xl flex-shrink-0">{icon}</span>
      <div className="flex-1">
        <h3 className="font-semibold">{message.title}</h3>
        {message.message && (
          <p className="text-sm mt-1 opacity-90">{message.message}</p>
        )}
      </div>
      <button
        onClick={() => onDismiss(message.id)}
        className="text-xl opacity-70 hover:opacity-100 transition-opacity flex-shrink-0"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  )
}

interface ToastContainerProps {
  messages: ToastMessage[]
  onDismiss: (id: string) => void
}

export function ToastContainer({ messages, onDismiss }: ToastContainerProps) {
  if (messages.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {messages.map(message => (
        <Toast key={message.id} message={message} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

// Custom hook for managing toasts
export function useToast() {
  const [messages, setMessages] = useState<ToastMessage[]>([])

  const showToast = (
    level: ToastMessage['level'],
    title: string,
    message?: string,
    duration: number = 5000
  ) => {
    const id = Math.random().toString(36).substr(2, 9)
    setMessages(prev => [...prev, { id, level, title, message, duration }])
  }

  const dismissToast = (id: string) => {
    setMessages(prev => prev.filter(msg => msg.id !== id))
  }

  return {
    messages,
    showToast,
    dismissToast,
    showError: (title: string, message?: string) => showToast('error', title, message),
    showWarning: (title: string, message?: string) => showToast('warning', title, message),
    showInfo: (title: string, message?: string) => showToast('info', title, message),
    showSuccess: (title: string, message?: string) => showToast('success', title, message, 2000)
  }
}