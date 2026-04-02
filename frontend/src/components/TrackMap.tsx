import { useState, useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import 'echarts-gl'  // 3D 지원
import type { EChartsOption } from 'echarts'
import type { DriverTelemetry } from '../types/f1'

interface Props {
  comparisons: DriverTelemetry[]
  hoverTimeMs: number | null
}

export function TrackMap({ comparisons, hoverTimeMs }: Props) {
  const [is3D, setIs3D] = useState(true)
  const [zScale, setZScale] = useState(1.0) // 기본값 1.0 (과장 없음)

  // 기본 트랙 레이아웃을 그리기 위한 기준 드라이버 (가장 첫 번째 드라이버 데이터 사용)
  const refData = comparisons[0]?.data

  // hoverTimeMs 에 가장 가까운 인덱스 찾기 함수
  const findClosestIndex = (timeArray: number[], targetMs: number) => {
    let closestIndex = 0
    let minDiff = Infinity
    for (let i = 0; i < timeArray.length; i++) {
      const diff = Math.abs(timeArray[i] - targetMs)
      if (diff < minDiff) {
        minDiff = diff
        closestIndex = i
      }
    }
    return closestIndex
  }

  const option = useMemo<EChartsOption>(() => {
    if (!refData || !refData.x || refData.x.length === 0) return {}

    // 트랙 전체 라인 위치 (안전을 위해 null 제거)
    const trackLine3D = []
    const trackLine2D = []
    
    // min/max for proper scaling
    let minX = Infinity, maxX = -Infinity
    let minY = Infinity, maxY = -Infinity

    for (let i = 0; i < refData.x.length; i++) {
      const x = refData.x[i]
      const y = refData.y[i]
      const z = refData.z?.[i] ?? 0
      
      if (x != null && y != null) {
        trackLine3D.push([x, y, z * zScale])
        trackLine2D.push([x, y])
        minX = Math.min(minX, x)
        maxX = Math.max(maxX, x)
        minY = Math.min(minY, y)
        maxY = Math.max(maxY, y)
      }
    }

    // 드라이버들의 현재 위치 (hoverTimeMs 기준)
    const activePoints3D = []
    const activePoints2D = []

    if (hoverTimeMs !== null) {
      for (const comp of comparisons) {
        const d = comp.data
        if (!d.x || !d.y) continue
        
        const idx = findClosestIndex(d.time_ms, hoverTimeMs)
        const x = d.x[idx]
        const y = d.y[idx]
        const z = d.z?.[idx] ?? 0

        if (x != null && y != null) {
          activePoints3D.push({
            value: [x, y, z * zScale],
            itemStyle: { color: `#${comp.team_color}` }
          })
          activePoints2D.push({
            value: [x, y],
            itemStyle: { color: `#${comp.team_color}` }
          })
        }
      }
    }

    // --- 3D Option ---
    if (is3D) {
      return {
        backgroundColor: '#0d0d0d',
        tooltip: { show: false },
        grid3D: {
          viewControl: {
            projection: 'perspective', // 3D 원근 옵션
            autoRotate: false,
            distance: 15000,
          },
          axisLine: { lineStyle: { color: '#333' } },
          axisPointer: { show: false },
        },
        xAxis3D: { type: 'value', show: false, min: minX, max: maxX },
        yAxis3D: { type: 'value', show: false, min: minY, max: maxY },
        zAxis3D: { type: 'value', show: false },
        series: [
          {
            type: 'line3D',
            data: trackLine3D,
            lineStyle: { color: '#555', width: 2, opacity: 0.8 },
            animation: false,
          },
          {
            type: 'scatter3D',
            data: activePoints3D,
            symbolSize: 15,
            itemStyle: {
              borderWidth: 2,
              borderColor: '#fff'
            },
            animation: false // 실시간 동기화를 위해 애니메이션 끔
          }
        ]
      } as any // echarts-gl 타입 추론용
    }

    // --- 2D Option ---
    return {
      backgroundColor: '#0d0d0d',
      tooltip: { show: false },
      xAxis: { type: 'value', show: false, min: minX, max: maxX, scale: true },
      yAxis: { type: 'value', show: false, min: minY, max: maxY, scale: true },
      grid: { left: 10, right: 10, top: 10, bottom: 10 },
      series: [
        {
          type: 'line',
          data: trackLine2D,
          lineStyle: { color: '#555', width: 2 },
          symbol: 'none',
          animation: false,
        },
        {
          type: 'effectScatter', // 반짝이는 마커
          data: activePoints2D,
          symbolSize: 10,
          itemStyle: {
            borderWidth: 2,
            borderColor: '#fff',
          },
          rippleEffect: {
            brushType: 'stroke'
          },
          animation: false,
        }
      ]
    }
  }, [comparisons, hoverTimeMs, is3D, zScale])

  if (comparisons.length === 0) return null

  return (
    <div style={{ position: 'relative', width: '100%', height: '400px', backgroundColor: '#0d0d0d', border: '1px solid #333' }}>
      
      {/* 컨트롤 패널 */}
      <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 10, display: 'flex', gap: '10px', background: 'rgba(0,0,0,0.5)', padding: '5px 10px', borderRadius: '5px' }}>
        <button 
          onClick={() => setIs3D(!is3D)}
          style={{ cursor: 'pointer', background: '#333', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px' }}
        >
          {is3D ? '2D View' : '3D View'}
        </button>

        {is3D && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#ccc', fontSize: '12px' }}>
            <span>Z Scale: {zScale.toFixed(1)}x</span>
            <input 
              type="range" 
              min="0.1" max="10.0" step="0.1" 
              value={zScale} 
              onChange={(e) => setZScale(parseFloat(e.target.value))}
            />
          </div>
        )}
      </div>

      <ReactECharts
        option={option}
        style={{ height: '100%', width: '100%' }}
        opts={{ renderer: 'canvas' }}
        notMerge
      />
    </div>
  )
}
