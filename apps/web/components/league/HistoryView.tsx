'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export type SeasonRecord = {
  id: string
  season_year: number
  is_champion: boolean
  finish_place: number | null
  awards: string[]
  notes: string | null
}

const ORDINALS: Record<number, string> = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th', 5: '5th', 6: '6th', 7: '7th', 8: '8th', 9: '9th', 10: '10th', 11: '11th', 12: '12th' }
function ordinal(n: number) { return ORDINALS[n] ?? `${n}th` }

function ChampionBanner({ year }: { year: number }) {
  return (
    <div className="flex items-center gap-3 bg-gradient-to-r from-yellow-900/60 to-yellow-800/30 border border-yellow-700/50 rounded-xl px-5 py-4">
      <span className="text-3xl">🏆</span>
      <div>
        <p className="text-yellow-300 font-bold text-lg leading-tight">{year} Champion</p>
        <p className="text-yellow-600 text-xs">League Championship</p>
      </div>
    </div>
  )
}

function SeasonRow({
  record,
  isOwner,
  teamId,
  onEdit,
  onDelete,
}: {
  record: SeasonRecord
  isOwner: boolean
  teamId: string
  onEdit: (r: SeasonRecord) => void
  onDelete: (year: number) => void
}) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-800 last:border-0">
      <div className="w-12 text-center">
        <p className="text-sm font-bold text-white">{record.season_year}</p>
        {record.finish_place && (
          <p className="text-xs text-gray-500">{ordinal(record.finish_place)}</p>
        )}
      </div>
      <div className="flex-1 min-w-0">
        {record.is_champion && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-yellow-400 mb-1">
            🏆 Champion
          </span>
        )}
        {record.awards.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1">
            {record.awards.map(a => (
              <span key={a} className="px-2 py-0.5 bg-gray-800 border border-gray-700 rounded-full text-xs text-gray-300">
                {a}
              </span>
            ))}
          </div>
        )}
        {record.notes && (
          <p className="text-xs text-gray-500 italic">{record.notes}</p>
        )}
      </div>
      {isOwner && (
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={() => onEdit(record)} className="text-xs text-gray-500 hover:text-gray-300">edit</button>
          <button onClick={() => onDelete(record.season_year)} className="text-xs text-gray-600 hover:text-red-400">✕</button>
        </div>
      )}
    </div>
  )
}

function SeasonEditor({
  teamId,
  initial,
  onSaved,
  onCancel,
}: {
  teamId: string
  initial: Partial<SeasonRecord> & { season_year: number }
  onSaved: () => void
  onCancel: () => void
}) {
  const [year] = useState(initial.season_year)
  const [isChamp, setIsChamp] = useState(initial.is_champion ?? false)
  const [place, setPlace] = useState(initial.finish_place?.toString() ?? '')
  const [awardsText, setAwardsText] = useState((initial.awards ?? []).join(', '))
  const [notes, setNotes] = useState(initial.notes ?? '')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    const awards = awardsText.split(',').map(s => s.trim()).filter(Boolean)
    await fetch(`/api/teams/${teamId}/history`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        season_year: year,
        is_champion: isChamp,
        finish_place: place ? Number(place) : null,
        awards,
        notes,
      }),
    })
    setSaving(false)
    onSaved()
  }

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 space-y-3">
      <p className="text-sm font-semibold text-white">{year} Season</p>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={isChamp}
          onChange={e => setIsChamp(e.target.checked)}
          className="accent-yellow-400 w-4 h-4"
        />
        <span className="text-sm text-gray-300">🏆 League Champion</span>
      </label>

      <div>
        <label className="text-xs text-gray-500 block mb-1">Final standing (e.g. 2)</label>
        <input
          type="number"
          min={1}
          max={20}
          value={place}
          onChange={e => setPlace(e.target.value)}
          placeholder="1"
          className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white w-20 focus:outline-none focus:border-gray-500"
        />
      </div>

      <div>
        <label className="text-xs text-gray-500 block mb-1">Awards (comma-separated)</label>
        <input
          value={awardsText}
          onChange={e => setAwardsText(e.target.value)}
          placeholder="Best Draft, Most Improved…"
          className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white w-full focus:outline-none focus:border-gray-500"
        />
      </div>

      <div>
        <label className="text-xs text-gray-500 block mb-1">Notes</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          placeholder="Anything memorable about this season…"
          className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white w-full resize-none focus:outline-none focus:border-gray-500"
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded text-sm text-white disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button onClick={onCancel} className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-300">
          Cancel
        </button>
      </div>
    </div>
  )
}

export function HistoryView({
  teamId,
  records,
  isOwner,
}: {
  teamId: string
  records: SeasonRecord[]
  isOwner: boolean
}) {
  const router = useRouter()
  const [editing, setEditing] = useState<(Partial<SeasonRecord> & { season_year: number }) | null>(null)
  const [addingYear, setAddingYear] = useState('')

  const champions = records.filter(r => r.is_champion).sort((a, b) => a.season_year - b.season_year)
  const sorted = [...records].sort((a, b) => b.season_year - a.season_year)

  async function deleteRecord(year: number) {
    if (!confirm(`Remove ${year} season record?`)) return
    await fetch(`/api/teams/${teamId}/history?year=${year}`, { method: 'DELETE' })
    router.refresh()
  }

  function saved() {
    setEditing(null)
    setAddingYear('')
    router.refresh()
  }

  const currentYear = new Date().getFullYear()
  const yearsInRecords = new Set(records.map(r => r.season_year))

  return (
    <div className="space-y-6">
      {/* Championship banners */}
      {champions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Championships</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {champions.map(r => <ChampionBanner key={r.season_year} year={r.season_year} />)}
          </div>
        </div>
      )}

      {/* Season log */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
          <p className="text-sm font-semibold text-white">Season History</p>
          {isOwner && !editing && (
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={addingYear}
                onChange={e => setAddingYear(e.target.value)}
                placeholder={String(currentYear)}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-sm text-white w-20 focus:outline-none"
              />
              <button
                onClick={() => {
                  const y = Number(addingYear || currentYear)
                  if (y > 1900 && y <= currentYear + 1) {
                    setEditing({ season_year: y, awards: [], is_champion: false })
                  }
                }}
                className="text-xs text-red-400 hover:text-red-300"
              >
                + Add season
              </button>
            </div>
          )}
        </div>

        {editing && (
          <div className="p-4">
            <SeasonEditor
              teamId={teamId}
              initial={editing}
              onSaved={saved}
              onCancel={() => setEditing(null)}
            />
          </div>
        )}

        {sorted.length === 0 && !editing ? (
          <p className="px-4 py-6 text-sm text-gray-600 text-center">
            {isOwner ? 'No seasons recorded yet. Add your first season above.' : 'No season history recorded.'}
          </p>
        ) : (
          <div className="px-4">
            {sorted.map(r => (
              editing?.season_year === r.season_year ? null : (
                <SeasonRow
                  key={r.season_year}
                  record={r}
                  isOwner={isOwner}
                  teamId={teamId}
                  onEdit={rec => setEditing(rec)}
                  onDelete={deleteRecord}
                />
              )
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
