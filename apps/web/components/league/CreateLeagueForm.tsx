'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const STEPS = ['Basic Info', 'Roster Slots', 'Draft & Waivers', 'Scoring', 'Your Team']

const DEFAULT_FORM = {
  // Basic
  name: '',
  max_teams: 12,
  scoring_type: 'head_to_head_points',
  regular_season_weeks: 21,
  playoff_teams: 4,
  playoff_start_week: 22,
  is_keeper_league: false,
  is_contract_league: false,
  max_keepers_per_team: 3,
  has_taxi_squad: false,
  taxi_squad_size: 3,
  // Roster slots
  spots_c: 1,
  spots_1b: 1,
  spots_2b: 1,
  spots_3b: 1,
  spots_ss: 1,
  spots_of: 3,
  spots_if: 0,
  spots_util: 1,
  spots_sp: 2,
  spots_rp: 2,
  spots_p: 2,
  spots_bench: 4,
  spots_il: 2,
  // Draft
  draft_type: 'auction',
  auction_budget: 260,
  snake_rounds: 25,
  pick_time_seconds: 90,
  rookie_draft_rounds: 5,
  // Waivers
  waiver_type: 'faab',
  faab_budget: 500,
  trade_deadline_week: 20,
  // Contract
  max_contract_years: 3,
  rookie_contract_years: 2,
  salary_cap: '',
  cap_type: 'none',
  cap_tier_size: 10,
  // Team
  team_name: '',
  team_abbreviation: '',
}

export function CreateLeagueForm() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState(DEFAULT_FORM)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function set<K extends keyof typeof DEFAULT_FORM>(key: K, value: typeof DEFAULT_FORM[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmit() {
    setLoading(true)
    setError(null)

    const res = await fetch('/api/leagues', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        salary_cap: form.salary_cap === '' ? null : Number(form.salary_cap),
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Something went wrong')
      setLoading(false)
      return
    }

    router.push(`/league/${data.league.id}`)
  }

  return (
    <div>
      {/* Step indicators */}
      <div className="flex gap-2 mb-8">
        {STEPS.map((label, i) => (
          <div key={i} className="flex-1">
            <div className={`h-1 rounded-full mb-1.5 ${i <= step ? 'bg-red-500' : 'bg-gray-700'}`} />
            <span className={`text-xs ${i === step ? 'text-white' : 'text-gray-500'}`}>{label}</span>
          </div>
        ))}
      </div>

      {/* Step 0: Basic Info */}
      {step === 0 && (
        <div className="space-y-5">
          <Field label="League Name">
            <input
              type="text"
              autoComplete="off"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="e.g. Angry Sports Baseball"
              className="input"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Number of Teams">
              <select value={form.max_teams} onChange={e => set('max_teams', Number(e.target.value))} className="input">
                {[8,10,12,14,16].map(n => <option key={n} value={n}>{n} teams</option>)}
              </select>
            </Field>
            <Field label="Scoring Format">
              <select value={form.scoring_type} onChange={e => set('scoring_type', e.target.value)} className="input">
                <option value="head_to_head_points">Head-to-Head Points</option>
                <option value="rotisserie">Rotisserie</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Regular Season Weeks">
              <input type="number" value={form.regular_season_weeks} min={10} max={26}
                onChange={e => set('regular_season_weeks', Number(e.target.value))} className="input" />
            </Field>
            <Field label="Playoff Teams">
              <select value={form.playoff_teams} onChange={e => set('playoff_teams', Number(e.target.value))} className="input">
                {[2,4,6,8].map(n => <option key={n} value={n}>{n} teams</option>)}
              </select>
            </Field>
          </div>
          <div className="border border-gray-700 rounded-lg p-4 space-y-4">
            <h3 className="font-semibold text-sm text-gray-300 uppercase tracking-wide">Special League Types</h3>
            <Toggle label="Keeper League" sublabel="Teams can keep players from year to year"
              value={form.is_keeper_league} onChange={v => set('is_keeper_league', v)} />
            {form.is_keeper_league && (
              <Field label="Max Keepers Per Team">
                <input type="number" value={form.max_keepers_per_team} min={1} max={15}
                  onChange={e => set('max_keepers_per_team', Number(e.target.value))} className="input w-24" />
              </Field>
            )}
            <Toggle label="Contract League" sublabel="Players are signed to multi-year contracts with salaries"
              value={form.is_contract_league} onChange={v => set('is_contract_league', v)} />
            <Toggle label="Taxi Squad" sublabel="Add a separate roster for rookie/prospect players"
              value={form.has_taxi_squad} onChange={v => set('has_taxi_squad', v)} />
            {form.has_taxi_squad && (
              <Field label="Taxi Squad Size">
                <select value={form.taxi_squad_size} onChange={e => set('taxi_squad_size', Number(e.target.value))} className="input w-24">
                  {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </Field>
            )}
          </div>
        </div>
      )}

      {/* Step 1: Roster Slots */}
      {step === 1 && (
        <div className="space-y-4">
          <p className="text-sm text-gray-400">Set how many roster spots each position gets.</p>
          <div className="grid grid-cols-2 gap-x-8 gap-y-3">
            {[
              ['Catcher (C)',        'spots_c'],
              ['First Base (1B)',    'spots_1b'],
              ['Second Base (2B)',   'spots_2b'],
              ['Third Base (3B)',    'spots_3b'],
              ['Shortstop (SS)',     'spots_ss'],
              ['Outfield (OF)',      'spots_of'],
              ['Infielder (IF)',     'spots_if'],
              ['Utility (UTIL)',     'spots_util'],
              ['Starting Pitcher (SP)', 'spots_sp'],
              ['Relief Pitcher (RP)',   'spots_rp'],
              ['Pitcher (P)',           'spots_p'],
              ['Bench',             'spots_bench'],
              ['Injured List (IL)', 'spots_il'],
            ].map(([label, key]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm text-gray-300">{label}</span>
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={(form as any)[key]}
                  onChange={e => set(key as any, Number(e.target.value))}
                  className="input w-16 text-center"
                />
              </div>
            ))}
          </div>
          {form.has_taxi_squad && (
            <div className="flex items-center justify-between pt-2 border-t border-gray-700">
              <span className="text-sm text-gray-300">Taxi Squad</span>
              <span className="text-sm text-gray-400">{form.taxi_squad_size} spots (set in Basic Info)</span>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Draft & Waivers */}
      {step === 2 && (
        <div className="space-y-5">
          <div className="border border-gray-700 rounded-lg p-4 space-y-4">
            <h3 className="font-semibold text-sm text-gray-300 uppercase tracking-wide">Free Agency Draft</h3>
            <Field label="Draft Type">
              <select value={form.draft_type} onChange={e => set('draft_type', e.target.value)} className="input">
                <option value="auction">Auction</option>
                <option value="snake">Snake</option>
                <option value="linear">Linear (same order every round)</option>
              </select>
            </Field>
            {form.draft_type === 'auction' && (
              <Field label="Auction Budget per Team ($)">
                <input type="number" value={form.auction_budget} min={100} max={1000}
                  onChange={e => set('auction_budget', Number(e.target.value))} className="input" />
              </Field>
            )}
            {form.draft_type !== 'auction' && (
              <Field label="Total Rounds">
                <input type="number" value={form.snake_rounds} min={10} max={50}
                  onChange={e => set('snake_rounds', Number(e.target.value))} className="input" />
              </Field>
            )}
            <Field label="Pick Time Limit (seconds)">
              <select value={form.pick_time_seconds} onChange={e => set('pick_time_seconds', Number(e.target.value))} className="input">
                <option value={30}>30 seconds</option>
                <option value={60}>60 seconds</option>
                <option value={90}>90 seconds</option>
                <option value={120}>2 minutes</option>
                <option value={300}>5 minutes</option>
                <option value={0}>No limit</option>
              </select>
            </Field>
          </div>

          <div className="border border-gray-700 rounded-lg p-4 space-y-4">
            <h3 className="font-semibold text-sm text-gray-300 uppercase tracking-wide">Rookie Draft</h3>
            <p className="text-xs text-gray-400">Held after free agency — snake format, for prospects and undrafted players.</p>
            <Field label="Rookie Draft Rounds">
              <input type="number" value={form.rookie_draft_rounds} min={1} max={20}
                onChange={e => set('rookie_draft_rounds', Number(e.target.value))} className="input" />
            </Field>
          </div>

          <div className="border border-gray-700 rounded-lg p-4 space-y-4">
            <h3 className="font-semibold text-sm text-gray-300 uppercase tracking-wide">Waivers & Free Agency</h3>
            <Field label="Waiver System">
              <select value={form.waiver_type} onChange={e => set('waiver_type', e.target.value)} className="input">
                <option value="faab">FAAB (Free Agent Acquisition Budget)</option>
                <option value="standard">Standard (waiver priority)</option>
                <option value="reverse_standings">Reverse Standings</option>
                <option value="none">Open Free Agency (no waivers)</option>
              </select>
            </Field>
            {form.waiver_type === 'faab' && (
              <Field label="FAAB Budget per Team ($)">
                <input type="number" value={form.faab_budget} min={100} max={10000}
                  onChange={e => set('faab_budget', Number(e.target.value))} className="input" />
              </Field>
            )}
            <Field label="Trade Deadline (after week)">
              <input type="number" value={form.trade_deadline_week} min={5} max={25}
                onChange={e => set('trade_deadline_week', Number(e.target.value))} className="input" />
            </Field>
          </div>

          {form.is_contract_league && (
            <div className="border border-gray-700 rounded-lg p-4 space-y-4">
              <h3 className="font-semibold text-sm text-gray-300 uppercase tracking-wide">Contract Settings</h3>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Max Contract Years">
                  <input type="number" value={form.max_contract_years} min={1} max={6}
                    onChange={e => set('max_contract_years', Number(e.target.value))} className="input" />
                </Field>
                <Field label="Rookie Contract Years">
                  <input type="number" value={form.rookie_contract_years} min={1} max={4}
                    onChange={e => set('rookie_contract_years', Number(e.target.value))} className="input" />
                </Field>
              </div>
              <Field label="Salary Cap Type">
                <select value={form.cap_type} onChange={e => set('cap_type', e.target.value)} className="input">
                  <option value="none">No Cap</option>
                  <option value="hard">Hard Cap (teams cannot exceed)</option>
                  <option value="soft">Soft Cap (penalties above threshold)</option>
                  <option value="soft_tiered">Soft Tiered Cap (escalating penalties by interval)</option>
                </select>
              </Field>
              {form.cap_type !== 'none' && (
                <Field label={`Cap Threshold ($) ${form.cap_type === 'soft_tiered' ? '— penalty tiers start here' : ''}`}>
                  <input type="number" value={form.salary_cap} placeholder="e.g. 200"
                    onChange={e => set('salary_cap', e.target.value as any)} className="input" />
                </Field>
              )}
              {form.cap_type === 'soft_tiered' && (
                <Field label="Tier Interval ($) — new penalty tier every X dollars above cap">
                  <input type="number" value={form.cap_tier_size} min={1} max={100}
                    onChange={e => set('cap_tier_size', Number(e.target.value))} className="input" />
                  <p className="text-xs text-gray-500 mt-1">
                    e.g. Cap=$200, Interval=$10 → Tier 1: $200–209, Tier 2: $210–219, etc.
                    Penalty % per tier is set in Commissioner Settings after creation.
                  </p>
                </Field>
              )}
            </div>
          )}
        </div>
      )}

      {/* Step 3: Scoring */}
      {step === 3 && (
        <div className="space-y-4">
          <p className="text-sm text-gray-400">
            Your league starts with standard scoring. You can customize every category and point value
            from the commissioner settings after the league is created.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="border border-gray-700 rounded-lg p-4">
              <h3 className="font-semibold mb-3 text-sm">Batting (defaults)</h3>
              <ul className="space-y-1.5 text-sm text-gray-300">
                <li className="flex justify-between"><span>Hit (H)</span><span>+4 pts</span></li>
                <li className="flex justify-between"><span>Double (2B)</span><span>+8 pts</span></li>
                <li className="flex justify-between"><span>Triple (3B)</span><span>+12 pts</span></li>
                <li className="flex justify-between"><span>Home Run (HR)</span><span>+16 pts</span></li>
                <li className="flex justify-between"><span>Run (R)</span><span>+3 pts</span></li>
                <li className="flex justify-between"><span>RBI</span><span>+3 pts</span></li>
                <li className="flex justify-between"><span>Stolen Base (SB)</span><span>+6 pts</span></li>
                <li className="flex justify-between"><span>Walk (BB)</span><span>+4 pts</span></li>
                <li className="flex justify-between text-red-400"><span>Strikeout (K)</span><span>-1 pt</span></li>
              </ul>
            </div>
            <div className="border border-gray-700 rounded-lg p-4">
              <h3 className="font-semibold mb-3 text-sm">Pitching (defaults)</h3>
              <ul className="space-y-1.5 text-sm text-gray-300">
                <li className="flex justify-between"><span>Win (W)</span><span>+3 pts</span></li>
                <li className="flex justify-between"><span>Save (SV)</span><span>+17.5 pts</span></li>
                <li className="flex justify-between"><span>Hold (HLD)</span><span>+10 pts</span></li>
                <li className="flex justify-between"><span>Strikeout (K)</span><span>+2.5 pts</span></li>
                <li className="flex justify-between"><span>Inning Pitched (IP)</span><span>+4.5 pts</span></li>
                <li className="flex justify-between"><span>Out Recorded</span><span>+1.5 pts</span></li>
                <li className="flex justify-between"><span>Quality Start (QS)</span><span>+8 pts</span></li>
                <li className="flex justify-between text-red-400"><span>Earned Run (ER)</span><span>-3 pts</span></li>
                <li className="flex justify-between text-red-400"><span>Blown Save (BS)</span><span>-7.5 pts</span></li>
                <li className="flex justify-between text-red-400"><span>Loss (L)</span><span>-3 pts</span></li>
              </ul>
            </div>
          </div>
          <p className="text-xs text-gray-500">
            Note: "Out Recorded" and "Inning Pitched" are both available — the commissioner can enable one or both.
          </p>
        </div>
      )}

      {/* Step 4: Your Team */}
      {step === 4 && (
        <div className="space-y-5">
          <p className="text-sm text-gray-400">Name your team. Other managers will name theirs when they join.</p>
          <Field label="Team Name">
            <input
              type="text"
              autoComplete="off"
              value={form.team_name}
              onChange={e => set('team_name', e.target.value)}
              placeholder="e.g. Thunder Bats"
              className="input"
            />
          </Field>
          <Field label="Team Abbreviation (3–4 letters)">
            <input
              type="text"
              autoComplete="off"
              value={form.team_abbreviation}
              onChange={e => set('team_abbreviation', e.target.value.toUpperCase().slice(0, 4))}
              placeholder="e.g. TB"
              maxLength={4}
              className="input w-24"
            />
          </Field>
          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between mt-8">
        <button
          onClick={() => setStep(s => s - 1)}
          disabled={step === 0}
          className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 rounded-lg font-semibold transition-colors"
        >
          Back
        </button>
        {step < STEPS.length - 1 ? (
          <button
            onClick={() => setStep(s => s + 1)}
            disabled={step === 0 && !form.name.trim()}
            className="px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-30 rounded-lg font-semibold transition-colors"
          >
            Next
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={loading || !form.team_name.trim() || !form.team_abbreviation.trim()}
            className="px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-30 rounded-lg font-semibold transition-colors"
          >
            {loading ? 'Creating...' : 'Create League'}
          </button>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function Toggle({ label, sublabel, value, onChange }: {
  label: string
  sublabel: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-xs text-gray-400 mt-0.5">{sublabel}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors ${
          value ? 'bg-red-600' : 'bg-gray-600'
        }`}
      >
        <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
          value ? 'translate-x-5' : 'translate-x-0'
        }`} />
      </button>
    </div>
  )
}
