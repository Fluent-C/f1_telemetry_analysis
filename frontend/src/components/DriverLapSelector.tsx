import { useEffect } from 'react'
import { useLaps, fastestLap } from '../hooks/useLaps'
import type { Driver } from '../types/f1'

interface Props {
  label:        'A' | 'B'
  sessionId:    number | null
  drivers:      Driver[] | undefined
  driverCode:   string | null
  lapNumber:    number | null
  onDriver:     (code: string) => void
  onLap:        (lap: number) => void
}

function msToLapTime(ms: number): string {
  const min  = Math.floor(ms / 60000)
  const sec  = Math.floor((ms % 60000) / 1000)
  const msec = ms % 1000
  return `${min}:${String(sec).padStart(2, '0')}.${String(msec).padStart(3, '0')}`
}

export function DriverLapSelector({
  label, sessionId, drivers, driverCode, lapNumber, onDriver, onLap,
}: Props) {
  const { data: laps } = useLaps(sessionId, driverCode)

  // 드라이버가 바뀌면 최속 랩으로 자동 설정
  useEffect(() => {
    const best = fastestLap(laps)
    if (best !== null) onLap(best)
  }, [laps]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="driver-row">
      <span className="driver-label">Driver {label}</span>

      {/* 드라이버 선택 */}
      <select
        className="selector driver-select"
        value={driverCode ?? ''}
        onChange={e => onDriver(e.target.value)}
      >
        <option value="" disabled>드라이버 선택</option>
        {drivers?.map(d => (
          <option key={d.driver_code} value={d.driver_code}>
            {d.driver_code} · {d.team_name ?? ''}
          </option>
        ))}
      </select>

      {/* 팀 색상 뱃지 */}
      {driverCode && drivers && (() => {
        const d = drivers.find(x => x.driver_code === driverCode)
        return d ? (
          <span
            className="team-badge"
            style={{ background: `#${d.team_color}` }}
            title={d.team_name ?? ''}
          />
        ) : null
      })()}

      {/* 랩 선택 */}
      <select
        className="selector lap-select"
        value={lapNumber ?? ''}
        onChange={e => onLap(Number(e.target.value))}
        disabled={!laps}
      >
        <option value="" disabled>랩 선택</option>
        {laps
          ?.filter(l => l.lap_time_ms !== null && !l.deleted)
          .map(l => (
            <option key={l.lap_number} value={l.lap_number}>
              Lap {l.lap_number} · {msToLapTime(l.lap_time_ms!)}
              {l.is_personal_best ? ' ⚡' : ''}
            </option>
          ))}
      </select>
    </div>
  )
}
