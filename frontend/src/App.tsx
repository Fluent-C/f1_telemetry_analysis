import { useState, useEffect } from 'react'
import { useSessions }        from './hooks/useSessions'
import { useDrivers }         from './hooks/useDrivers'
import { useLaps, useAllLaps } from './hooks/useLaps'
import { useTelemetry }       from './hooks/useTelemetry'
import { useResults }         from './hooks/useResults'
import { SessionSelector }    from './components/SessionSelector'
import { DriverLapSelector }  from './components/DriverLapSelector'
import { TelemetryChart }     from './components/TelemetryChart'
import { TrackMap }           from './components/TrackMap'
import { SectorDeltaChart }   from './components/SectorDeltaChart'
import { TyreStrategyChart }  from './components/TyreStrategyChart'
import { ResultsTable }       from './components/ResultsTable'
import { PositionChart }      from './components/PositionChart'
import { GapChart }           from './components/GapChart'

const CURRENT_SEASON = 2025

type Tab = 'telemetry' | 'results'

export default function App() {
  // ── 선택 상태 ────────────────────────────────────────
  const [season]     = useState(CURRENT_SEASON)
  const [sessionId,  setSessionId]  = useState<number | null>(null)
  const [driverA,    setDriverA]    = useState<string | null>(null)
  const [driverB,    setDriverB]    = useState<string | null>(null)
  const [lapA,       setLapA]       = useState<number | null>(null)
  const [lapB,       setLapB]       = useState<number | null>(null)
  const [activeTab,  setActiveTab]  = useState<Tab>('telemetry')

  // ── 차트 호버 동기화 상태 ──────────────────────────────
  const [hoverTimeMs, setHoverTimeMs] = useState<number | null>(null)

  // ── 서버 상태 ────────────────────────────────────────
  const { data: sessions, isLoading: sessLoading } = useSessions(season)
  const { data: drivers }                           = useDrivers(sessionId)
  const { data: lapsA }                             = useLaps(sessionId, driverA)
  const { data: lapsB }                             = useLaps(sessionId, driverB)
  const { data: allLaps }                           = useAllLaps(sessionId)
  const { data: results }                           = useResults(sessionId)
  const { data: telemetry, isFetching: telLoading } = useTelemetry(
    sessionId,
    [driverA, driverB],
    [lapA, lapB],
  )

  // SectorDeltaChart용: 선택된 랩 번호에 해당하는 Lap 객체
  const selectedLapA = lapsA?.find(l => l.lap_number === lapA) ?? null
  const selectedLapB = lapsB?.find(l => l.lap_number === lapB) ?? null

  // 팀 컬러 맵 (모든 드라이버 — PositionChart / GapChart용)
  const driverColors: Record<string, string> = {}
  drivers?.forEach(d => { driverColors[d.driver_code] = d.team_color })

  const colorA = driverColors[driverA ?? ''] ?? 'FFFFFF'
  const colorB = driverColors[driverB ?? ''] ?? 'FFFFFF'

  // 현재 세션 타입
  const currentSession = sessions?.find(s => s.id === sessionId)
  const sessionType    = currentSession?.session_type ?? 'R'

  // 세션 바뀌면 드라이버·랩 초기화
  useEffect(() => {
    setDriverA(null); setDriverB(null)
    setLapA(null);    setLapB(null)
  }, [sessionId])

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

  const sessionLabel = currentSession
    ? `R${currentSession.round} ${currentSession.event_name} — ${currentSession.session_type}`
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

      {/* ── 탭 바 ─────────────────────────────────────── */}
      {sessionId && (
        <div style={{
          display: 'flex',
          gap: 4,
          padding: '0 16px',
          borderBottom: '1px solid #222',
          marginBottom: 0,
        }}>
          {(['telemetry', 'results'] as Tab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: activeTab === tab ? '2px solid #e10600' : '2px solid transparent',
                color: activeTab === tab ? '#fff' : '#555',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: activeTab === tab ? 600 : 400,
                padding: '10px 16px',
                letterSpacing: '0.04em',
                transition: 'color 0.15s',
              }}
            >
              {tab === 'telemetry' ? '텔레메트리 비교' : '레이스 결과'}
            </button>
          ))}
        </div>
      )}

      {/* ── 차트 영역 ─────────────────────────────────── */}
      <section className="chart-section">

        {/* ── 텔레메트리 탭 ────────────────────────────── */}
        {(!sessionId || activeTab === 'telemetry') && (
          <>
            {telLoading && (
              <div className="loading-overlay">텔레메트리 로딩 중…</div>
            )}

            {sessionId && (
              <TyreStrategyChart sessionId={sessionId} />
            )}

            {telemetry && telemetry.comparisons.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '20px' }}>
                <TrackMap
                  comparisons={telemetry.comparisons}
                  hoverTimeMs={hoverTimeMs}
                />
                <SectorDeltaChart
                  lapA={selectedLapA}
                  lapB={selectedLapB}
                  colorA={colorA}
                  colorB={colorB}
                  codeA={driverA ?? ''}
                  codeB={driverB ?? ''}
                />
                <TelemetryChart
                  comparisons={telemetry.comparisons}
                  onHover={setHoverTimeMs}
                />
              </div>
            ) : (
              !telLoading && sessionId && (
                <div className="empty-state">
                  드라이버 2명과 랩을 선택하면 비교 차트가 표시됩니다.
                </div>
              )
            )}

            {!sessionId && (
              <div className="empty-state">좌측 상단에서 세션을 선택하세요.</div>
            )}
          </>
        )}

        {/* ── 결과 탭 ──────────────────────────────────── */}
        {sessionId && activeTab === 'results' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingTop: 16 }}>

            {/* 결과 테이블 */}
            <div>
              <h3 style={{ color: '#888', fontSize: 11, letterSpacing: '0.1em', margin: '0 0 8px 0' }}>
                RACE RESULTS
              </h3>
              <ResultsTable
                results={results ?? []}
                sessionType={sessionType}
              />
            </div>

            {/* 포지션 차트 — 레이스·스프린트 세션만 */}
            {['R', 'S'].includes(sessionType) && (
              <div>
                <h3 style={{ color: '#888', fontSize: 11, letterSpacing: '0.1em', margin: '0 0 8px 0' }}>
                  LAP-BY-LAP POSITION
                </h3>
                <PositionChart
                  allLaps={allLaps ?? []}
                  driverColors={driverColors}
                />
              </div>
            )}

            {/* 갭 차트 — 레이스·스프린트 세션만 */}
            {['R', 'S'].includes(sessionType) && (
              <div>
                <h3 style={{ color: '#888', fontSize: 11, letterSpacing: '0.1em', margin: '0 0 8px 0' }}>
                  GAP TO LEADER
                </h3>
                <GapChart
                  allLaps={allLaps ?? []}
                  driverColors={driverColors}
                />
              </div>
            )}

          </div>
        )}

      </section>
    </div>
  )
}
