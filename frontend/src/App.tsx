import { useState, useEffect } from 'react'
import { useSessions }      from './hooks/useSessions'
import { useDrivers }       from './hooks/useDrivers'
import { useTelemetry }     from './hooks/useTelemetry'
import { SessionSelector }  from './components/SessionSelector'
import { DriverLapSelector } from './components/DriverLapSelector'
import { TelemetryChart }   from './components/TelemetryChart'
import { TrackMap }         from './components/TrackMap'

const CURRENT_SEASON = 2025

export default function App() {
  // ── 선택 상태 ────────────────────────────────────────
  const [season]     = useState(CURRENT_SEASON)
  const [sessionId,  setSessionId]  = useState<number | null>(null)
  const [driverA,    setDriverA]    = useState<string | null>(null)
  const [driverB,    setDriverB]    = useState<string | null>(null)
  const [lapA,       setLapA]       = useState<number | null>(null)
  const [lapB,       setLapB]       = useState<number | null>(null)

  // ── 차트 호버 동기화 상태 ────────────────────────────────
  const [hoverTimeMs, setHoverTimeMs] = useState<number | null>(null)

  // ── 서버 상태 ────────────────────────────────────────
  const { data: sessions, isLoading: sessLoading } = useSessions(season)
  const { data: drivers }                           = useDrivers(sessionId)
  const { data: telemetry, isFetching: telLoading } = useTelemetry(
    sessionId,
    [driverA, driverB],
    [lapA, lapB],
  )

  // 세션 바뀌면 드라이버·랩 초기화
  useEffect(() => {
    setDriverA(null); setDriverB(null)
    setLapA(null);    setLapB(null)
  }, [sessionId])

  // 드라이버 바뀌면 상대 드라이버와 같지 않게 보정
  const handleDriverA = (code: string) => {
    setDriverA(code)
    if (code === driverB) setDriverB(null)
    setLapA(null)
  }
  const handleDriverB = (code: string) => {
    setDriverB(code)
    if (code === driverA) setDriverA(null)
    setLapB(null)
  }

  const sessionLabel = sessions?.find(s => s.id === sessionId)
    ? `R${sessions.find(s => s.id === sessionId)!.round} ${sessions.find(s => s.id === sessionId)!.event_name} — ${sessions.find(s => s.id === sessionId)!.session_type}`
    : ''

  return (
    <div className="app">
      {/* ── 헤더 ─────────────────────────────────────── */}
      <header className="app-header">
        <h1 className="app-title">F1 Telemetry Analytics</h1>
        {sessionLabel && <span className="session-label">{sessionLabel}</span>}
      </header>

      {/* ── 컨트롤 패널 ───────────────────────────────── */}
      <section className="controls">
        <div className="control-row">
          <label className="control-label">Season</label>
          <span className="season-badge">{season}</span>
          <label className="control-label">Session</label>
          {sessLoading
            ? <span className="loading-text">로딩 중…</span>
            : <SessionSelector
                sessions={sessions}
                selectedSessionId={sessionId}
                onSelect={setSessionId}
              />}
        </div>

        {sessionId && (
          <div className="driver-rows">
            <DriverLapSelector
              label="A"
              sessionId={sessionId}
              drivers={drivers}
              driverCode={driverA}
              lapNumber={lapA}
              onDriver={handleDriverA}
              onLap={setLapA}
            />
            <DriverLapSelector
              label="B"
              sessionId={sessionId}
              drivers={drivers}
              driverCode={driverB}
              lapNumber={lapB}
              onDriver={handleDriverB}
              onLap={setLapB}
            />
          </div>
        )}
      </section>

      {/* ── 차트 영역 ─────────────────────────────────── */}
      <section className="chart-section">
        {telLoading && (
          <div className="loading-overlay">텔레메트리 로딩 중…</div>
        )}
        {telemetry && telemetry.comparisons.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <TrackMap 
              comparisons={telemetry.comparisons} 
              hoverTimeMs={hoverTimeMs} 
            />
            <TelemetryChart 
              comparisons={telemetry.comparisons} 
              onHover={setHoverTimeMs} 
            />
          </div>
        ) : (
          !telLoading && (
            <div className="empty-state">
              {sessionId
                ? '드라이버 2명과 랩을 선택하면 비교 차트가 표시됩니다.'
                : '좌측 상단에서 세션을 선택하세요.'}
            </div>
          )
        )}
      </section>
    </div>
  )
}
