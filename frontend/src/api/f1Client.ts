import axios from 'axios'
import type { Session, Driver, Lap, TelemetryResponse } from '../types/f1'

const api = axios.create({
  baseURL: 'http://localhost:8000',
})

export const fetchSessions = (season: number): Promise<Session[]> =>
  api.get<Session[]>('/sessions', { params: { season } }).then(r => r.data)

export const fetchDrivers = (sessionId: number): Promise<Driver[]> =>
  api.get<Driver[]>('/drivers', { params: { session_id: sessionId } }).then(r => r.data)

export const fetchLaps = (sessionId: number, driverCode: string): Promise<Lap[]> =>
  api
    .get<Lap[]>(`/sessions/${sessionId}/laps`, { params: { driver: driverCode } })
    .then(r => r.data)

export const fetchTelemetry = (
  sessionId: number,
  drivers: [string, string],
  laps: [number, number],
): Promise<TelemetryResponse> =>
  api
    .get<TelemetryResponse>('/telemetry', {
      params: {
        session_id: sessionId,
        drivers:    drivers.join(','),
        laps:       laps.join(','),
      },
    })
    .then(r => r.data)
