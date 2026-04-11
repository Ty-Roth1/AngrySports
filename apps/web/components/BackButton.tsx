'use client'

import { useRouter } from 'next/navigation'

export function BackButton({ className }: { className?: string }) {
  const router = useRouter()
  return (
    <button
      onClick={() => router.back()}
      className={className ?? 'text-gray-400 hover:text-white transition-colors text-sm'}
      aria-label="Go back"
    >
      ✕
    </button>
  )
}
