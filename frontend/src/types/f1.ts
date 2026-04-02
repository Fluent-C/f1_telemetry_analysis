// API 응답 타입 — backend/app/schemas.py 와 1:1 대응

export interface Session {
  id: number
  season: number
  round: number
  event_name: string
  circuit_key: string
  session_type: string        // 'R' | 'Q' | 'FP1' | 'FP2' | 'FP3' | 'SQ' | 'S'
  session_date: string | null // ISO date string
}

export interface Driver {
  driver_code: string         // 'VER', 'HAM', ...
  full_name: string | null
  team_name: string | null
  car_number: number | null
  team_color: string          // 6자리 hex, '#' 없음: 'FF8000'
}

export interface Lap {
  driver_code: string
  lap_number: number
  lap_time_ms: number | null
  compound: string | null
  tyre_life: number | null
  is_personal_best: boolean
  deleted: boolean
}

export interface TelemetryData {
  time_ms:  number[]
  speed:    (number | null)[]
  throttle: (number | null)[]
  brake:    (boolean | null)[]
  gear:     (number | null)[]
  rpm:      (number | null)[]
  drs:      (number | null)[]
  x:        (number | null)[]
  y:        (number | null)[]
  z:        (number | null)[]
}

export interface DriverTelemetry {
  driver_code: string
  team_color:  string
  lap_number:  number
  data:        TelemetryData
}

export interface TelemetryResponse {
  session_id:  number
  comparisons: DriverTelemetry[]
}
