import { useQuery } from '@tanstack/react-query'
import { fetchCircuit } from '../api/f1Client'

export function useCircuit(circuitKey: string | null) {
  return useQuery({
    queryKey: ['circuit', circuitKey],
    queryFn:  () => fetchCircuit(circuitKey!),
    enabled:  !!circuitKey,
    staleTime: Infinity, // 서킷 데이터는 변하지 않음
  })
}
