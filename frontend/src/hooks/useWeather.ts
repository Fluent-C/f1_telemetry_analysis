import { useQuery } from '@tanstack/react-query'
import { fetchWeatherSummary } from '../api/f1Client'

export function useWeather(sessionId: number | null) {
  return useQuery({
    queryKey: ['weather', sessionId],
    queryFn:  () => fetchWeatherSummary(sessionId!),
    enabled:  sessionId !== null,
  })
}
