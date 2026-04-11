'use client'

import { useState, useRef } from 'react'

export function NicknameEditor({
  rosterId,
  initialNickname,
}: {
  rosterId: string
  initialNickname: string | null
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(initialNickname ?? '')
  const [saved, setSaved] = useState(initialNickname ?? '')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function save() {
    setLoading(true)
    try {
      const res = await fetch('/api/rosters/nickname', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roster_id: rosterId, nickname: value }),
      })
      if (res.ok) {
        const trimmed = value.trim()
        setSaved(trimmed)
        setValue(trimmed)
        setEditing(false)
      }
    } finally {
      setLoading(false)
    }
  }

  function startEdit() {
    setEditing(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function cancel() {
    setValue(saved)
    setEditing(false)
  }

  if (editing) {
    return (
      <span className="inline-flex items-center gap-2 mt-1">
        <input
          ref={inputRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel() }}
          maxLength={32}
          placeholder="Enter nickname…"
          className="bg-gray-800 border border-gray-600 rounded px-2 py-0.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gray-400 w-44"
        />
        <button
          onClick={save}
          disabled={loading}
          className="text-xs text-green-400 hover:text-green-300 disabled:opacity-50"
        >
          Save
        </button>
        <button onClick={cancel} className="text-xs text-gray-500 hover:text-gray-300">
          Cancel
        </button>
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-2 mt-1">
      {saved ? (
        <span className="text-gray-400 text-lg italic">"{saved}"</span>
      ) : null}
      <button
        onClick={startEdit}
        className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
      >
        {saved ? 'edit' : '+ nickname'}
      </button>
    </span>
  )
}
