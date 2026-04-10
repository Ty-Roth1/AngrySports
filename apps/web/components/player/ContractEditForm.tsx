'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface ContractEditFormProps {
  contract: {
    id: string
    league_id: string
    salary: number
    years_total: number
    years_remaining: number
    expires_after_season: number
    contract_type: string
  }
}

export function ContractEditForm({ contract }: ContractEditFormProps) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    salary: contract.salary,
    years_total: contract.years_total,
    years_remaining: contract.years_remaining,
    expires_after_season: contract.expires_after_season,
    contract_type: contract.contract_type,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setError(null)
    const res = await fetch(`/api/leagues/${contract.league_id}/contracts/${contract.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Failed to save')
    } else {
      setEditing(false)
      router.refresh()
    }
    setSaving(false)
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="text-xs text-gray-500 hover:text-red-400 transition-colors"
      >
        Edit contract
      </button>
    )
  }

  return (
    <div className="mt-4 space-y-3 border-t border-gray-800 pt-4">
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Salary ($)</label>
          <input
            type="number"
            min={1}
            value={form.salary}
            onChange={e => setForm(f => ({ ...f, salary: Number(e.target.value) }))}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Contract Type</label>
          <select
            value={form.contract_type}
            onChange={e => setForm(f => ({ ...f, contract_type: e.target.value }))}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500"
          >
            <option value="standard">Standard</option>
            <option value="rookie">Rookie</option>
            <option value="extension">Extension</option>
            <option value="minimum">Minimum</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Years Total</label>
          <input
            type="number"
            min={1}
            value={form.years_total}
            onChange={e => setForm(f => ({ ...f, years_total: Number(e.target.value) }))}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Years Remaining</label>
          <input
            type="number"
            min={0}
            value={form.years_remaining}
            onChange={e => setForm(f => ({ ...f, years_remaining: Number(e.target.value) }))}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500"
          />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-gray-500 block mb-1">Expires After Season</label>
          <input
            type="number"
            value={form.expires_after_season}
            onChange={e => setForm(f => ({ ...f, expires_after_season: Number(e.target.value) }))}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-sm font-medium text-white disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
        <button
          onClick={() => { setEditing(false); setError(null) }}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded text-sm text-gray-300 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
