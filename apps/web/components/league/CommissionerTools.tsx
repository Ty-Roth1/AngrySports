'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface RosterSpots {
  spots_c: number; spots_1b: number; spots_2b: number; spots_3b: number; spots_ss: number
  spots_if: number; spots_of: number; spots_util: number
  spots_sp: number; spots_rp: number; spots_p: number
  spots_bench: number; spots_il: number
}

interface Props {
  leagueId: string
  currentCoCommish: string | null // display_name of current co-commish, if any
  leagueName: string
  currentWaiverType: string
  currentFaabBudget: number
  currentTradeDeadlineWeek: number
  currentRosterSpots?: RosterSpots
}

export function CommissionerTools({
  leagueId,
  currentCoCommish,
  leagueName,
  currentWaiverType,
  currentFaabBudget,
  currentTradeDeadlineWeek,
  currentRosterSpots,
}: Props) {
  const router = useRouter()
  const [coCommishEmail, setCoCommishEmail] = useState('')
  const [coCommishLoading, setCoCommishLoading] = useState(false)
  const [coCommishMsg, setCoCommishMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const [name, setName] = useState(leagueName)
  const [waiverType, setWaiverType] = useState(currentWaiverType)
  const [faabBudget, setFaabBudget] = useState(currentFaabBudget)
  const [tradeDeadline, setTradeDeadline] = useState(currentTradeDeadlineWeek)
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [settingsMsg, setSettingsMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const defaultSpots: RosterSpots = {
    spots_c: 1, spots_1b: 1, spots_2b: 1, spots_3b: 1, spots_ss: 1,
    spots_if: 0, spots_of: 3, spots_util: 1,
    spots_sp: 2, spots_rp: 2, spots_p: 0, spots_bench: 4, spots_il: 2,
  }
  const [spots, setSpots] = useState<RosterSpots>(currentRosterSpots ?? defaultSpots)
  const [spotsLoading, setSpotsLoading] = useState(false)
  const [spotsMsg, setSpotsMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  function setSpot(key: keyof RosterSpots, val: number) {
    setSpots(s => ({ ...s, [key]: Math.max(0, val) }))
  }

  async function assignCoCommish(e: React.FormEvent) {
    e.preventDefault()
    setCoCommishLoading(true)
    setCoCommishMsg(null)
    const res = await fetch(`/api/leagues/${leagueId}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ co_commissioner_email: coCommishEmail.trim() }),
    })
    const data = await res.json()
    if (!res.ok) {
      setCoCommishMsg({ type: 'err', text: data.error })
    } else {
      setCoCommishMsg({ type: 'ok', text: `Co-commissioner assigned successfully.` })
      setCoCommishEmail('')
      router.refresh()
    }
    setCoCommishLoading(false)
  }

  async function removeCoCommish() {
    setCoCommishLoading(true)
    setCoCommishMsg(null)
    const res = await fetch(`/api/leagues/${leagueId}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ co_commissioner_email: '' }),
    })
    if (res.ok) {
      setCoCommishMsg({ type: 'ok', text: 'Co-commissioner removed.' })
      router.refresh()
    }
    setCoCommishLoading(false)
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault()
    setSettingsLoading(true)
    setSettingsMsg(null)
    const res = await fetch(`/api/leagues/${leagueId}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        league_name: name,
        waiver_type: waiverType,
        faab_budget: faabBudget,
        trade_deadline_week: tradeDeadline,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      setSettingsMsg({ type: 'err', text: data.error })
    } else {
      setSettingsMsg({ type: 'ok', text: 'Settings saved.' })
      router.refresh()
    }
    setSettingsLoading(false)
  }

  async function saveSpots(e: React.FormEvent) {
    e.preventDefault()
    setSpotsLoading(true)
    setSpotsMsg(null)
    const res = await fetch(`/api/leagues/${leagueId}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(spots),
    })
    const data = await res.json()
    if (!res.ok) {
      setSpotsMsg({ type: 'err', text: data.error })
    } else {
      setSpotsMsg({ type: 'ok', text: 'Roster spots saved.' })
      router.refresh()
    }
    setSpotsLoading(false)
  }

  return (
    <div className="space-y-6">
      {/* League Settings */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-5">
        <h3 className="font-semibold text-white text-sm uppercase tracking-wide">League Settings</h3>
        <form onSubmit={saveSettings} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">League Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              className="input"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Waiver System</label>
              <select value={waiverType} onChange={e => setWaiverType(e.target.value)} className="input">
                <option value="faab">FAAB</option>
                <option value="standard">Standard (waiver priority)</option>
                <option value="reverse_standings">Reverse Standings</option>
                <option value="none">Open Free Agency</option>
              </select>
            </div>
            {waiverType === 'faab' && (
              <div>
                <label className="block text-xs text-gray-400 mb-1">FAAB Budget ($)</label>
                <input
                  type="number"
                  min={0}
                  value={faabBudget}
                  onChange={e => setFaabBudget(Number(e.target.value))}
                  className="input"
                />
              </div>
            )}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Trade Deadline (after week)</label>
              <input
                type="number"
                min={1}
                max={25}
                value={tradeDeadline}
                onChange={e => setTradeDeadline(Number(e.target.value))}
                className="input"
              />
            </div>
          </div>
          {settingsMsg && (
            <p className={`text-sm ${settingsMsg.type === 'ok' ? 'text-green-400' : 'text-red-400'}`}>
              {settingsMsg.text}
            </p>
          )}
          <button
            type="submit"
            disabled={settingsLoading}
            className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg text-sm font-semibold transition-colors text-white"
          >
            {settingsLoading ? 'Saving…' : 'Save Settings'}
          </button>
        </form>
      </div>

      {/* Roster Spots */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
        <h3 className="font-semibold text-white text-sm uppercase tracking-wide">Roster Spots</h3>
        <p className="text-xs text-gray-500">Set to 0 to disable a slot type. Changes affect slot eligibility immediately.</p>
        <form onSubmit={saveSpots} className="space-y-4">
          <div>
            <p className="text-xs font-medium text-gray-400 mb-2">Hitters</p>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-3">
              {([
                ['C',    'spots_c'],
                ['1B',   'spots_1b'],
                ['2B',   'spots_2b'],
                ['3B',   'spots_3b'],
                ['SS',   'spots_ss'],
                ['IF',   'spots_if'],
                ['OF',   'spots_of'],
                ['UTIL', 'spots_util'],
              ] as [string, keyof RosterSpots][]).map(([label, key]) => (
                <div key={key}>
                  <label className="text-xs text-gray-500 block mb-1">{label}</label>
                  <input
                    type="number" min={0} max={10}
                    value={spots[key]}
                    onChange={e => setSpot(key, Number(e.target.value))}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-red-500 text-center"
                  />
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-400 mb-2">Pitchers</p>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-3">
              {([
                ['SP',    'spots_sp'],
                ['RP',    'spots_rp'],
                ['P',     'spots_p'],
                ['BN',    'spots_bench'],
                ['IL',    'spots_il'],
              ] as [string, keyof RosterSpots][]).map(([label, key]) => (
                <div key={key}>
                  <label className="text-xs text-gray-500 block mb-1">{label}</label>
                  <input
                    type="number" min={0} max={10}
                    value={spots[key]}
                    onChange={e => setSpot(key, Number(e.target.value))}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-red-500 text-center"
                  />
                </div>
              ))}
            </div>
          </div>
          {spotsMsg && (
            <p className={`text-sm ${spotsMsg.type === 'ok' ? 'text-green-400' : 'text-red-400'}`}>
              {spotsMsg.text}
            </p>
          )}
          <button
            type="submit"
            disabled={spotsLoading}
            className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg text-sm font-semibold transition-colors text-white"
          >
            {spotsLoading ? 'Saving…' : 'Save Roster Spots'}
          </button>
        </form>
      </div>

      {/* Co-commissioner */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
        <h3 className="font-semibold text-white text-sm uppercase tracking-wide">Co-Commissioner</h3>
        {currentCoCommish && (
          <div className="flex items-center justify-between bg-gray-800 rounded-lg px-4 py-3">
            <div>
              <p className="text-white text-sm font-medium">{currentCoCommish}</p>
              <p className="text-xs text-gray-500">Current co-commissioner</p>
            </div>
            <button
              onClick={removeCoCommish}
              disabled={coCommishLoading}
              className="text-xs text-red-400 hover:text-red-300 transition-colors"
            >
              Remove
            </button>
          </div>
        )}
        <form onSubmit={assignCoCommish} className="flex gap-3">
          <input
            type="email"
            required
            value={coCommishEmail}
            onChange={e => setCoCommishEmail(e.target.value)}
            placeholder="manager@example.com"
            autoComplete="off"
            className="input flex-1"
          />
          <button
            type="submit"
            disabled={coCommishLoading}
            className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 rounded-lg text-sm font-semibold transition-colors text-white whitespace-nowrap"
          >
            {currentCoCommish ? 'Replace' : 'Assign'}
          </button>
        </form>
        {coCommishMsg && (
          <p className={`text-sm ${coCommishMsg.type === 'ok' ? 'text-green-400' : 'text-red-400'}`}>
            {coCommishMsg.text}
          </p>
        )}
        <p className="text-xs text-gray-600">
          Co-commissioners can manage nicknames, process waivers, and access commissioner tools.
          They must already have an account in this league.
        </p>
      </div>
    </div>
  )
}
