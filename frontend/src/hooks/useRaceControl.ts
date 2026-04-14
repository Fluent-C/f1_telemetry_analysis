import { useQuery } from '@tanstack/react-query'
import { fetchRaceControl } from '../api/f1Client'

export function useRaceControl(sessionId: number | null) {
  return useQuery({
    queryKey: ['race-control', sessionId],
    queryFn:  () => fetchRaceControl(sessionId!),
    enabled:  sessionId !== null,
  })
}
