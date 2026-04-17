import { useState, useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import 'echarts-gl'
import type { DriverTelemetry, CircuitInfo } from '../types/f1'

interface Props {
  comparisons: DriverTelemetry[]
  hoverTimeMs: number | null
  isDashedB?:  boolean
  circuitInfo?: CircuitInfo | null   // 코너 오버레이용
}

// 고도(elevation) 컬러 팔레트 — 낮음(파랑) → 중간(초록) → 높음(빨강)
const ELEV_COLORS = [
  '#2b83ba', '#abdda4', '#ffffbf', '#fdae61', '#d7191c',
]

// 횡가속도(Lateral G) 컬러 팔레트 — 0G(파랑) → 중간(초록) → 높음(빨강)
const G_COLORS = [
  '#313695', '#4575b4', '#74add1', '#abd9e9',
  '#e0f3f8', '#ffffbf', '#fee090', '#fdae61',
  '#f46d43', '#d73027', '#a50026',
]

type ColorMode = 'elevation' | 'lateralG'

/**
 * 횡가속도 근사 산출 (단위: G)
 * lateral_g = v² × κ / 9.81,  κ = |v1 × v2| / (|v1| × |v2| + ε)
 */
function computeLateralG(
  x: (number | null)[],
  y: (number | null)[],
  speed_kmh: (number | null)[],
): number[] {
  const n = x.length
  const g = new Array<number>(n).fill(0)
  const G = 9.81

  for (let i = 1; i < n - 1; i++) {
    const x0 = x[i - 1], x1 = x[i], x2 = x[i + 1]
    const y0 = y[i - 1], y1 = y[i], y2 = y[i + 1]
    const s  = speed_kmh[i]
    if (x0 == null || x1 == null || x2 == null || y0 == null || y1 == null || y2 == null || s == null) continue

    const dx1 = x1 - x0, dy1 = y1 - y0
    const dx2 = x2 - x1, dy2 = y2 - y1
    const cross = Math.abs(dx1 * dy2 - dy1 * dx2)
    const len1  = Math.sqrt(dx1 * dx1 + dy1 * dy1)
    const len2  = Math.sqrt(dx2 * dx2 + dy2 * dy2)
    const kappa = cross / (len1 * len2 + 1e-6)   // curvature ≈ sin(Δθ) / segment_len

    const v_mps = s / 3.6
    g[i] = Math.min((v_mps * v_mps * kappa) / G, 8)  // clamp to 8G
  }
  return g
}

export function TrackMap({ comparisons, hoverTimeMs, isDashedB = false, circuitInfo }: Props) {
  const [zScale,    setZScale]    = useState(3.0)
  const [alpha,     setAlpha]     = useState(45)
  const [beta,      setBeta]      = useState(15)
  const [distance,  setDistance]  = useState(200)
  const [colorMode, setColorMode] = useState<ColorMode>('elevation')

  const refData = comparisons[0]?.data

  // ── 횡가속도 데이터 (D-3) ─────────────────────────
  const lateralGArr = useMemo(() => {
    if (!refData?.x || !refData.y || !refData.speed) return [] as number[]
    return computeLateralG(refData.x, refData.y, refData.speed)
  }, [comparisons])

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
  const { trackScatter3D, trackScatter2D, trackLine2D, minVal, maxVal, bounds } = useMemo(() => {
    const empty = {
      trackScatter3D: [] as [number, number, number, number][],
      trackScatter2D: [] as [number, number, number][],
      trackLine2D:    [] as [number, number][],
      minVal: 0, maxVal: 1,
      bounds: { minX: 0, maxX: 1, minY: 0, maxY: 1 },
    }
    if (!refData?.x || refData.x.length === 0) return empty

    const trackScatter3D: [number, number, number, number][] = []
    const trackScatter2D: [number, number, number][] = []
    const trackLine2D:    [number, number][] = []
    const colorVals: number[] = []
    let minX = Infinity, maxX = -Infinity
    let minY = Infinity, maxY = -Infinity

    for (let i = 0; i < refData.x.length; i++) {
      const x = refData.x[i]; const y = refData.y[i]
      const z = refData.z?.[i] ?? 0
      const colorVal = colorMode === 'lateralG' ? (lateralGArr[i] ?? 0) : z
      if (x != null && y != null) {
        trackScatter3D.push([x, y, z * zScale, colorVal])
        trackScatter2D.push([x, y, colorVal])
        trackLine2D.push([x, y])
        colorVals.push(colorVal)
        minX = Math.min(minX, x); maxX = Math.max(maxX, x)
        minY = Math.min(minY, y); maxY = Math.max(maxY, y)
      }
    }

    const minVal = colorVals.length > 0 ? Math.min(...colorVals) : 0
    const maxVal = colorVals.length > 0 ? Math.max(...colorVals) : 1
    return { trackScatter3D, trackScatter2D, trackLine2D, minVal, maxVal, bounds: { minX, maxX, minY, maxY } }
  }, [comparisons, zScale, colorMode, lateralGArr])

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
        show: false,
        min: minVal,
        max: maxVal,
        dimension: 3,
        seriesIndex: 0,
        inRange: { color: colorMode === 'lateralG' ? G_COLORS : ELEV_COLORS },
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
  }, [trackScatter3D, activePoints3D, bounds, minVal, maxVal, alpha, beta, distance, colorMode])

  // ── 코너 레이블 데이터 ────────────────────────────────
  const cornerPoints = useMemo(() => {
    if (!circuitInfo?.corners?.length) return []
    return circuitInfo.corners.map(c => ({
      value: [c.x, c.y],
      name:  `T${c.number}${c.letter}`,
    }))
  }, [circuitInfo])

  // ── 2D 옵션 ──────────────────────────────────────────
  const option2D = useMemo(() => {
    if (trackLine2D.length === 0) return {}

    const visualMapConfig = colorMode === 'lateralG' ? [{
      show: false,
      min: minVal,
      max: Math.min(maxVal, 5),
      dimension: 0,
      seriesIndex: 0,
      inRange: { color: G_COLORS },
    }] : []

    return {
      backgroundColor: '#0d0d0d',
      tooltip: { show: false },
      visualMap: visualMapConfig.length > 0 ? visualMapConfig[0] : undefined,
      xAxis: { type: 'value', show: false, min: bounds.minX, max: bounds.maxX, scale: true },
      yAxis: { type: 'value', show: false, min: bounds.minY, max: bounds.maxY, scale: true },
      grid: { left: 10, right: 10, top: 10, bottom: 10 },
      series: [
        colorMode === 'lateralG'
          ? {
              type: 'scatter',
              data: trackScatter2D.map(([x, y, g]) => [x, y, g]),
              symbolSize: 4,
              animation: false,
            }
          : {
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
        // 코너 번호 오버레이 (circuitInfo 있을 때만)
        ...(cornerPoints.length > 0 ? [{
          type: 'scatter',
          data: cornerPoints,
          symbolSize: 0,          // 마커 숨김, 레이블만 표시
          label: {
            show: true,
            formatter: (p: any) => p.name,
            color: '#888',
            fontSize: 9,
            textShadowColor: '#000',
            textShadowBlur: 2,
          },
          itemStyle: { opacity: 0 },
          animation: false,
        }] : []),
      ],
    }
  }, [trackLine2D, trackScatter2D, activePoints2D, bounds, cornerPoints, colorMode, minVal, maxVal])

  if (comparisons.length === 0) return null


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

        {/* Color Mode 토글 */}
        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
          {(['elevation', 'lateralG'] as ColorMode[]).map(mode => (
            <button key={mode} onClick={() => setColorMode(mode)} style={{
              background: colorMode === mode ? '#333' : 'none',
              border: '1px solid #333',
              borderRadius: 3,
              color: colorMode === mode ? '#ccc' : '#555',
              fontSize: 10,
              padding: '2px 7px',
              cursor: 'pointer',
            }}>
              {mode === 'elevation' ? 'Elev' : 'Lateral G'}
            </button>
          ))}
        </div>

        {/* 컬러 범례 (HTML 그라디언트) */}
        {(maxVal - minVal) > 0.01 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: '#555', fontSize: 10 }}>
              {colorMode === 'lateralG' ? '0G' : `${Math.round(minVal)}m`}
            </span>
            <div style={{
              width: 80, height: 8, borderRadius: 3,
              background: `linear-gradient(to right, ${(colorMode === 'lateralG' ? G_COLORS : ELEV_COLORS).join(',')})`,
            }} />
            <span style={{ color: '#555', fontSize: 10 }}>
              {colorMode === 'lateralG' ? `${maxVal.toFixed(1)}G` : `${Math.round(maxVal)}m`}
            </span>
          </div>
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
