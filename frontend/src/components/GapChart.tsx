import { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import type { Lap } from '../types/f1'

interface Props {
  allLaps:       Lap[]
  driverColors:  Record<string, string>  // { VER: 'FF8000', ... }
  dashedDrivers: Set<string>
}

export function GapChart({ allLaps, driverColors, dashedDrivers }: Props) {
  const option = useMemo(() => {
    if (allLaps.length === 0) return {}

    // lap_time_ms가 있는 랩만
    const validLaps = allLaps.filter(l => l.lap_time_ms != null && l.lap_number != null)
    if (validLaps.length === 0) return {}

    // 드라이버별 그룹핑 + 랩 번호 정렬
    const byDriver: Record<string, Lap[]> = {}
    for (const lap of validLaps) {
      if (!byDriver[lap.driver_code]) byDriver[lap.driver_code] = []
      byDriver[lap.driver_code].push(lap)
    }
    for (const code of Object.keys(byDriver)) {
      byDriver[code].sort((a, b) => a.lap_number! - b.lap_number!)
    }

    const drivers = Object.keys(byDriver)

    // 리더 결정: 각 랩에서 position=1인 드라이버 혹은 누적 랩타임이 가장 작은 드라이버
    // 전체 랩에 걸쳐 누적 랩타임이 가장 작은 드라이버를 리더로 사용
    const cumByDriver: Record<string, Map<number, number>> = {}
    for (const code of drivers) {
      let cum = 0
      const map = new Map<number, number>()
      for (const lap of byDriver[code]) {
        cum += lap.lap_time_ms!
        map.set(lap.lap_number!, cum)
      }
      cumByDriver[code] = map
    }

    // 각 랩에서 최소 누적 시간 (리더 기준)
    const allLapNums = [...new Set(validLaps.map(l => l.lap_number!))].sort((a, b) => a - b)
    const leaderCum  = new Map<number, number>()
    for (const lapNum of allLapNums) {
      let minCum = Infinity
      for (const code of drivers) {
        const cum = cumByDriver[code].get(lapNum)
        if (cum != null && cum < minCum) minCum = cum
      }
      if (minCum < Infinity) leaderCum.set(lapNum, minCum)
    }

    const maxLap = Math.max(...allLapNums)

    const series = drivers.map(code => {
      const color = driverColors[code] ? `#${driverColors[code]}` : '#888'
      const data  = allLapNums
        .filter(lapNum => cumByDriver[code].has(lapNum) && leaderCum.has(lapNum))
        .map(lapNum => {
          const gap = (cumByDriver[code].get(lapNum)! - leaderCum.get(lapNum)!) / 1000
          return [lapNum, Math.round(gap * 1000) / 1000]
        })
      return {
        name: code,
        type: 'line',
        data,
        symbol: 'none',
        lineStyle: {
          color,
          width:   code in driverColors ? 2 : 1,
          opacity: code in driverColors ? 1 : 0.3,
          type:    dashedDrivers.has(code) ? 'dashed' : 'solid',
        },
        itemStyle: { color },
        emphasis: { disabled: true },
        animation: false,
      }
    })

    return {
      backgroundColor: '#111',
      grid: { top: 30, right: 20, bottom: 40, left: 55 },
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
        name: 'Gap (s)',
        nameLocation: 'middle',
        nameGap: 42,
        axisLine: { lineStyle: { color: '#333' } },
        axisTick: { lineStyle: { color: '#333' } },
        axisLabel: { color: '#666', fontSize: 11, formatter: (v: number) => `+${v.toFixed(0)}s` },
        splitLine: { lineStyle: { color: '#1a1a1a' } },
        min: 0,
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
            .sort((a, b) => (a.data?.[1] ?? 999) - (b.data?.[1] ?? 999))
            .map(p => {
              const gap = p.data?.[1] as number
              return `<span style="color:${p.color};font-weight:600">${p.seriesName}</span> +${gap.toFixed(3)}s`
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
        갭 데이터 없음 (레이스 세션에서 사용 가능)
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
