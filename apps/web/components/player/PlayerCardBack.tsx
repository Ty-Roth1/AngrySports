import { MlbPlayerDetail, MlbStatLine } from '@/lib/mlb'

interface Props {
  player: {
    full_name: string
    primary_position: string
    mlb_team: string | null
    mlb_id: number
    bats: string | null
    throws: string | null
    birth_date: string | null
    pro_debut_year: number | null
    is_rookie: boolean
  }
  mlbDetail: MlbPlayerDetail | null
  careerBatting: MlbStatLine | null
  careerPitching: MlbStatLine | null
  isPitcher: boolean
}

function fmt(val: number | string | undefined | null, decimals = 3): string {
  if (val === undefined || val === null) return '—'
  const n = Number(val)
  if (isNaN(n)) return String(val)
  return decimals === 0 ? n.toFixed(0) : n.toFixed(decimals).replace(/^0\./, '.')
}

function age(birthDate: string | null): number | null {
  if (!birthDate) return null
  const birth = new Date(birthDate)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  if (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate())) age--
  return age
}

function yearsOfService(debutYear: number | null): number | null {
  if (!debutYear) return null
  return new Date().getFullYear() - debutYear
}

export function PlayerCardBack({ player, mlbDetail, careerBatting, careerPitching, isPitcher }: Props) {
  const yos = yearsOfService(player.pro_debut_year)
  const playerAge = age(player.birth_date)

  return (
    <div
      className="relative rounded-2xl overflow-hidden shadow-2xl max-w-2xl"
      style={{
        background: 'linear-gradient(160deg, #f5f0e8 0%, #ede4d0 50%, #e8dfc8 100%)',
        fontFamily: '"Georgia", "Times New Roman", serif',
        border: '3px solid #2c1810',
        boxShadow: '0 0 0 1px #8b6914, 0 8px 32px rgba(0,0,0,0.5)',
      }}
    >
      {/* Top pinstripe bar */}
      <div style={{ background: 'linear-gradient(90deg, #8b0000, #cc0000, #8b0000)', height: 8 }} />

      {/* Card header */}
      <div className="px-6 pt-4 pb-3" style={{ borderBottom: '2px solid #8b6914' }}>
        <div className="flex items-start justify-between">
          <div>
            <div
              className="text-2xl font-bold tracking-wide uppercase"
              style={{ color: '#1a0a00', letterSpacing: '0.05em' }}
            >
              {player.full_name}
            </div>
            <div className="flex items-center gap-3 mt-0.5" style={{ color: '#5c3d1e' }}>
              <span className="font-semibold text-sm uppercase tracking-wider">
                {player.primary_position}
              </span>
              <span style={{ color: '#8b6914' }}>·</span>
              <span className="text-sm">{player.mlb_team ?? 'Free Agent'}</span>
            </div>
          </div>
          {/* Topps-style year badge */}
          <div
            className="text-right"
            style={{ color: '#8b0000' }}
          >
            <div className="text-3xl font-black" style={{ fontFamily: 'Arial Black, sans-serif' }}>
              {new Date().getFullYear()}
            </div>
            <div className="text-xs font-bold tracking-widest uppercase" style={{ color: '#5c3d1e' }}>
              Angry Sports
            </div>
          </div>
        </div>
      </div>

      {/* Vitals section */}
      <div className="px-6 py-3" style={{ borderBottom: '1px solid #c9a84c' }}>
        <div className="grid grid-cols-4 gap-2 text-center text-xs">
          {[
            { label: 'AGE', value: playerAge ?? '—' },
            { label: 'HT / WT', value: mlbDetail ? `${mlbDetail.height} / ${mlbDetail.weight}` : '—' },
            { label: isPitcher ? 'THROWS' : 'BATS/THROWS', value: isPitcher ? (player.throws ?? '—') : `${player.bats ?? '?'}/${player.throws ?? '?'}` },
            { label: 'YRS SERVICE', value: yos !== null ? yos : '—' },
          ].map(v => (
            <div key={v.label} className="py-1">
              <div className="font-bold" style={{ color: '#1a0a00', fontSize: 13 }}>{v.value}</div>
              <div className="uppercase tracking-widest" style={{ color: '#7a5c2e', fontSize: 9, marginTop: 2 }}>
                {v.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Career stats — batting or pitching */}
      {!isPitcher && careerBatting && (
        <div className="px-6 py-4">
          <div
            className="text-xs font-bold uppercase tracking-widest mb-2 pb-1"
            style={{ color: '#8b0000', borderBottom: '1px solid #c9a84c', letterSpacing: '0.15em' }}
          >
            Career Batting
          </div>
          <div className="grid grid-cols-8 gap-1 text-center">
            {[
              { label: 'G',   value: fmt(careerBatting.ab, 0) },   // using AB as proxy
              { label: 'AVG', value: fmt(careerBatting.avg) },
              { label: 'OBP', value: fmt(careerBatting.obp) },
              { label: 'SLG', value: fmt(careerBatting.slg) },
              { label: 'HR',  value: fmt(careerBatting.homeRuns, 0) },
              { label: 'RBI', value: fmt(careerBatting.rbi, 0) },
              { label: 'SB',  value: fmt(careerBatting.stolenBases, 0) },
              { label: 'OPS', value: fmt(careerBatting.ops) },
            ].map(col => (
              <div key={col.label} className="py-1.5 px-1" style={{ background: 'rgba(139,105,20,0.08)', borderRadius: 4 }}>
                <div className="font-bold" style={{ color: '#1a0a00', fontSize: 14 }}>{col.value}</div>
                <div style={{ color: '#7a5c2e', fontSize: 9, marginTop: 2, fontFamily: 'Arial, sans-serif' }}>
                  {col.label}
                </div>
              </div>
            ))}
          </div>
          {/* Extra batting stats row */}
          <div className="grid grid-cols-5 gap-1 text-center mt-1">
            {[
              { label: 'H',    value: fmt(careerBatting.hits, 0) },
              { label: '2B',   value: fmt(careerBatting.doubles, 0) },
              { label: '3B',   value: fmt(careerBatting.triples, 0) },
              { label: 'BB',   value: fmt(careerBatting.baseOnBalls, 0) },
              { label: 'SO',   value: fmt(careerBatting.strikeOuts, 0) },
            ].map(col => (
              <div key={col.label} className="py-1 px-1">
                <div className="font-bold" style={{ color: '#3a2000', fontSize: 12 }}>{col.value}</div>
                <div style={{ color: '#9a7c4e', fontSize: 9, fontFamily: 'Arial, sans-serif' }}>{col.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isPitcher && careerPitching && (
        <div className="px-6 py-4">
          <div
            className="text-xs font-bold uppercase tracking-widest mb-2 pb-1"
            style={{ color: '#8b0000', borderBottom: '1px solid #c9a84c', letterSpacing: '0.15em' }}
          >
            Career Pitching
          </div>
          <div className="grid grid-cols-8 gap-1 text-center">
            {[
              { label: 'W',    value: fmt(careerPitching.wins, 0) },
              { label: 'L',    value: fmt(careerPitching.losses, 0) },
              { label: 'ERA',  value: fmt(careerPitching.era) },
              { label: 'WHIP', value: fmt(careerPitching.whip) },
              { label: 'K',    value: fmt(careerPitching.strikeOutsPitched, 0) },
              { label: 'BB',   value: fmt(careerPitching.baseOnBallsPitched, 0) },
              { label: 'SV',   value: fmt(careerPitching.saves, 0) },
              { label: 'IP',   value: String(careerPitching.inningsPitched ?? '—') },
            ].map(col => (
              <div key={col.label} className="py-1.5 px-1" style={{ background: 'rgba(139,105,20,0.08)', borderRadius: 4 }}>
                <div className="font-bold" style={{ color: '#1a0a00', fontSize: 14 }}>{col.value}</div>
                <div style={{ color: '#7a5c2e', fontSize: 9, marginTop: 2, fontFamily: 'Arial, sans-serif' }}>
                  {col.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bio blurb area */}
      {mlbDetail && (
        <div className="px-6 pb-4">
          <div
            className="rounded p-3 text-xs leading-relaxed"
            style={{
              background: 'rgba(139,105,20,0.10)',
              border: '1px solid #c9a84c',
              color: '#3a2000',
              fontFamily: 'Georgia, serif',
            }}
          >
            {mlbDetail.fullName} is a {playerAge ? `${playerAge}-year-old` : ''}{' '}
            {mlbDetail.primaryPosition?.name?.toLowerCase()} currently with the {player.mlb_team ?? 'free agent market'}.
            {player.pro_debut_year
              ? ` He made his MLB debut in ${player.pro_debut_year}${yos !== null ? `, giving him ${yos} year${yos !== 1 ? 's' : ''} of major league service.` : '.'}`
              : ''}
            {mlbDetail.draftYear ? ` Originally drafted in ${mlbDetail.draftYear}.` : ''}
          </div>
        </div>
      )}

      {/* Bottom pinstripe */}
      <div style={{ background: 'linear-gradient(90deg, #8b0000, #cc0000, #8b0000)', height: 6 }} />
    </div>
  )
}
