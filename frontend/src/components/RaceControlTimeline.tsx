import { useMemo } from 'react'
import type { RaceControlMessage } from '../types/f1'

interface Props {
  messages: RaceControlMessage[]
  /** 전체 랩 수 (X축 범위) */
  totalLaps: number
}

// 플래그/카테고리별 색상
const FLAG_COLOR: Record<string, string> = {
  'SAFETY CAR':          '#f1c40f',
  'VIRTUAL SAFETY CAR':  '#f39c12',
  'YELLOW':              '#f1c40f',
  'DOUBLE YELLOW':       '#e67e22',
  'RED':                 '#e74c3c',
  'GREEN':               '#2ecc71',
  'CLEAR':               '#2ecc71',
  'CHEQUERED':           '#ecf0f1',
}

const FLAG_LABEL: Record<string, string> = {
  'SAFETY CAR':          'SC',
  'VIRTUAL SAFETY CAR':  'VSC',
  'YELLOW':              'YEL',
  'DOUBLE YELLOW':       'DBL',
  'RED':                 'RED',
  'GREEN':               'GRN',
  'CLEAR':               'CLR',
  'CHEQUERED':           '🏁',
}

function getColor(msg: RaceControlMessage): string {
  if (msg.flag) {
    const key = Object.keys(FLAG_COLOR).find(k =>
      msg.flag!.toUpperCase().includes(k)
    )
    if (key) return FLAG_COLOR[key]
  }
  if (msg.category === 'SafetyCar') return FLAG_COLOR['SAFETY CAR']
  if (msg.category === 'Flag')      return FLAG_COLOR['YELLOW']
  return '#555'
}

function getLabel(msg: RaceControlMessage): string {
  if (msg.flag) {
    const key = Object.keys(FLAG_LABEL).find(k =>
      msg.flag!.toUpperCase().includes(k)
    )
    if (key) return FLAG_LABEL[key]
  }
  if (msg.category === 'SafetyCar') return FLAG_LABEL['SAFETY CAR']
  if (msg.category === 'Drs')       return 'DRS'
  return '!'
}

export function RaceControlTimeline({ messages, totalLaps }: Props) {
  // 랩 번호가 있는 메시지만 필터 (lap-by-lap 타임라인)
  const events = useMemo(() =>
    messages.filter(m => m.lap_number != null),
    [messages]
  )

  if (events.length === 0) return null

  const maxLap = Math.max(totalLaps, 1)

  return (
    <div style={{
      position: 'relative',
      height: 28,
      background: '#0a0a0a',
      border: '1px solid #1e1e1e',
      borderBottom: 'none',
      overflow: 'hidden',
    }}>
      {/* 배경 트랙 */}
      <div style={{
        position: 'absolute', top: '50%', left: 8, right: 8,
        height: 2, background: '#1e1e1e', transform: 'translateY(-50%)',
      }} />

      {/* 이벤트 마커 */}
      {events.map((msg, i) => {
        const pct = ((msg.lap_number! - 1) / maxLap) * 100
        const color = getColor(msg)
        const label = getLabel(msg)
        return (
          <div
            key={i}
            title={`Lap ${msg.lap_number}: ${msg.message}`}
            style={{
              position: 'absolute',
              left: `calc(${pct}% + 8px)`,
              top: '50%',
              transform: 'translate(-50%, -50%)',
              background: color,
              color: '#000',
              fontSize: 8,
              fontWeight: 700,
              padding: '1px 3px',
              borderRadius: 2,
              whiteSpace: 'nowrap',
              cursor: 'default',
              lineHeight: '14px',
              letterSpacing: '0.02em',
            }}
          >
            {label}
          </div>
        )
      })}

      {/* 레이블 */}
      <span style={{
        position: 'absolute', right: 4, top: '50%',
        transform: 'translateY(-50%)',
        fontSize: 9, color: '#333', letterSpacing: '0.08em',
      }}>
        RACE CONTROL
      </span>
    </div>
  )
}
