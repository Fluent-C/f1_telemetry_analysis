import { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import type { Lap } from '../types/f1'

interface Props {
  lapA:   Lap | null
  lapB:   Lap | null
  colorA: string   // 팀 컬러 hex (# 없음)
  colorB: string
  codeA:  string
  codeB:  string
}

function msToSec(ms: number | null): number | null {
  return ms == null ? null : ms / 1000
}

export function SectorDeltaChart({ lapA, lapB, colorA, colorB, codeA, codeB }: Props) {
  const option = useMemo(() => {
    if (!lapA || !lapB) return {}

    const sectors = ['S1', 'S2', 'S3']
    const keysA = [lapA.sector1_ms, lapA.sector2_ms, lapA.sector3_ms]
    const keysB = [lapB.sector1_ms, lapB.sector2_ms, lapB.sector3_ms]

    // 각 섹터별 델타 (A - B, 양수면 A가 느림)
    const deltaData = sectors.map((_, i) => {
      const a = keysA[i]
      const b = keysB[i]
      if (a == null || b == null) return null
      return parseFloat(((a - b) / 1000).toFixed(3))
    })

    // 막대 색상: delta > 0이면 B가 빠름(B 색), delta < 0이면 A가 빠름(A 색)
    const barData = deltaData.map(d => {
      if (d == null) return { value: null, itemStyle: { color: '#444' } }
      return {
        value: d,
        itemStyle: { color: d <= 0 ? `#${colorA}` : `#${colorB}` },
      }
    })

    // 스피드 트랩 비교용 부가 정보 (툴팁)
    const speedTraps = [
      { label: 'SpeedI1', a: lapA.speed_i1, b: lapB.speed_i1 },
      { label: 'SpeedI2', a: lapA.speed_i2, b: lapB.speed_i2 },
      { label: 'SpeedFL', a: lapA.speed_fl, b: lapB.speed_fl },
      { label: 'SpeedST', a: lapA.speed_st, b: lapB.speed_st },
    ]

    return {
      backgroundColor: '#0d0d0d',
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#1a1a1a',
        borderColor: '#333',
        textStyle: { color: '#ccc', fontSize: 12 },
        formatter: (params: any[]) => {
          const i = params[0].dataIndex
          const d = deltaData[i]
          if (d == null) return `${sectors[i]}: 데이터 없음`
          const faster = d <= 0 ? codeA : codeB
          const sp = speedTraps[i]
          let tip = `<b>${sectors[i]}</b><br/>`
          tip += `${codeA}: ${msToSec(keysA[i])?.toFixed(3) ?? '-'}s<br/>`
          tip += `${codeB}: ${msToSec(keysB[i])?.toFixed(3) ?? '-'}s<br/>`
          tip += `Delta: <b style="color:${d <= 0 ? '#' + colorA : '#' + colorB}">${d > 0 ? '+' : ''}${d.toFixed(3)}s</b>`
          tip += ` (${faster} faster)`
          if (sp.a != null && sp.b != null) {
            tip += `<br/>${sp.label}: ${codeA} ${sp.a.toFixed(0)} / ${codeB} ${sp.b.toFixed(0)} km/h`
          }
          return tip
        },
      },
      grid: { left: 48, right: 16, top: 32, bottom: 40 },
      xAxis: {
        type: 'category',
        data: sectors,
        axisLabel: { color: '#999', fontSize: 12 },
        axisLine: { lineStyle: { color: '#333' } },
      },
      yAxis: {
        type: 'value',
        name: 'Delta (s)',
        nameTextStyle: { color: '#666', fontSize: 10 },
        axisLabel: {
          color: '#999',
          fontSize: 10,
          formatter: (v: number) => (v > 0 ? `+${v.toFixed(2)}` : v.toFixed(2)),
        },
        splitLine: { lineStyle: { color: '#1e1e1e' } },
      },
      series: [
        {
          type: 'bar',
          data: barData,
          barMaxWidth: 60,
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: '#555', type: 'dashed', width: 1 },
            data: [{ yAxis: 0 }],
          },
          label: {
            show: true,
            position: (params: any) => params.value >= 0 ? 'top' : 'bottom',
            color: '#aaa',
            fontSize: 11,
            formatter: (params: any) => {
              const v = params.value
              if (v == null) return ''
              return v > 0 ? `+${v.toFixed(3)}` : v.toFixed(3)
            },
          },
        },
      ],
    }
  }, [lapA, lapB, colorA, colorB, codeA, codeB])

  if (!lapA || !lapB) return null

  const hasAnySector =
    lapA.sector1_ms != null || lapA.sector2_ms != null || lapA.sector3_ms != null

  if (!hasAnySector) {
    return (
      <div style={{ color: '#666', fontSize: 12, padding: '12px 0', textAlign: 'center' }}>
        섹터 타임 데이터 없음 (FP 세션 일부 미제공)
      </div>
    )
  }

  return (
    <div style={{ width: '100%' }}>
      <div style={{ color: '#888', fontSize: 11, marginBottom: 4 }}>
        Sector Delta — {codeA} vs {codeB}
        <span style={{ marginLeft: 12, color: `#${colorA}` }}>■ {codeA} faster</span>
        <span style={{ marginLeft: 8,  color: `#${colorB}` }}>■ {codeB} faster</span>
      </div>
      <ReactECharts
        option={option}
        style={{ height: '180px', width: '100%' }}
        opts={{ renderer: 'canvas' }}
        notMerge
      />
    </div>
  )
}
