/**
 * FuelCorrectedChart.tsx  — D-1: 연료 보정 페이스 곡선
 *
 * 랩타임에서 연료 무게 감소 효과(Fuel Burn-off Effect)를 제거하여
 * 순수 타이어 열화율(True Degradation)을 시각화한다.
 *
 * 수식 (PDF 4.2절 기반):
 *   fuel_weight_remaining[lap] = total_fuel - lap × fuel_per_lap
 *   correction_ms[lap]         = fuel_weight_remaining[lap] × lap_time_per_kg_ms
 *   fuel_corrected_ms[lap]     = lap_time_ms[lap] + correction_ms[lap]
 *   (연료가 줄어들수록 correction이 줄어들어, 보정 랩타임이 순수 열화율을 반영)
 *
 * 파라미터 기본값 (조정 가능):
 *   total_fuel_kg        = 110   (레이스 시작 연료)
 *   fuel_per_lap_kg      = 1.8   (랩당 소모량 — 레이스 거리/속도에 따라 1.5~2.5)
 *   lap_time_per_kg_ms   = 80    (1kg 감량 시 이득 — 0.08s ≈ 80ms)
 *
 * 검증 기준:
 *   - 보정 전: TyreLife 증가 시 랩타임이 오히려 빨라질 수 있음 (연료 효과 때문)
 *   - 보정 후: TyreLife 증가 시 랩타임이 단조 증가해야 함 (순수 열화)
 */

import { useMemo, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import type { Lap } from '../types/f1'

interface Props {
  allLaps:      Lap[]
  driverColors: Record<string, string>  // { VER: 'FF8000', ... }
  sessionType:  string                  // 레이스(R/S)에서만 의미 있음
}

function msToSec(ms: number): string {
  const s = ms / 1000
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(3).padStart(6, '0')}`
}

export function FuelCorrectedChart({ allLaps, driverColors, sessionType }: Props) {
  const [totalFuel,    setTotalFuel]    = useState(110)   // kg
  const [fuelPerLap,   setFuelPerLap]   = useState(1.8)   // kg/lap
  const [lapTimePerKg, setLapTimePerKg] = useState(80)    // ms per kg

  const option = useMemo(() => {
    if (allLaps.length === 0) return {}

    // 드라이버별 그룹핑, 유효한 랩만
    const byDriver: Record<string, Lap[]> = {}
    for (const lap of allLaps) {
      if (lap.lap_time_ms == null || lap.deleted || lap.lap_number == null) continue
      if (!byDriver[lap.driver_code]) byDriver[lap.driver_code] = []
      byDriver[lap.driver_code].push(lap)
    }

    const drivers = Object.keys(byDriver)
    if (drivers.length === 0) return {}

    // 전체 랩 수 (보정 기준)
    const maxLap = Math.max(...allLaps.map(l => l.lap_number ?? 0))

    const series = drivers.flatMap(code => {
      const laps   = byDriver[code].sort((a, b) => a.lap_number! - b.lap_number!)
      const color  = driverColors[code] ? `#${driverColors[code]}` : '#888'
      const isMain = code in driverColors

      // 보정 전
      const rawData = laps.map(l => [l.lap_number, l.lap_time_ms! / 1000])

      // 보정 후: 연료 잔량 × lapTimePerKg 차감
      const corrData = laps.map(l => {
        const lapNum   = l.lap_number!
        const fuelLeft = Math.max(0, totalFuel - lapNum * fuelPerLap)
        const corrMs   = l.lap_time_ms! + fuelLeft * lapTimePerKg
        return [lapNum, corrMs / 1000]
      })

      return [
        {
          name:        `${code} raw`,
          type:        'line' as const,
          data:        rawData,
          symbol:      'none',
          lineStyle:   { color, width: 1, type: 'dashed' as const, opacity: isMain ? 0.5 : 0.2 },
          itemStyle:   { color },
          emphasis:    { disabled: true },
          animation:   false,
        },
        {
          name:        `${code} corrected`,
          type:        'line' as const,
          data:        corrData,
          symbol:      'none',
          lineStyle:   { color, width: isMain ? 2 : 1, opacity: isMain ? 1 : 0.3 },
          itemStyle:   { color },
          emphasis:    { disabled: true },
          animation:   false,
        },
      ]
    })

    return {
      backgroundColor: '#111',
      grid: { top: 32, right: 20, bottom: 40, left: 65 },
      legend: {
        top: 4,
        textStyle: { color: '#666', fontSize: 10 },
        data: drivers.flatMap(c => [`${c} raw`, `${c} corrected`]),
      },
      xAxis: {
        type: 'value',
        name: 'Lap',
        nameLocation: 'middle',
        nameGap: 26,
        min: 1,
        max: maxLap,
        axisLine:  { lineStyle: { color: '#333' } },
        axisTick:  { lineStyle: { color: '#333' } },
        axisLabel: { color: '#666', fontSize: 11 },
        splitLine: { lineStyle: { color: '#1a1a1a' } },
      },
      yAxis: {
        type: 'value',
        name: 'Lap Time (s)',
        nameLocation: 'middle',
        nameGap: 52,
        axisLine:  { lineStyle: { color: '#333' } },
        axisTick:  { lineStyle: { color: '#333' } },
        axisLabel: { color: '#666', fontSize: 10, formatter: (v: number) => msToSec(v * 1000) },
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
            .map(p => {
              const label = p.seriesName.includes('corrected') ? '(corr)' : '(raw)'
              return `<span style="color:${p.color}">${p.seriesName.split(' ')[0]} ${label}: <b>${msToSec(p.data[1] * 1000)}</b></span>`
            }).join('<br/>')
          return `<b style="color:#aaa">Lap ${lap}</b><br/>${lines}`
        },
      },
      series,
    }
  }, [allLaps, driverColors, totalFuel, fuelPerLap, lapTimePerKg])

  if (!['R', 'S'].includes(sessionType)) {
    return (
      <div style={{ color: '#444', fontSize: 12, padding: '12px 0', textAlign: 'center' }}>
        연료 보정 페이스 분석은 레이스·스프린트 세션에서만 사용 가능합니다.
      </div>
    )
  }

  if (allLaps.length === 0 || Object.keys(option).length === 0) {
    return <div style={{ color: '#444', fontSize: 12, padding: '12px 0', textAlign: 'center' }}>데이터 없음</div>
  }

  const sliderStyle: React.CSSProperties = { width: 80 }
  const labelStyle:  React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 5, color: '#666', fontSize: 11 }

  return (
    <div>
      {/* 파라미터 조정 슬라이더 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, padding: '4px 4px 8px', borderBottom: '1px solid #1a1a1a', marginBottom: 4 }}>
        <label style={labelStyle}>
          <span>Total Fuel&nbsp;<b style={{ color: '#aaa' }}>{totalFuel}kg</b></span>
          <input type="range" min="80" max="130" step="5" value={totalFuel}
            onChange={e => setTotalFuel(+e.target.value)} style={sliderStyle} />
        </label>
        <label style={labelStyle}>
          <span>Fuel/Lap&nbsp;<b style={{ color: '#aaa' }}>{fuelPerLap.toFixed(1)}kg</b></span>
          <input type="range" min="1.0" max="3.0" step="0.1" value={fuelPerLap}
            onChange={e => setFuelPerLap(+e.target.value)} style={sliderStyle} />
        </label>
        <label style={labelStyle}>
          <span>Lap gain/kg&nbsp;<b style={{ color: '#aaa' }}>{lapTimePerKg}ms</b></span>
          <input type="range" min="40" max="120" step="5" value={lapTimePerKg}
            onChange={e => setLapTimePerKg(+e.target.value)} style={sliderStyle} />
        </label>
        <span style={{ color: '#444', fontSize: 10, alignSelf: 'center' }}>
          점선 = raw · 실선 = fuel-corrected
        </span>
      </div>
      <ReactECharts option={option} style={{ height: 300 }} notMerge />
    </div>
  )
}
