"""
schemas.py
FastAPI 응답용 Pydantic v2 스키마.
"""

from __future__ import annotations
from datetime import date
from typing import Optional
from pydantic import BaseModel, ConfigDict


# ──────────────────────────────────────────────
# Sessions
# ──────────────────────────────────────────────

class SessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:           int
    season:       int
    round:        int
    event_name:   str
    circuit_key:  str
    session_type: str
    session_date: Optional[date]


# ──────────────────────────────────────────────
# Drivers
# ──────────────────────────────────────────────

class DriverOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    driver_code: str
    full_name:   Optional[str]
    team_name:   Optional[str]
    car_number:  Optional[int]
    team_color:  str   # COALESCE(teams.team_color, 'FFFFFF')


# ──────────────────────────────────────────────
# Laps
# ──────────────────────────────────────────────

class LapOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    driver_code:      str
    lap_number:       int
    lap_time_ms:      Optional[int]
    compound:         Optional[str]
    tyre_life:        Optional[int]
    is_personal_best: bool
    deleted:          bool


# ──────────────────────────────────────────────
# Telemetry
# ──────────────────────────────────────────────

class TelemetryData(BaseModel):
    """컬럼 방향(column-oriented) 직렬화 — JSON 크기 최소화."""
    time_ms:  list[int]
    speed:    list[Optional[float]]
    throttle: list[Optional[float]]
    brake:    list[Optional[bool]]
    gear:     list[Optional[int]]
    rpm:      list[Optional[int]]
    drs:      list[Optional[int]]


class DriverTelemetry(BaseModel):
    driver_code: str
    team_color:  str
    lap_number:  int
    data:        TelemetryData


class TelemetryOut(BaseModel):
    session_id:  int
    comparisons: list[DriverTelemetry]
