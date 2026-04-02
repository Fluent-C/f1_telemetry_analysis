import { useQuery } from '@tanstack/react-query'
import { fetchDrivers } from '../api/f1Client'

export function useDrivers(sessionId: number | null) {
  return useQuery({
    queryKey: ['drivers', sessionId],
    queryFn:  () => fetchDrivers(sessionId!),
    enabled:  sessionId !== null,
  })
}
