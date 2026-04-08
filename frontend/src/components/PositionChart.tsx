import { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import type { Lap } from '../types/f1'

interface Props {
  allLaps: Lap[]
  /** 강조 드라이버 코드 목록 (팀 컬러 맵) */
  driverColors: Record<string, string>  // { VER: 'FF8000', ... }
}

export function PositionChart({ allLaps, driverColors }: Props) {
  const option = useMemo(() => {
    if (allLaps.length === 0) return {}

    // 포지션이 있는 랩만
    const validLaps = allLaps.filter(l => l.position != null && l.lap_number != null)
    if (validLaps.length === 0) return {}

    // 드라이버별 그룹핑
    const byDriver: Record<string, Lap[]> = {}
    for (const lap of validLaps) {
      if (!byDriver[lap.driver_code]) byDriver[lap.driver_code] = []
      byDriver[lap.driver_code].push(lap)
    }

    const drivers = Object.keys(byDriver).sort()
    const maxLap  = Math.max(...validLaps.map(l => l.lap_number!))

    const series = drivers.map(code => {
      const laps = byDriver[code].sort((a, b) => a.lap_number! - b.lap_number!)
      const color = driverColors[code] ? `#${driverColors[code]}` : '#888'
      return {
        name: code,
        type: 'line',
        data: laps.map(l => [l.lap_number, l.position]),
        symbol: 'none',
        lineStyle: { color, width: code in driverColors ? 2 : 1, opacity: code in driverColors ? 1 : 0.3 },
        itemStyle: { color },
        emphasis: { disabled: true },
        animation: false,
      }
    })

    return {
      backgroundColor: '#111',
      grid: { top: 30, right: 20, bottom: 40, left: 45 },
      xAxis: {
        type: 'value',
        name: 'Lap',
        nameLocation: 'middle',
        nameGap: 26,
        min: 1,
        max: maxLap,
        axisLine: { lineStyle: { color: '#333' } },
        axisTick: { lineStyle: { color: '#333' } },
        axisLabel: { color: '#666', fontSize: 11 },
        splitLine: { lineStyle: { color: '#1a1a1a' } },
      },
      yAxis: {
        type: 'value',
        name: 'Position',
        nameLocation: 'middle',
        nameGap: 35,
        inverse: true,   // 1위가 위쪽
        min: 1,
        max: 20,
        interval: 1,
        axisLine: { lineStyle: { color: '#333' } },
        axisTick: { lineStyle: { color: '#333' } },
        axisLabel: { color: '#666', fontSize: 11 },
        splitLine: { lineStyle: { color: '#1a1a1a' } },
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#1a1a1a',
        borderColor: '#333',
        textStyle: { color: '#ccc', fontSize: 11 },
        formatter: (params: any[]) => {
          const lap = params[0]?.axisValue
          const lines = params
            .filter(p => p.data?.[1] != null)
            .sort((a, b) => (a.data?.[1] ?? 99) - (b.data?.[1] ?? 99))
            .map(p => {
              const color = p.color
              const pos   = p.data?.[1]
              return `<span style="color:${color};font-weight:600">${p.seriesName}</span> P${pos}`
            })
            .join('<br/>')
          return `<b style="color:#aaa">Lap ${lap}</b><br/>${lines}`
        },
      },
      series,
    }
  }, [allLaps, driverColors])

  if (allLaps.length === 0 || Object.keys(option).length === 0) {
    return (
      <div style={{ color: '#555', padding: '24px', textAlign: 'center', fontSize: 13 }}>
        포지션 데이터 없음
      </div>
    )
  }

  return (
    <ReactECharts
      option={option}
      style={{ height: 280 }}
      notMerge
    />
  )
}
