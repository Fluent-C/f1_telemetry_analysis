import { useQuery } from '@tanstack/react-query'
import { fetchSessions } from '../api/f1Client'

export function useSessions(season: number) {
  return useQuery({
    queryKey: ['sessions', season],
    queryFn:  () => fetchSessions(season),
  })
}
