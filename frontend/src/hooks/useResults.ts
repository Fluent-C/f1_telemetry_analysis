import { useQuery } from '@tanstack/react-query'
import { fetchResults } from '../api/f1Client'

export function useResults(sessionId: number | null) {
  return useQuery({
    queryKey: ['results', sessionId],
    queryFn:  () => fetchResults(sessionId!),
    enabled:  sessionId !== null,
  })
}
