import { useQuery } from '@tanstack/react-query'
import { fetchLaps } from '../api/f1Client'

export function useLaps(sessionId: number | null, driverCode: string | null) {
  return useQuery({
    queryKey: ['laps', sessionId, driverCode],
    queryFn:  () => fetchLaps(sessionId!, driverCode!),
    enabled:  sessionId !== null && driverCode !== null,
  })
}

/** 유효한 랩 중 최속 랩 번호를 반환한다. */
export function fastestLap(laps: import('../types/f1').Lap[] | undefined): number | null {
  if (!laps || laps.length === 0) return null
  const valid = laps.filter(l => l.lap_time_ms !== null && !l.deleted)
  if (valid.length === 0) return null
  return valid.reduce((a, b) => a.lap_time_ms! < b.lap_time_ms! ? a : b).lap_number
}
