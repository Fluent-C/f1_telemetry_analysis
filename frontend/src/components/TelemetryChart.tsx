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
import type { DriverTelemetry, RaceControlMessage } from '../types/f1'

interface Props {
  comparisons:      DriverTelemetry[]
  isDashedB?:       boolean
  raceControlMsgs?: RaceControlMessage[]
  onHover?:         (timeMs: number | null) => void
}

// 패널 레이아웃 (top%, height% 는 전체 차트 영역 기준)
const PANELS = [
  { key: 'speed',    label: 'Speed (km/h)',  top: '4%',  height: '19%', min: 0,   max: undefined },
  { key: 'throttle', label: 'Throttle (%)',  top: '28%', height: '15%', min: 0,   max: 100 },
  { key: 'brake',    label: 'Brake',         top: '48%', height: '15%', min: 0,   max: 1 },
  { key: 'gear',     label: 'Gear',          top: '68%', height: '15%', min: 1,   max: 8 },
] as const

type PanelKey = typeof PANELS[number]['key']

/** DRS=2(활성) 구간의 [startMs, endMs] 배열 추출 */
function extractDrsZones(comparisons: DriverTelemetry[]): [number, number][] {
  if (comparisons.length === 0) return []
  const d = comparisons[0].data
  const zones: [number, number][] = []
  let start: number | null = null
  for (let i = 0; i < d.time_ms.length; i++) {
    const active = d.drs?.[i] === 2
    if (active && start === null) {
      start = d.time_ms[i]
    } else if (!active && start !== null) {
      zones.push([start, d.time_ms[i - 1]])
      start = null
    }
  }
  if (start !== null) zones.push([start, d.time_ms[d.time_ms.length - 1]])
  return zones
}

/**
 * 트레일 브레이킹 구간 추출 — brake=1 AND throttle > 5 인 연속 구간
 * 각 드라이버별로 계산하여 [driverIdx, startMs, endMs] 반환
 */
function extractTrailBrakingZones(comparisons: DriverTelemetry[]): [number, number, number][] {
  const result: [number, number, number][] = []
  comparisons.forEach((comp, driverIdx) => {
    const d = comp.data
    let start: number | null = null
    for (let i = 0; i < d.time_ms.length; i++) {
      const brake    = d.brake?.[i]
      const throttle = d.throttle?.[i] as number | null
      // brake 활성(true 또는 1) AND throttle>5%: 동시 입력 = 트레일 브레이킹
      const isTrail = !!brake && (throttle != null && throttle > 5)
      if (isTrail && start === null) {
        start = d.time_ms[i]
      } else if (!isTrail && start !== null) {
        // 최소 50ms 이상 지속된 구간만 (노이즈 제거)
        if (d.time_ms[i - 1] - start >= 50) {
          result.push([driverIdx, start, d.time_ms[i - 1]])
        }
        start = null
      }
    }
    if (start !== null) result.push([driverIdx, start, d.time_ms[d.time_ms.length - 1]])
  })
  return result
}

/** SC/VSC 구간의 [startMs, endMs, label] 추출 (time_ms 기반) */
function extractScZones(msgs: RaceControlMessage[]): [number, number, string][] {
  const zones: [number, number, string][] = []
  let start: number | null = null
  let label = ''
  for (const m of msgs) {
    if (m.time_ms == null) continue
    const flag = (m.flag ?? '').toUpperCase()
    if ((flag.includes('SAFETY CAR') || flag.includes('VIRTUAL SAFETY CAR')) && start === null) {
      start = m.time_ms
      label = flag.includes('VIRTUAL') ? 'VSC' : 'SC'
    } else if ((flag === 'GREEN' || flag === 'CLEAR') && start !== null) {
      zones.push([start, m.time_ms, label])
      start = null
    }
  }
  return zones
}

function buildSeries(
  comparisons: DriverTelemetry[],
  panelIndex: number,
  key: PanelKey,
  isDashedB: boolean,
  drsZones: [number, number][],
  scZones: [number, number, string][],
  trailZones: [number, number, number][],  // [driverIdx, startMs, endMs]
) {
  const isBrake = key === 'brake'
  return comparisons.map((comp, driverIdx) => {
    const color     = `#${comp.team_color}`
    const lineType  = ((driverIdx === 1 && isDashedB) ? 'dashed' : 'solid') as 'dashed' | 'solid'

    // 첫 번째 드라이버에만 markArea 추가 (DRS: Speed만, SC/VSC: 전 패널)
    const areas: [{ xAxis: number; itemStyle: { color: string } }, { xAxis: number }][] = []

    if (driverIdx === 0) {
      // DRS 구간 — Speed 패널만
      if (key === 'speed') {
        for (const [s, e] of drsZones) {
          areas.push([
            { xAxis: s, itemStyle: { color: 'rgba(46, 204, 113, 0.08)' } },
            { xAxis: e },
          ])
        }
      }
      // SC/VSC 구간 — 전체 패널
      for (const [s, e, label] of scZones) {
        const c = label === 'SC' ? 'rgba(241, 196, 15, 0.10)' : 'rgba(243, 156, 18, 0.08)'
        areas.push([
          { xAxis: s, itemStyle: { color: c } },
          { xAxis: e },
        ])
      }
      // 트레일 브레이킹 구간 — Brake·Throttle 패널에 해당 드라이버 보라 밴드
      if (key === 'brake' || key === 'throttle') {
        for (const [di, s, e] of trailZones) {
          if (di === driverIdx) {
            areas.push([
              { xAxis: s, itemStyle: { color: 'rgba(155, 89, 182, 0.18)' } },
              { xAxis: e },
            ])
          }
        }
      }
    }

    const markArea = areas.length > 0 ? { silent: true, data: areas } : undefined

    return {
      name:        `${comp.driver_code}-${key}`,
      type:        'line' as const,
      xAxisIndex:  panelIndex,
      yAxisIndex:  panelIndex,
      symbol:      'none',
      ...(isBrake ? {
        step:      'end' as const,
        lineStyle: { width: 1, color, type: lineType },
        areaStyle: { color, opacity: 0.35 },
      } : {
        lineStyle: { width: 1.5, color, type: lineType },
      }),
      itemStyle:   { color },
      ...(markArea ? { markArea } : {}),
      // brake는 boolean → 0/1로 변환
      data: comp.data.time_ms.map((t, i) => {
        const raw = (comp.data[key] as (number | boolean | null)[])[i]
        const val = raw === true ? 1 : raw === false ? 0 : (raw ?? null)
        return [t, val]
      }),
      large:      true,
      largeThreshold: 500,
    }
  })
}

export function TelemetryChart({ comparisons, isDashedB = false, raceControlMsgs = [], onHover }: Props) {
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
        const p = params as Array<{ axisValue: number }>
        if (!p.length) return ''
        const hoverMs = p[0].axisValue
        const t = (hoverMs / 1000).toFixed(2)

        // params 의존 대신 각 드라이버 time_ms에서 직접 가장 가까운 인덱스 탐색
        const findIdx = (arr: number[], target: number) => {
          let lo = 0, hi = arr.length - 1
          while (lo < hi) {
            const mid = (lo + hi) >> 1
            if (arr[mid] < target) lo = mid + 1
            else hi = mid
          }
          return lo
        }

        const METRICS = [
          { key: 'speed'    as const, label: 'Speed',    unit: 'km/h' },
          { key: 'throttle' as const, label: 'Throttle', unit: '%'    },
          { key: 'brake'    as const, label: 'Brake',    unit: ''     },
          { key: 'gear'     as const, label: 'Gear',     unit: ''     },
        ]

        // 드라이버별 가장 가까운 값 미리 수집
        const driverRows = comparisons.map(comp => {
          const idx = findIdx(comp.data.time_ms, hoverMs)
          const raw = (key: typeof METRICS[number]['key']) => {
            const v = (comp.data[key] as (number | boolean | null)[])?.[idx]
            if (v == null) return null
            if (v === true) return 1
            if (v === false) return 0
            return v as number
          }
          return { code: comp.driver_code, color: `#${comp.team_color}`, raw }
        })

        // 메트릭별 행: "Speed  VER 295.0 km/h  NOR 288.5 km/h"
        const rows = METRICS.map(({ key, label, unit }) => {
          const cells = driverRows.map(d => {
            const v = d.raw(key)
            const display = v == null ? '—'
              : key === 'gear' ? String(Math.round(v))
              : v.toFixed(1)
            return `<span style="color:${d.color}">${d.code}: <b>${display}</b>${unit ? ' ' + unit : ''}</span>`
          }).join('&nbsp;&nbsp;')
          return `<span style="color:#555;font-size:10px">${label}</span>&nbsp;&nbsp;${cells}`
        }).join('<br/>')

        return `<div style="font-size:11px;line-height:1.7"><b style="color:#aaa">${t}s</b><br/>${rows}</div>`
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
      nameTextStyle: { color: '#777', fontSize: 10, padding: [0, 0, 0, 45] },
      min:       p.min,
      max:       p.max,
      ...(p.key === 'gear' ? { interval: 1 } : {}),
      axisLine:  { show: false },
      axisTick:  { show: false },
      axisLabel: { color: '#999', fontSize: 10 },
      splitLine: { lineStyle: { color: '#1e1e1e' } },
    })),

    // ── 시리즈 ───────────────────────────────────────────
    series: (() => {
      const drsZones   = extractDrsZones(comparisons)
      const scZones    = extractScZones(raceControlMsgs)
      const trailZones = extractTrailBrakingZones(comparisons)
      return PANELS.flatMap((p, i) => buildSeries(comparisons, i, p.key, isDashedB, drsZones, scZones, trailZones))
    })(),

    dataZoom: [
      { type: 'inside', xAxisIndex: [0, 1, 2, 3], filterMode: 'none' },
    ],
  }

  return (
    <ReactECharts
      option={option}
      style={{ height: '600px', width: '100%' }}
      opts={{ renderer: 'canvas' }}
      onEvents={{
        updateAxisPointer: (e: any) => {
          const xInfo = e.axesInfo?.[0]
          if (xInfo && xInfo.value !== undefined) {
            onHover?.(xInfo.value)
          } else {
            onHover?.(null)
          }
        },
        globalout: () => {
          onHover?.(null)
        }
      }}
      notMerge
    />
  )
}
