/**
 * TelemetryChart.tsx
 *
 * 단일 ECharts 인스턴스에 4개 grid를 구성 → axisPointer 자동 동기화.
 *
 * [중요] ECharts + React 18 Strict Mode 주의사항:
 *   이벤트 핸들러는 onEvents prop 으로 전달한다.
 *   useEffect 내 chartRef.current.on() 은 Strict Mode 이중 마운트로
 *   핸들러가 중복 등록되므로 사용하지 않는다.
 */

import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import type { DriverTelemetry } from '../types/f1'

interface Props {
  comparisons: DriverTelemetry[]
}

// 패널 레이아웃 (top%, height% 는 전체 차트 영역 기준)
const PANELS = [
  { key: 'speed',    label: 'Speed (km/h)',  top: '4%',  height: '19%', min: 0,   max: undefined },
  { key: 'throttle', label: 'Throttle (%)',  top: '28%', height: '15%', min: 0,   max: 100 },
  { key: 'brake',    label: 'Brake',         top: '48%', height: '15%', min: 0,   max: 1 },
  { key: 'gear',     label: 'Gear',          top: '68%', height: '15%', min: 1,   max: 8 },
] as const

type PanelKey = typeof PANELS[number]['key']

function buildSeries(
  comparisons: DriverTelemetry[],
  panelIndex: number,
  key: PanelKey,
) {
  return comparisons.map(comp => ({
    name:        `${comp.driver_code}-${key}`,
    type:        'line' as const,
    xAxisIndex:  panelIndex,
    yAxisIndex:  panelIndex,
    symbol:      'none',
    lineStyle:   { width: 1.5, color: `#${comp.team_color}` },
    itemStyle:   { color: `#${comp.team_color}` },
    // brake는 boolean → 0/1로 변환
    data: comp.data.time_ms.map((t, i) => {
      const raw = (comp.data[key] as (number | boolean | null)[])[i]
      const val = raw === true ? 1 : raw === false ? 0 : (raw ?? null)
      return [t, val]
    }),
    large:      true,
    largeThreshold: 500,
  }))
}

export function TelemetryChart({ comparisons }: Props) {
  if (comparisons.length === 0) return null

  const option: EChartsOption = {
    backgroundColor: '#0d0d0d',
    animation: false,

    // ── 크로스헤어: 모든 X축 연결 ──────────────────────────
    axisPointer: {
      link: [{ xAxisIndex: 'all' }],
      label: { backgroundColor: '#1a1a1a' },
    },

    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      backgroundColor: '#1a1a1a',
      borderColor: '#333',
      textStyle: { color: '#ccc', fontSize: 11 },
      formatter: (params: unknown) => {
        const p = params as Array<{ axisValue: number; seriesName: string; value: [number, number] }>
        if (!p.length) return ''
        const t = (p[0].axisValue / 1000).toFixed(2)
        const lines = p
          .filter(x => x.value?.[1] !== null)
          .map(x => {
            const [driver] = x.seriesName.split('-')
            return `<b style="color:${getDriverColor(comparisons, driver)}">${driver}</b>: ${x.value[1]?.toFixed?.(1) ?? x.value[1]}`
          })
        return `<div style="font-size:11px">${t}s<br/>${lines.join('<br/>')}</div>`
      },
    },

    legend: {
      top: 0,
      textStyle: { color: '#aaa' },
      data: comparisons.map(c => ({
        name: c.driver_code,
        itemStyle: { color: `#${c.team_color}` },
      })),
    },

    // ── 4개 grid ─────────────────────────────────────────
    grid: PANELS.map(p => ({
      left: 65, right: 20,
      top: p.top, height: p.height,
    })),

    xAxis: PANELS.map((_, i) => ({
      gridIndex: i,
      type:      'value' as const,
      axisLine:  { lineStyle: { color: '#333' } },
      axisLabel: {
        show: i === PANELS.length - 1,
        color: '#666',
        formatter: (v: number) => `${(v / 1000).toFixed(0)}s`,
      },
      splitLine: { lineStyle: { color: '#1e1e1e' } },
    })),

    yAxis: PANELS.map((p, i) => ({
      gridIndex: i,
      type:      'value' as const,
      name:      p.label,
      nameTextStyle: { color: '#666', fontSize: 10, padding: [0, 0, 0, 45] },
      min:       p.min,
      max:       p.max,
      axisLine:  { show: false },
      axisTick:  { show: false },
      axisLabel: { color: '#666', fontSize: 10 },
      splitLine: { lineStyle: { color: '#1e1e1e' } },
    })),

    // ── 시리즈 ───────────────────────────────────────────
    series: PANELS.flatMap((p, i) => buildSeries(comparisons, i, p.key)),

    dataZoom: [
      { type: 'inside', xAxisIndex: [0, 1, 2, 3], filterMode: 'none' },
    ],
  }

  return (
    <ReactECharts
      option={option}
      style={{ height: '600px', width: '100%' }}
      opts={{ renderer: 'canvas' }}
      notMerge
    />
  )
}

function getDriverColor(comparisons: DriverTelemetry[], code: string): string {
  return `#${comparisons.find(c => c.driver_code === code)?.team_color ?? 'ffffff'}`
}
