/**
 * DrsAnalysisChart.tsx  — D-2: DRS 델타 드라이버 비교
 *
 * 두 드라이버의 각 DRS 구간별 최고속도(Max Speed)를 비교하는 그룹 막대 차트.
 * DRS 활성화(drs=2) 시 속도 이득이 큰 팀은 리어윙 항력이 DRS에 더 의존함을 시사.
 *
 * 검증 기준:
 *  - 동일 DRS 구간에서 두 드라이버 간 속도 차가 0~15 km/h 범위이면 정상
 *  - 전체 구간에서 일관되게 한쪽이 높으면 차량 직선주행 성능 차이를 반영
 */

import { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import type { DriverTelemetry } from '../types/f1'

interface Props {
  comparisons: DriverTelemetry[]
}

interface DrsZoneResult {
  zoneIndex: number
  driver_code: string
  team_color: string
  maxSpeed: number
  entrySpeed: number   // DRS 활성화 직전 속도
  speedGain: number    // entrySpeed → maxSpeed 차이
}

function analyzeDrs(comparisons: DriverTelemetry[]): DrsZoneResult[][] {
  if (comparisons.length === 0) return []

  // 첫 번째 드라이버 기준으로 DRS 구간 인덱스를 특정
  const ref = comparisons[0].data
  const zoneStarts: number[] = []  // time_ms index where drs becomes 2

  for (let i = 1; i < ref.time_ms.length; i++) {
    if ((ref.drs?.[i] === 2) && (ref.drs?.[i - 1] !== 2)) {
      zoneStarts.push(i)
    }
  }

  if (zoneStarts.length === 0) return []

  // 각 구간 [start, end] 계산
  const zones: [number, number][] = zoneStarts.map((start, idx) => {
    let end = ref.time_ms.length - 1
    for (let i = start + 1; i < ref.time_ms.length; i++) {
      if (ref.drs?.[i] !== 2) { end = i - 1; break }
    }
    return [start, end]
  })

  // 각 드라이버 × 각 구간 분석
  return zones.map(([zStart, zEnd], zoneIdx) => {
    const refTimeStart = ref.time_ms[zStart]
    const refTimeEnd   = ref.time_ms[zEnd]

    return comparisons.map(comp => {
      const d = comp.data
      // 시간 기준으로 해당 드라이버의 같은 구간 찾기
      const iStart = d.time_ms.findIndex(t => t >= refTimeStart)
      const iEnd   = d.time_ms.findIndex(t => t > refTimeEnd)
      const end    = iEnd === -1 ? d.time_ms.length - 1 : iEnd

      if (iStart === -1 || end <= iStart) {
        return { zoneIndex: zoneIdx, driver_code: comp.driver_code, team_color: comp.team_color, maxSpeed: 0, entrySpeed: 0, speedGain: 0 }
      }

      const speeds = d.speed.slice(iStart, end + 1).filter(s => s != null) as number[]
      const entrySpeed = (d.speed?.[Math.max(0, iStart - 3)] as number) ?? 0
      const maxSpeed   = speeds.length > 0 ? Math.max(...speeds) : 0

      return {
        zoneIndex:   zoneIdx,
        driver_code: comp.driver_code,
        team_color:  comp.team_color,
        maxSpeed:    Math.round(maxSpeed),
        entrySpeed:  Math.round(entrySpeed),
        speedGain:   Math.round(maxSpeed - entrySpeed),
      }
    })
  })
}

export function DrsAnalysisChart({ comparisons }: Props) {
  const zoneResults = useMemo(() => analyzeDrs(comparisons), [comparisons])

  const option = useMemo(() => {
    if (zoneResults.length === 0) return {}

    const zoneLabels = zoneResults.map((_, i) => `DRS Zone ${i + 1}`)

    // 드라이버별 시리즈
    const series = comparisons.map((comp, driverIdx) => ({
      name:      comp.driver_code,
      type:      'bar' as const,
      barGap:    '10%',
      itemStyle: { color: `#${comp.team_color}`, borderRadius: [2, 2, 0, 0] },
      data: zoneResults.map(zone => zone[driverIdx]?.maxSpeed ?? 0),
      label: {
        show: true,
        position: 'top' as const,
        color: '#888',
        fontSize: 10,
        formatter: (p: any) => `${p.value}`,
      },
    }))

    // 속도 이득(speedGain) 시리즈 추가
    const gainSeries = comparisons.map((comp, driverIdx) => ({
      name:      `${comp.driver_code} gain`,
      type:      'line' as const,
      yAxisIndex: 1,
      symbol:    'circle',
      symbolSize: 6,
      lineStyle: { color: `#${comp.team_color}`, type: 'dashed' as const, width: 1 },
      itemStyle: { color: `#${comp.team_color}` },
      data: zoneResults.map(zone => zone[driverIdx]?.speedGain ?? 0),
    }))

    const maxSpeed = Math.max(
      ...zoneResults.flatMap(z => z.map(r => r.maxSpeed)),
      250
    )

    return {
      backgroundColor: '#111',
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#1a1a1a',
        borderColor: '#333',
        textStyle: { color: '#ccc', fontSize: 11 },
        formatter: (params: any[]) => {
          const zone = params[0]?.name
          const lines = params.map((p: any) => {
            const unit = p.seriesName.includes('gain') ? ' km/h gain' : ' km/h max'
            return `<span style="color:${p.color}">${p.seriesName}: <b>${p.value}</b>${unit}</span>`
          }).join('<br/>')
          return `<b style="color:#aaa">${zone}</b><br/>${lines}`
        },
      },
      legend: {
        top: 4,
        textStyle: { color: '#aaa', fontSize: 11 },
        data: [
          ...comparisons.map(c => c.driver_code),
          ...comparisons.map(c => `${c.driver_code} gain`),
        ],
      },
      grid: { top: 40, right: 55, bottom: 30, left: 55 },
      xAxis: {
        type: 'category',
        data: zoneLabels,
        axisLine:  { lineStyle: { color: '#333' } },
        axisTick:  { lineStyle: { color: '#333' } },
        axisLabel: { color: '#666', fontSize: 11 },
      },
      yAxis: [
        {
          type: 'value',
          name: 'Max Speed (km/h)',
          nameTextStyle: { color: '#777', fontSize: 10 },
          min: Math.max(0, Math.min(...zoneResults.flatMap(z => z.map(r => r.maxSpeed))) - 20),
          max: maxSpeed + 10,
          axisLine:  { show: false },
          axisTick:  { show: false },
          axisLabel: { color: '#666', fontSize: 10 },
          splitLine: { lineStyle: { color: '#1a1a1a' } },
        },
        {
          type: 'value',
          name: 'Speed Gain (km/h)',
          nameTextStyle: { color: '#777', fontSize: 10 },
          min: 0,
          axisLine:  { show: false },
          axisTick:  { show: false },
          axisLabel: { color: '#555', fontSize: 10 },
          splitLine: { show: false },
        },
      ],
      series: [...series, ...gainSeries],
    }
  }, [zoneResults, comparisons])

  if (zoneResults.length === 0) {
    return (
      <div style={{ color: '#444', fontSize: 12, padding: '12px 0', textAlign: 'center' }}>
        DRS 활성 구간 없음 (이 랩에서 DRS를 사용하지 않았거나 해당 서킷에 DRS 존이 없음)
      </div>
    )
  }

  return (
    <div>
      <div style={{ fontSize: 11, color: '#555', marginBottom: 4, paddingLeft: 2 }}>
        막대: 구간 최고속도 · 점선: DRS 활성화 시 속도 이득 (낮을수록 이미 고속에서 활성화됨)
      </div>
      <ReactECharts option={option} style={{ height: 240 }} notMerge />
    </div>
  )
}
