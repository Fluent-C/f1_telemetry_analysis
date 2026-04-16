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
  driver_code:      string
  lap_number:       number
  lap_time_ms:      number | null
  sector1_ms:       number | null
  sector2_ms:       number | null
  sector3_ms:       number | null
  speed_i1:         number | null
  speed_i2:         number | null
  speed_fl:         number | null
  speed_st:         number | null
  compound:         string | null
  tyre_life:        number | null
  fresh_tyre:       number | null
  stint:            number | null
  pit_in_ms:        number | null
  pit_out_ms:       number | null
  position:         number | null
  is_personal_best: boolean
  deleted:          boolean
}

export interface WeatherSummary {
  air_temp:    number | null
  track_temp:  number | null
  humidity:    number | null
  rainfall:    number | null  // 0 or 1
  wind_speed:  number | null
}

export interface CircuitCorner {
  number:   number
  letter:   string
  x:        number
  y:        number
  angle:    number
  distance: number
}

export interface CircuitInfo {
  circuit_key:     string
  rotation:        number
  corners:         CircuitCorner[]
  marshal_sectors: { number: number; x: number; y: number }[]
}

export interface RaceControlMessage {
  time_ms:     number | null
  lap_number:  number | null
  category:    string
  message:     string
  flag:        string | null
  driver_code: string | null
}

export interface SessionResult {
  driver_code:          string
  classified_position:  number | null
  grid_position:        number | null
  points:               number | null
  q1_ms:                number | null
  q2_ms:                number | null
  q3_ms:                number | null
  status:               string | null
  full_name:            string | null
  team_name:            string | null
  team_color:           string | null
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
