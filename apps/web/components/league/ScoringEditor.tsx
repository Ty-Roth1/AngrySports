'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Category {
  id: string
  stat_key: string
  label: string
  points_per_unit: number
  is_batting: boolean
  is_pitching: boolean
  is_negative: boolean
  sort_order: number
}

const BLANK_CATEGORY: Omit<Category, 'id'> = {
  stat_key: '',
  label: '',
  points_per_unit: 1,
  is_batting: false,
  is_pitching: false,
  is_negative: false,
  sort_order: 99,
}

export function ScoringEditor({ leagueId, initialCategories }: {
  leagueId: string
  initialCategories: Category[]
}) {
  const [categories, setCategories] = useState<Category[]>(initialCategories)
  const [saving, setSaving] = useState<string | null>(null)
  const [addingNew, setAddingNew] = useState(false)
  const [newCat, setNewCat] = useState({ ...BLANK_CATEGORY })
  const [status, setStatus] = useState<string | null>(null)

  const supabase = createClient()

  async function updateCategory(id: string, points: number) {
    setSaving(id)
    const { error } = await supabase
      .from('scoring_categories')
      .update({ points_per_unit: points })
      .eq('id', id)

    if (!error) {
      setCategories(prev => prev.map(c => c.id === id ? { ...c, points_per_unit: points } : c))
    }
    setSaving(null)
  }

  async function deleteCategory(id: string) {
    if (!confirm('Remove this scoring category?')) return
    const { error } = await supabase.from('scoring_categories').delete().eq('id', id)
    if (!error) setCategories(prev => prev.filter(c => c.id !== id))
  }

  async function addCategory() {
    if (!newCat.stat_key || !newCat.label) return
    setSaving('new')
    const { data, error } = await supabase
      .from('scoring_categories')
      .insert({ ...newCat, league_id: leagueId })
      .select()
      .single()

    if (!error && data) {
      setCategories(prev => [...prev, data])
      setNewCat({ ...BLANK_CATEGORY })
      setAddingNew(false)
      setStatus('Category added.')
    } else {
      setStatus(error?.message ?? 'Error adding category.')
    }
    setSaving(null)
  }

  const batting = categories.filter(c => c.is_batting)
  const pitching = categories.filter(c => c.is_pitching)

  return (
    <div className="space-y-6">
      {[
        { label: 'Batting', items: batting },
        { label: 'Pitching', items: pitching },
      ].map(section => (
        <div key={section.label} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-800 bg-gray-800/50">
            <h3 className="font-semibold text-sm">{section.label}</h3>
          </div>
          <table className="w-full text-sm text-white">
            <thead>
              <tr className="text-gray-400 text-xs uppercase tracking-wide border-b border-gray-800">
                <th className="text-left px-5 py-2.5">Category</th>
                <th className="text-left px-5 py-2.5">Stat Key</th>
                <th className="text-center px-5 py-2.5">Points / Unit</th>
                <th className="px-5 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {section.items.map(cat => (
                <tr key={cat.id} className="border-b border-gray-800 last:border-0">
                  <td className="px-5 py-3">
                    <span className={cat.is_negative ? 'text-red-400' : 'text-white'}>{cat.label}</span>
                  </td>
                  <td className="px-5 py-3 text-gray-400 font-mono text-xs">{cat.stat_key}</td>
                  <td className="px-5 py-3 text-center">
                    <input
                      type="number"
                      step="0.5"
                      defaultValue={cat.points_per_unit}
                      onBlur={e => {
                        const val = parseFloat(e.target.value)
                        if (!isNaN(val) && val !== cat.points_per_unit) updateCategory(cat.id, val)
                      }}
                      className="w-20 text-center bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm focus:outline-none focus:border-red-500"
                    />
                    {saving === cat.id && <span className="ml-2 text-xs text-gray-400">saving...</span>}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => deleteCategory(cat.id)}
                      className="text-gray-500 hover:text-red-400 text-xs transition-colors"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {/* Add new category */}
      {addingNew ? (
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-sm">New Scoring Category</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Display Label</label>
              <input value={newCat.label} onChange={e => setNewCat(p => ({ ...p, label: e.target.value }))}
                placeholder="e.g. Stolen Base" className="input" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Stat Key (internal)</label>
              <input value={newCat.stat_key} onChange={e => setNewCat(p => ({ ...p, stat_key: e.target.value.toUpperCase() }))}
                placeholder="e.g. SB" className="input font-mono" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Points Per Unit</label>
              <input type="number" step="0.5" value={newCat.points_per_unit}
                onChange={e => setNewCat(p => ({ ...p, points_per_unit: parseFloat(e.target.value) }))}
                className="input" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Applies To</label>
              <div className="flex gap-4 mt-2">
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="checkbox" checked={newCat.is_batting}
                    onChange={e => setNewCat(p => ({ ...p, is_batting: e.target.checked }))} />
                  Batting
                </label>
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="checkbox" checked={newCat.is_pitching}
                    onChange={e => setNewCat(p => ({ ...p, is_pitching: e.target.checked }))} />
                  Pitching
                </label>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={addCategory} disabled={saving === 'new'}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-semibold transition-colors">
              {saving === 'new' ? 'Adding...' : 'Add Category'}
            </button>
            <button onClick={() => setAddingNew(false)}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-semibold transition-colors">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAddingNew(true)}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-semibold transition-colors">
          + Add Scoring Category
        </button>
      )}

      {status && <p className="text-sm text-green-400">{status}</p>}

      <p className="text-xs text-gray-500">
        Tip: Click into any points value and tab away to save it. Changes apply to all future scoring.
      </p>
    </div>
  )
}
