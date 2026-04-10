'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function AccountPage() {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const [nameLoading, setNameLoading] = useState(false)
  const [pwMsg, setPwMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [nameMsg, setNameMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const supabase = createClient()

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      setPwMsg({ type: 'err', text: 'Passwords do not match.' })
      return
    }
    if (newPassword.length < 8) {
      setPwMsg({ type: 'err', text: 'Password must be at least 8 characters.' })
      return
    }
    setPwLoading(true)
    setPwMsg(null)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) {
      setPwMsg({ type: 'err', text: error.message })
    } else {
      setPwMsg({ type: 'ok', text: 'Password updated successfully.' })
      setNewPassword('')
      setConfirmPassword('')
    }
    setPwLoading(false)
  }

  async function changeDisplayName(e: React.FormEvent) {
    e.preventDefault()
    if (!displayName.trim()) return
    setNameLoading(true)
    setNameMsg(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setNameMsg({ type: 'err', text: 'Not signed in.' }); setNameLoading(false); return }

    const { error } = await supabase
      .from('profiles')
      .update({ display_name: displayName.trim() })
      .eq('id', user.id)

    if (error) {
      setNameMsg({ type: 'err', text: error.message })
    } else {
      setNameMsg({ type: 'ok', text: 'Display name updated.' })
    }
    setNameLoading(false)
  }

  return (
    <div className="max-w-lg mx-auto py-12 px-4 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Account Settings</h1>
        <p className="text-gray-400 text-sm mt-1">Update your password and profile info.</p>
      </div>

      {/* Change display name */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
        <h2 className="font-semibold text-white">Display Name</h2>
        <form onSubmit={changeDisplayName} className="space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">New display name</label>
            <input
              type="text"
              required
              autoComplete="off"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Your name"
              className="input"
            />
          </div>
          {nameMsg && (
            <p className={`text-sm ${nameMsg.type === 'ok' ? 'text-green-400' : 'text-red-400'}`}>
              {nameMsg.text}
            </p>
          )}
          <button
            type="submit"
            disabled={nameLoading}
            className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg text-sm font-semibold transition-colors text-white"
          >
            {nameLoading ? 'Saving…' : 'Update Name'}
          </button>
        </form>
      </div>

      {/* Change password */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
        <h2 className="font-semibold text-white">Change Password</h2>
        <form onSubmit={changePassword} className="space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">New password</label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              className="input"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Confirm new password</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Repeat password"
              className="input"
            />
          </div>
          {pwMsg && (
            <p className={`text-sm ${pwMsg.type === 'ok' ? 'text-green-400' : 'text-red-400'}`}>
              {pwMsg.text}
            </p>
          )}
          <button
            type="submit"
            disabled={pwLoading}
            className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg text-sm font-semibold transition-colors text-white"
          >
            {pwLoading ? 'Updating…' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  )
}
