import type { SessionResult } from '../types/f1'

interface Props {
  results: SessionResult[]
  sessionType: string   // 'R' | 'Q' | 'SQ' | 'S' | ...
}

function msToLapTime(ms: number | null): string {
  if (ms == null) return '—'
  const totalSec = ms / 1000
  const m   = Math.floor(totalSec / 60)
  const s   = Math.floor(totalSec % 60)
  const dec = Math.round((totalSec % 1) * 1000)
  return `${m}:${String(s).padStart(2, '0')}.${String(dec).padStart(3, '0')}`
}

function posDisplay(pos: number | null, status: string | null): string {
  if (pos != null) return String(pos)
  if (status && status !== 'Finished') return status.replace('Accident', 'DNF').slice(0, 6)
  return 'DNF'
}

const isQuali = (t: string) => ['Q', 'SQ'].includes(t)
const isRace  = (t: string) => ['R', 'S'].includes(t)

export function ResultsTable({ results, sessionType }: Props) {
  if (results.length === 0) {
    return (
      <div style={{ color: '#555', padding: '24px', textAlign: 'center', fontSize: 13 }}>
        결과 데이터 없음
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: 13,
        color: '#ccc',
      }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #333', color: '#888', fontSize: 11 }}>
            <th style={th}>POS</th>
            <th style={{ ...th, textAlign: 'left' }}>DRIVER</th>
            <th style={th}>TEAM</th>
            {isRace(sessionType) && <th style={th}>GRID</th>}
            {isRace(sessionType) && <th style={th}>PTS</th>}
            {isQuali(sessionType) && <th style={th}>Q1</th>}
            {isQuali(sessionType) && <th style={th}>Q2</th>}
            {isQuali(sessionType) && <th style={th}>Q3</th>}
            <th style={th}>STATUS</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r, i) => {
            const color = `#${r.team_color ?? 'FFFFFF'}`
            const isDnf = r.classified_position == null
            return (
              <tr
                key={r.driver_code}
                style={{
                  borderBottom: '1px solid #1e1e1e',
                  opacity: isDnf ? 0.55 : 1,
                  background: i % 2 === 0 ? '#111' : '#0d0d0d',
                }}
              >
                {/* POS */}
                <td style={{ ...td, fontWeight: 700, color: isDnf ? '#555' : '#fff' }}>
                  {posDisplay(r.classified_position, r.status)}
                </td>

                {/* DRIVER */}
                <td style={{ ...td, textAlign: 'left' }}>
                  <span style={{
                    display: 'inline-block',
                    width: 3,
                    height: 14,
                    background: color,
                    borderRadius: 1,
                    marginRight: 8,
                    verticalAlign: 'middle',
                  }} />
                  <span style={{ color: '#fff', fontWeight: 600 }}>{r.driver_code}</span>
                  {r.full_name && (
                    <span style={{ color: '#666', marginLeft: 6, fontSize: 11 }}>
                      {r.full_name}
                    </span>
                  )}
                </td>

                {/* TEAM */}
                <td style={{ ...td, color: '#888' }}>{r.team_name ?? '—'}</td>

                {/* 레이스 전용 */}
                {isRace(sessionType) && (
                  <td style={td}>{r.grid_position ?? '—'}</td>
                )}
                {isRace(sessionType) && (
                  <td style={{ ...td, color: r.points ? '#f0d060' : '#555' }}>
                    {r.points != null ? r.points : '—'}
                  </td>
                )}

                {/* 예선 전용 */}
                {isQuali(sessionType) && <td style={td}>{msToLapTime(r.q1_ms)}</td>}
                {isQuali(sessionType) && <td style={td}>{msToLapTime(r.q2_ms)}</td>}
                {isQuali(sessionType) && <td style={td}>{msToLapTime(r.q3_ms)}</td>}

                {/* STATUS */}
                <td style={{ ...td, color: isDnf ? '#c0392b' : '#2ecc71', fontSize: 11 }}>
                  {r.status ?? '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

const th: React.CSSProperties = {
  padding: '8px 12px',
  textAlign: 'center',
  fontWeight: 500,
  letterSpacing: '0.05em',
}

const td: React.CSSProperties = {
  padding: '7px 12px',
  textAlign: 'center',
}
