import { useState, useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import 'echarts-gl'
import type { DriverTelemetry } from '../types/f1'

interface Props {
  comparisons: DriverTelemetry[]
  hoverTimeMs: number | null
  isDashedB?:  boolean
}

// 고도(elevation) 컬러 팔레트 — 낮음(파랑) → 중간(초록) → 높음(빨강)
const ELEV_COLORS = [
  '#2b83ba', '#abdda4', '#ffffbf', '#fdae61', '#d7191c',
]

export function TrackMap({ comparisons, hoverTimeMs, isDashedB = false }: Props) {
  const [zScale,   setZScale]   = useState(3.0)
  const [alpha,    setAlpha]    = useState(45)   // 부감 각도 (0=수평, 90=정면부감)
  const [beta,     setBeta]     = useState(15)   // 수평 회전
  const [distance, setDistance] = useState(200)  // 카메라 거리

  const refData = comparisons[0]?.data

  // ── 이진탐색 헬퍼 ────────────────────────────────
  const findClosest = (arr: number[], target: number) => {
    let lo = 0, hi = arr.length - 1
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (arr[mid] < target) lo = mid + 1
      else hi = mid
    }
    return lo
  }

  // ── 트랙 정적 데이터 ─────────────────────────────
  const { trackScatter3D, trackLine2D, minZ, maxZ, bounds } = useMemo(() => {
    const empty = {
      trackScatter3D: [] as [number, number, number, number][],
      trackLine2D:    [] as [number, number][],
      minZ: 0, maxZ: 1,
      bounds: { minX: 0, maxX: 1, minY: 0, maxY: 1 },
    }
    if (!refData?.x || refData.x.length === 0) return empty

    const trackScatter3D: [number, number, number, number][] = []
    const trackLine2D:    [number, number][] = []
    const zVals: number[] = []
    let minX = Infinity, maxX = -Infinity
    let minY = Infinity, maxY = -Infinity

    for (let i = 0; i < refData.x.length; i++) {
      const x = refData.x[i]; const y = refData.y[i]; const z = refData.z?.[i] ?? 0
      if (x != null && y != null) {
        trackScatter3D.push([x, y, z * zScale, z])  // 4번째 = raw Z (컬러링용)
        trackLine2D.push([x, y])
        if (refData.z?.[i] != null) zVals.push(z)
        minX = Math.min(minX, x); maxX = Math.max(maxX, x)
        minY = Math.min(minY, y); maxY = Math.max(maxY, y)
      }
    }

    const minZ = zVals.length > 0 ? Math.min(...zVals) : 0
    const maxZ = zVals.length > 0 ? Math.max(...zVals) : 1
    return { trackScatter3D, trackLine2D, minZ, maxZ, bounds: { minX, maxX, minY, maxY } }
  }, [comparisons, zScale])

  // ── 드라이버 현재 위치 (hover 또는 중간 지점) ────────
  const activePoints3D = useMemo(() => {
    const res: { value: [number, number, number]; itemStyle: { color: string }; symbol?: string }[] = []
    comparisons.forEach((comp, driverIdx) => {
      const d = comp.data
      if (!d.x || !d.y || d.x.length === 0) return
      const base = hoverTimeMs !== null
        ? findClosest(d.time_ms, hoverTimeMs)
        : Math.floor(d.time_ms.length / 2)
      let idx = base
      for (let dt = 0; dt < d.x.length; dt++) {
        const f = (base + dt) % d.x.length
        if (d.x[f] != null && d.y[f] != null) { idx = f; break }
        const b = (base - dt + d.x.length) % d.x.length
        if (d.x[b] != null && d.y[b] != null) { idx = b; break }
      }
      const x = d.x[idx]; const y = d.y[idx]; const z = d.z?.[idx] ?? 0
      if (x != null && y != null)
        res.push({
          value: [x, y, z * zScale],
          itemStyle: { color: `#${comp.team_color}` },
          ...(isDashedB && driverIdx === 1 ? { symbol: 'diamond' } : {}),
        })
    })
    return res
  }, [comparisons, hoverTimeMs, zScale, isDashedB])

  const activePoints2D = useMemo(() => {
    const res: { value: [number, number]; name: string; itemStyle: { color: string }; symbol?: string }[] = []
    comparisons.forEach((comp, driverIdx) => {
      const d = comp.data
      if (!d.x || !d.y || d.x.length === 0) return
      const base = hoverTimeMs !== null
        ? findClosest(d.time_ms, hoverTimeMs)
        : Math.floor(d.time_ms.length / 2)
      let idx = base
      for (let dt = 0; dt < d.x.length; dt++) {
        const f = (base + dt) % d.x.length
        if (d.x[f] != null && d.y[f] != null) { idx = f; break }
        const b = (base - dt + d.x.length) % d.x.length
        if (d.x[b] != null && d.y[b] != null) { idx = b; break }
      }
      const x = d.x[idx]; const y = d.y[idx]
      if (x != null && y != null)
        res.push({
          value: [x, y],
          name: comp.driver_code,
          itemStyle: { color: `#${comp.team_color}` },
          ...(isDashedB && driverIdx === 1 ? { symbol: 'diamond' } : {}),
        })
    })
    return res
  }, [comparisons, hoverTimeMs, isDashedB])

  // ── 3D 옵션 ──────────────────────────────────────
  const option3D = useMemo(() => {
    if (trackScatter3D.length === 0) return {}
    const xRange = bounds.maxX - bounds.minX
    const yRange = bounds.maxY - bounds.minY
    const boxDepth = Math.min(100, Math.round((yRange / xRange) * 100))

    return {
      backgroundColor: '#0d0d0d',
      visualMap: {
        show: false,   // HTML 범례 사용 → echarts 범례 숨김
        min: minZ,
        max: maxZ,
        dimension: 3,  // 데이터 4번째 값(raw Z) 으로 컬러링
        seriesIndex: 0,
        inRange: { color: ELEV_COLORS },
      },
      grid3D: {
        boxWidth:  100,
        boxDepth,
        boxHeight: 20,
        viewControl: {
          projection: 'perspective',
          autoRotate: false,
          distance,
          alpha,
          beta,
        },
        axisLine:    { lineStyle: { color: '#1e1e1e' } },
        splitLine:   { lineStyle: { color: '#181818' } },
        axisPointer: { show: false },
        environment: '#0d0d0d',
      },
      xAxis3D: { type: 'value', show: false, min: bounds.minX, max: bounds.maxX },
      yAxis3D: { type: 'value', show: false, min: bounds.minY, max: bounds.maxY },
      zAxis3D: { type: 'value', show: false },
      series: [
        {
          type: 'scatter3D',
          data: trackScatter3D,
          symbolSize: 3,
          itemStyle: { opacity: 0.9 },
          animation: false,
        } as any,
        {
          type: 'scatter3D',
          data: activePoints3D,
          symbolSize: 14,
          itemStyle: { borderWidth: 2, borderColor: '#fff', opacity: 1 },
          animation: false,
        } as any,
      ],
    }
  }, [trackScatter3D, activePoints3D, bounds, minZ, maxZ, alpha, beta, distance])

  // ── 2D 옵션 ──────────────────────────────────────────
  const option2D = useMemo(() => {
    if (trackLine2D.length === 0) return {}
    return {
      backgroundColor: '#0d0d0d',
      tooltip: { show: false },
      xAxis: { type: 'value', show: false, min: bounds.minX, max: bounds.maxX, scale: true },
      yAxis: { type: 'value', show: false, min: bounds.minY, max: bounds.maxY, scale: true },
      grid: { left: 10, right: 10, top: 10, bottom: 10 },
      series: [
        {
          type: 'line',
          data: trackLine2D,
          lineStyle: { color: '#444', width: 2 },
          symbol: 'none',
          animation: false,
        },
        {
          type: 'effectScatter',
          data: activePoints2D,
          symbolSize: 12,
          itemStyle: { borderWidth: 2, borderColor: '#fff' },
          rippleEffect: { brushType: 'stroke', scale: 3 },
          label: {
            show: true,
            position: 'top',
            formatter: (p: any) => p.name,
            color: '#fff',
            fontSize: 10,
            fontWeight: 'bold',
            textShadowColor: '#000',
            textShadowBlur: 3,
          },
          animation: false,
        },
      ],
    }
  }, [trackLine2D, activePoints2D, bounds])

  if (comparisons.length === 0) return null

  const elevRange = maxZ - minZ

  return (
    <div style={{ width: '100%', backgroundColor: '#0d0d0d', border: '1px solid #333' }}>

      {/* 컨트롤 바 */}
      <div style={{
        display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '16px',
        padding: '6px 12px', borderBottom: '1px solid #222',
        color: '#777', fontSize: '11px',
      }}>
        {/* Z Scale */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span>Z&nbsp;Scale&nbsp;{zScale.toFixed(1)}x</span>
          <input type="range" min="0.5" max="20" step="0.5" value={zScale}
            onChange={e => setZScale(parseFloat(e.target.value))}
            style={{ width: 80 }} />
        </label>

        {/* Elevation angle */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span>Angle&nbsp;{alpha}°</span>
          <input type="range" min="5" max="85" step="5" value={alpha}
            onChange={e => setAlpha(parseInt(e.target.value))}
            style={{ width: 80 }} />
        </label>

        {/* Rotation */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span>Rotation&nbsp;{beta}°</span>
          <input type="range" min="-180" max="180" step="5" value={beta}
            onChange={e => setBeta(parseInt(e.target.value))}
            style={{ width: 80 }} />
        </label>

        {/* Distance */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span>Zoom&nbsp;{distance}</span>
          <input type="range" min="80" max="400" step="10" value={distance}
            onChange={e => setDistance(parseInt(e.target.value))}
            style={{ width: 80 }} />
        </label>

        {/* Elevation 범례 (HTML 그라디언트) */}
        {elevRange > 0.1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
            <span style={{ color: '#444' }}>Elev:</span>
            <span style={{ color: '#555', fontSize: 10 }}>{Math.round(minZ)}m</span>
            <div style={{
              width: 80, height: 8, borderRadius: 3,
              background: `linear-gradient(to right, ${ELEV_COLORS.join(',')})`,
            }} />
            <span style={{ color: '#555', fontSize: 10 }}>{Math.round(maxZ)}m</span>
          </div>
        )}
        {elevRange <= 0.1 && (
          <span style={{ marginLeft: 'auto', color: '#444', fontSize: 10 }}>
            Elevation data unavailable
          </span>
        )}
      </div>

      {/* 두 컬럼 */}
      <div style={{ display: 'flex', height: '340px' }}>
        {/* 3D */}
        <div style={{ flex: 1, position: 'relative', borderRight: '1px solid #222' }}>
          <span style={{
            position: 'absolute', top: 6, left: 10, zIndex: 10,
            color: '#333', fontSize: '10px', pointerEvents: 'none',
          }}>3D</span>
          <ReactECharts

            option={option3D}
            style={{ height: '100%', width: '100%' }}
            opts={{ renderer: 'canvas' }}
            notMerge
          />
        </div>

        {/* 2D */}
        <div style={{ flex: 1, position: 'relative' }}>
          <span style={{
            position: 'absolute', top: 6, left: 10, zIndex: 10,
            color: '#333', fontSize: '10px', pointerEvents: 'none',
          }}>2D</span>
          <ReactECharts
            option={option2D}
            style={{ height: '100%', width: '100%' }}
            opts={{ renderer: 'canvas' }}
            notMerge
          />
        </div>
      </div>
    </div>
  )
}
