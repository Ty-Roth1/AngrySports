'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export function SignupForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [confirmationSent, setConfirmationSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    // If email confirmation is required, session will be null until confirmed
    if (data.session) {
      router.push('/dashboard')
      router.refresh()
    } else {
      setError(null)
      setLoading(false)
      // Show confirmation message inline
      setConfirmationSent(true)
    }
  }

  if (confirmationSent) {
    return (
      <div className="text-center space-y-4">
        <div className="text-4xl">📧</div>
        <h2 className="text-lg font-semibold text-white">Check your email</h2>
        <p className="text-sm text-gray-400">
          We sent a confirmation link to <span className="text-white">{email}</span>.
          Click it to activate your account and sign in.
        </p>
        <Link href="/login" className="block text-sm text-blue-400 hover:text-blue-300">
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="displayName" className="block text-sm font-medium text-gray-300 mb-1">
          Display Name
        </label>
        <input
          id="displayName"
          type="text"
          value={displayName}
          onChange={e => setDisplayName(e.target.value)}
          required
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 text-white"
          placeholder="BaseballFan42"
        />
      </div>
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 text-white"
          placeholder="you@example.com"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          minLength={8}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 text-white"
          placeholder="••••••••"
        />
      </div>

      {error && (
        <p className="text-red-400 text-sm">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-900 disabled:text-blue-400 rounded-lg font-semibold transition-colors"
      >
        {loading ? 'Creating account...' : 'Create Account'}
      </button>

      <p className="text-center text-sm text-gray-400">
        Already have an account?{' '}
        <Link href="/login" className="text-blue-400 hover:text-blue-300">
          Sign in
        </Link>
      </p>
    </form>
  )
}
