import { useMemo } from 'react'
import type { Session } from '../types/f1'

interface Props {
  sessions:          Session[] | undefined
  selectedSessionId: number | null
  onSelect:          (id: number) => void
}

const SESSION_TYPE_ORDER = ['FP1', 'FP2', 'FP3', 'SQ', 'Q', 'S', 'R']
const SESSION_TYPE_LABEL: Record<string, string> = {
  FP1: 'Free Practice 1', FP2: 'Free Practice 2', FP3: 'Free Practice 3',
  SQ: 'Sprint Qualifying', Q: 'Qualifying', S: 'Sprint', R: 'Race',
}

export function SessionSelector({ sessions, selectedSessionId, onSelect }: Props) {
  // 세션 목록을 라운드별로 그룹화
  const rounds = useMemo(() => {
    if (!sessions) return []
    const map = new Map<number, { event_name: string; sessions: Session[] }>()
    for (const s of sessions) {
      if (!map.has(s.round)) map.set(s.round, { event_name: s.event_name, sessions: [] })
      map.get(s.round)!.sessions.push(s)
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a - b)
      .map(([round, { event_name, sessions }]) => ({
        round,
        event_name,
        sessions: [...sessions].sort(
          (a, b) =>
            SESSION_TYPE_ORDER.indexOf(a.session_type) -
            SESSION_TYPE_ORDER.indexOf(b.session_type),
        ),
      }))
  }, [sessions])

  if (!sessions) return <div className="selector-placeholder">세션 로딩 중…</div>

  return (
    <select
      className="selector"
      value={selectedSessionId ?? ''}
      onChange={e => onSelect(Number(e.target.value))}
    >
      <option value="" disabled>세션 선택</option>
      {rounds.map(({ round, event_name, sessions }) => (
        <optgroup key={round} label={`R${round} · ${event_name}`}>
          {sessions.map(s => (
            <option key={s.id} value={s.id}>
              {SESSION_TYPE_LABEL[s.session_type] ?? s.session_type}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}
