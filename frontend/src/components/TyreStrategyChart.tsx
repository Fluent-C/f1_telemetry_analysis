import { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import { useQuery } from '@tanstack/react-query'
import { fetchAllLaps } from '../api/f1Client'
import type { Lap } from '../types/f1'

const COMPOUND_COLORS: Record<string, string> = {
  SOFT:         '#e8002d',
  MEDIUM:       '#ffd700',
  HARD:         '#f0f0f0',
  INTERMEDIATE: '#43b02a',
  WET:          '#0067ff',
  UNKNOWN:      '#888888',
  TEST_UNKNOWN: '#888888',
}

interface Props {
  sessionId: number
}

interface Stint {
  driver:    string
  compound:  string
  startLap:  number
  endLap:    number
  tyreLife:  number   // stint 시작 시 tyre_life (fresh면 0)
}

function buildStints(laps: Lap[]): Stint[] {
  // 드라이버별 lap 묶기 → stint 그룹핑
  const byDriver: Record<string, Lap[]> = {}
  for (const lap of laps) {
    if (!byDriver[lap.driver_code]) byDriver[lap.driver_code] = []
    byDriver[lap.driver_code].push(lap)
  }

  const stints: Stint[] = []
  for (const [driver, driverLaps] of Object.entries(byDriver)) {
    const sorted = [...driverLaps].sort((a, b) => a.lap_number - b.lap_number)
    let stintStart = 0
    let lastStint = -1

    for (let i = 0; i < sorted.length; i++) {
      const lap = sorted[i]
      const stintNum = lap.stint ?? 0
      if (stintNum !== lastStint) {
        // 새 stint 시작
        stintStart = i
        lastStint = stintNum
      }
      // 다음 랩이 없거나 stint 변경 직전이면 현재 stint 확정
      if (i === sorted.length - 1 || (sorted[i + 1].stint ?? 0) !== stintNum) {
        const compound = (lap.compound ?? 'UNKNOWN').toUpperCase()
        stints.push({
          driver,
          compound,
          startLap: sorted[stintStart].lap_number,
          endLap:   lap.lap_number,
          tyreLife: sorted[stintStart].tyre_life ?? 0,
        })
      }
    }
  }
  return stints
}

export function TyreStrategyChart({ sessionId }: Props) {
  const { data: laps, isLoading } = useQuery({
    queryKey: ['allLaps', sessionId],
    queryFn:  () => fetchAllLaps(sessionId),
    enabled:  !!sessionId,
  })

  const { drivers, stints, maxLap } = useMemo(() => {
    if (!laps || laps.length === 0) return { drivers: [], stints: [], maxLap: 60 }

    const stints = buildStints(laps)
    const drivers = [...new Set(laps.map(l => l.driver_code))].sort()
    const maxLap = Math.max(...laps.map(l => l.lap_number), 1)
    return { drivers, stints, maxLap }
  }, [laps])

  const option = useMemo(() => {
    if (drivers.length === 0) return {}

    // ECharts custom 렌더러 없이 bar 타입으로 구현
    // Y축: 드라이버 코드, X축: 랩 번호 범위
    // 드라이버별 stint를 시리즈로 구성
    const compoundSet = [...new Set(stints.map(s => s.compound))]

    const series = compoundSet.map(compound => ({
      name: compound,
      type: 'bar' as const,
      stack: 'stints',
      barMaxWidth: 16,
      itemStyle: { color: COMPOUND_COLORS[compound] ?? '#888' },
      data: drivers.map(driver => {
        // 이 드라이버의 이 컴파운드 stint들
        const driverStints = stints.filter(
          s => s.driver === driver && s.compound === compound
        )
        if (driverStints.length === 0) return 0
        // laps count로 환산
        return driverStints.reduce((sum, s) => sum + (s.endLap - s.startLap + 1), 0)
      }),
      emphasis: { focus: 'series' },
    }))

    return {
      backgroundColor: '#0d0d0d',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: '#1a1a1a',
        borderColor: '#333',
        textStyle: { color: '#ccc', fontSize: 11 },
        formatter: (params: any[]) => {
          const driver = drivers[params[0]?.dataIndex]
          const driverStints = stints.filter(s => s.driver === driver)
          if (driverStints.length === 0) return driver
          let tip = `<b>${driver}</b><br/>`
          driverStints.forEach(s => {
            const color = COMPOUND_COLORS[s.compound] ?? '#888'
            tip += `<span style="color:${color}">■</span> `
            tip += `${s.compound} L${s.startLap}–${s.endLap}`
            if (s.tyreLife > 0) tip += ` (+${s.tyreLife} used)`
            tip += '<br/>'
          })
          return tip
        },
      },
      legend: {
        data: compoundSet,
        top: 4,
        textStyle: { color: '#999', fontSize: 10 },
        itemWidth: 12,
        itemHeight: 8,
      },
      grid: { left: 48, right: 16, top: 32, bottom: 8, containLabel: false },
      xAxis: {
        type: 'value',
        max: maxLap,
        name: 'Laps',
        nameTextStyle: { color: '#666', fontSize: 10 },
        axisLabel: { color: '#777', fontSize: 9 },
        splitLine: { lineStyle: { color: '#1e1e1e' } },
      },
      yAxis: {
        type: 'category',
        data: drivers,
        axisLabel: { color: '#999', fontSize: 10 },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series,
    }
  }, [drivers, stints, maxLap])

  if (isLoading) {
    return (
      <div style={{ color: '#666', fontSize: 12, padding: '12px 0', textAlign: 'center' }}>
        타이어 전략 로딩 중…
      </div>
    )
  }
  if (!laps || laps.length === 0) return null

  const chartHeight = Math.max(120, drivers.length * 22 + 48)

  return (
    <div style={{ width: '100%' }}>
      <div style={{ color: '#888', fontSize: 11, marginBottom: 4 }}>
        Tyre Strategy
      </div>
      <ReactECharts
        option={option}
        style={{ height: `${chartHeight}px`, width: '100%' }}
        opts={{ renderer: 'canvas' }}
        notMerge
      />
    </div>
  )
}
