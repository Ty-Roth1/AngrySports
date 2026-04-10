'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface ChatMessage {
  id: string
  body: string
  created_at: string
  edited_at: string | null
  deleted_at: string | null
  user_id: string
  profile: { display_name: string; avatar_url: string | null } | null
}

interface Reaction {
  id: string
  message_id: string
  user_id: string
  emoji: string
}

const EMOJI_OPTIONS = ['👍', '❤️', '😂', '😮', '🔥', '💯', '⚾', '💀']

function formatTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

export function LeagueChat({
  leagueId,
  currentUserId,
  currentUserName,
  initialMessages,
  initialReactions,
}: {
  leagueId: string
  currentUserId: string
  currentUserName: string
  initialMessages: ChatMessage[]
  initialReactions: Reaction[]
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [reactions, setReactions] = useState<Reaction[]>(initialReactions)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [pickerForMsg, setPickerForMsg] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  // Supabase Realtime subscription
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`chat:${leagueId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'league_chat_messages', filter: `league_id=eq.${leagueId}` },
        async (payload) => {
          const newMsg = payload.new as any
          // Fetch profile for the new message sender
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name, avatar_url')
            .eq('id', newMsg.user_id)
            .single()
          setMessages(prev => {
            // Avoid duplicates (our own POST already added it optimistically)
            if (prev.some(m => m.id === newMsg.id)) return prev
            return [...prev, { ...newMsg, profile }]
          })
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'league_chat_messages', filter: `league_id=eq.${leagueId}` },
        (payload) => {
          const updated = payload.new as any
          setMessages(prev => prev.map(m => m.id === updated.id ? { ...m, ...updated } : m))
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'league_chat_reactions' },
        (payload) => {
          const r = payload.new as Reaction
          setReactions(prev => prev.some(x => x.id === r.id) ? prev : [...prev, r])
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'league_chat_reactions' },
        (payload) => {
          const r = payload.old as Reaction
          setReactions(prev => prev.filter(x => x.id !== r.id))
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [leagueId])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || sending) return
    setSending(true)
    setInput('')

    const res = await fetch(`/api/leagues/${leagueId}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: text }),
    })
    const data = await res.json()
    if (res.ok && data.message) {
      // Optimistically add (realtime may also fire, dedup'd above)
      setMessages(prev => {
        if (prev.some(m => m.id === data.message.id)) return prev
        return [...prev, {
          ...data.message,
          profile: { display_name: currentUserName, avatar_url: null },
        }]
      })
    }
    setSending(false)
    inputRef.current?.focus()
  }, [input, sending, leagueId, currentUserName])

  async function deleteMessage(messageId: string) {
    await fetch(`/api/leagues/${leagueId}/chat`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message_id: messageId }),
    })
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, deleted_at: new Date().toISOString(), body: '[deleted]' } : m))
  }

  async function toggleReaction(messageId: string, emoji: string) {
    setPickerForMsg(null)
    const res = await fetch(`/api/leagues/${leagueId}/chat/reactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message_id: messageId, emoji }),
    })
    const data = await res.json()
    if (data.action === 'removed') {
      setReactions(prev => prev.filter(r => !(r.message_id === messageId && r.user_id === currentUserId && r.emoji === emoji)))
    } else {
      // Will arrive via realtime, but add optimistically
      setReactions(prev => [...prev, { id: `opt-${Date.now()}`, message_id: messageId, user_id: currentUserId, emoji }])
    }
  }

  // Group reactions per message
  function getReactionGroups(messageId: string) {
    const msgReactions = reactions.filter(r => r.message_id === messageId)
    const groups = new Map<string, { count: number; mine: boolean }>()
    for (const r of msgReactions) {
      const existing = groups.get(r.emoji) ?? { count: 0, mine: false }
      groups.set(r.emoji, {
        count: existing.count + 1,
        mine: existing.mine || r.user_id === currentUserId,
      })
    }
    return groups
  }

  return (
    <div className="flex flex-col bg-gray-900 border border-gray-800 rounded-xl overflow-hidden" style={{ height: '70vh' }}>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-gray-600 text-sm">
            No messages yet. Say something!
          </div>
        )}
        {messages.map((msg, i) => {
          const isOwn = msg.user_id === currentUserId
          const prevMsg = messages[i - 1]
          const showHeader = !prevMsg || prevMsg.user_id !== msg.user_id ||
            new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() > 5 * 60 * 1000
          const name = msg.profile?.display_name ?? 'Unknown'
          const reactionGroups = getReactionGroups(msg.id)

          return (
            <div key={msg.id} className={`group relative ${showHeader ? 'mt-4' : 'mt-0.5'}`}>
              {showHeader && (
                <div className={`flex items-center gap-2 mb-1 ${isOwn ? 'flex-row-reverse' : ''}`}>
                  <div className="w-7 h-7 rounded-full bg-red-700 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                    {getInitials(name)}
                  </div>
                  <span className="text-xs font-semibold text-gray-300">{isOwn ? 'You' : name}</span>
                  <span className="text-xs text-gray-600">{formatTime(msg.created_at)}</span>
                </div>
              )}

              <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} pl-9`}>
                <div className="relative max-w-[75%]">
                  <div
                    className={`px-3 py-2 rounded-2xl text-sm leading-relaxed break-words ${
                      msg.deleted_at
                        ? 'text-gray-600 italic bg-transparent'
                        : isOwn
                          ? 'bg-red-700 text-white rounded-tr-sm'
                          : 'bg-gray-800 text-gray-100 rounded-tl-sm'
                    }`}
                  >
                    {msg.body}
                    {msg.edited_at && !msg.deleted_at && (
                      <span className="text-xs opacity-60 ml-1">(edited)</span>
                    )}
                  </div>

                  {/* Reaction bubbles */}
                  {reactionGroups.size > 0 && (
                    <div className={`flex flex-wrap gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                      {[...reactionGroups.entries()].map(([emoji, { count, mine }]) => (
                        <button
                          key={emoji}
                          onClick={() => toggleReaction(msg.id, emoji)}
                          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs border transition-colors ${
                            mine
                              ? 'bg-red-900/50 border-red-700 text-white'
                              : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500'
                          }`}
                        >
                          {emoji} {count}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Hover actions */}
                  {!msg.deleted_at && (
                    <div className={`absolute top-0 ${isOwn ? 'left-0 -translate-x-full pr-2' : 'right-0 translate-x-full pl-2'} opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1`}>
                      <button
                        onClick={() => setPickerForMsg(pickerForMsg === msg.id ? null : msg.id)}
                        className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white text-xs transition-colors"
                        title="React"
                      >
                        😊
                      </button>
                      {isOwn && (
                        <button
                          onClick={() => deleteMessage(msg.id)}
                          className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-800 hover:bg-red-900 text-gray-400 hover:text-red-400 text-xs transition-colors"
                          title="Delete"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  )}

                  {/* Emoji picker */}
                  {pickerForMsg === msg.id && (
                    <div className={`absolute z-10 top-8 ${isOwn ? 'right-0' : 'left-0'} bg-gray-800 border border-gray-700 rounded-xl p-2 flex gap-1 shadow-lg`}>
                      {EMOJI_OPTIONS.map(e => (
                        <button
                          key={e}
                          onClick={() => toggleReaction(msg.id, e)}
                          className="text-lg hover:scale-125 transition-transform p-0.5"
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="border-t border-gray-800 p-3 flex gap-2 items-end">
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              sendMessage()
            }
          }}
          placeholder="Send a message… (Enter to send, Shift+Enter for newline)"
          rows={1}
          maxLength={2000}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-gray-500 transition-colors"
          style={{ minHeight: '40px', maxHeight: '120px' }}
        />
        <button
          onClick={sendMessage}
          disabled={sending || !input.trim()}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-40 rounded-xl text-sm font-semibold transition-colors text-white flex-shrink-0"
        >
          Send
        </button>
      </div>
    </div>
  )
}
