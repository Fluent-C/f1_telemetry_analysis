import { useQuery } from '@tanstack/react-query'
import { fetchTelemetry } from '../api/f1Client'

export function useTelemetry(
  sessionId: number | null,
  drivers: [string | null, string | null],
  laps:    [number | null, number | null],
) {
  const ready =
    sessionId !== null &&
    drivers[0] !== null && drivers[1] !== null &&
    laps[0]    !== null && laps[1]    !== null

  return useQuery({
    queryKey: ['telemetry', sessionId, drivers, laps],
    queryFn:  () =>
      fetchTelemetry(
        sessionId!,
        [drivers[0]!, drivers[1]!],
        [laps[0]!,    laps[1]!],
      ),
    enabled: ready,
  })
}
