'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export function TeamLogo({
  teamId,
  logoUrl,
  name,
  size = 40,
  isOwner = false,
}: {
  teamId: string
  logoUrl: string | null
  name: string
  size?: number
  isOwner?: boolean
}) {
  const [url, setUrl] = useState(logoUrl)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  async function handleFile(file: File) {
    setUploading(true)
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await fetch(`/api/teams/${teamId}/logo`, { method: 'POST', body: form })
      if (res.ok) {
        const { logo_url } = await res.json()
        setUrl(logo_url)
        router.refresh()
      }
    } finally {
      setUploading(false)
    }
  }

  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div
      className="relative flex-shrink-0"
      style={{ width: size, height: size }}
      title={isOwner ? 'Click to change team logo' : name}
    >
      <div
        className={`w-full h-full rounded-full overflow-hidden bg-gray-700 flex items-center justify-center text-white font-bold ${isOwner ? 'cursor-pointer hover:ring-2 hover:ring-red-500 transition-all' : ''}`}
        style={{ fontSize: size * 0.35 }}
        onClick={() => isOwner && inputRef.current?.click()}
      >
        {uploading ? (
          <span className="text-gray-400 text-xs">...</span>
        ) : url ? (
          <Image src={url} alt={name} fill className="object-cover" unoptimized />
        ) : (
          initials
        )}
      </div>
      {isOwner && (
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
        />
      )}
    </div>
  )
}
