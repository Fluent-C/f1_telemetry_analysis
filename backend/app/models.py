"""
models.py
SQLAlchemy ORM 모델 — DB 테이블 매핑.

[주의]
  - telemetry/weather 는 파티셔닝 테이블이므로 FK 없음
  - ORM 모델에서도 relationship() 선언하지 않음 (쿼리는 raw SQL 사용)
"""

from sqlalchemy import (
    Boolean, Column, Date, Integer, SmallInteger, Float,
    String, Text, Enum, DateTime,
)
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


class Session(Base):
    __tablename__ = 'sessions'

    id           = Column(Integer, primary_key=True, autoincrement=True)
    season       = Column(SmallInteger, nullable=False)
    round        = Column(SmallInteger, nullable=False)
    event_name   = Column(String(100), nullable=False)
    circuit_key  = Column(String(50), nullable=False)
    session_type = Column(String(10), nullable=False)
    session_date = Column(Date)


class Team(Base):
    __tablename__ = 'teams'

    id         = Column(Integer, primary_key=True, autoincrement=True)
    team_name  = Column(String(100), nullable=False)
    season     = Column(SmallInteger, nullable=False)
    team_color = Column(String(6), nullable=False)


class Driver(Base):
    __tablename__ = 'drivers'

    id          = Column(Integer, primary_key=True, autoincrement=True)
    session_id  = Column(Integer, nullable=False)
    driver_code = Column(String(3), nullable=False)
    full_name   = Column(String(100))
    team_name   = Column(String(100))
    car_number  = Column(SmallInteger)


class Lap(Base):
    __tablename__ = 'laps'

    id               = Column(Integer, primary_key=True, autoincrement=True)
    session_id       = Column(Integer, nullable=False)
    driver_code      = Column(String(3), nullable=False)
    lap_number       = Column(SmallInteger, nullable=False)
    lap_time_ms      = Column(Integer)
    compound         = Column(String(20))
    tyre_life        = Column(SmallInteger)
    is_personal_best = Column(Boolean, default=False)
    deleted          = Column(Boolean, default=False)


class Telemetry(Base):
    """파티셔닝 테이블 — FK 없음, raw SQL 쿼리 사용 권장."""
    __tablename__ = 'telemetry'

    season          = Column(SmallInteger, nullable=False, primary_key=True)
    session_id      = Column(Integer, nullable=False, primary_key=True)
    driver_code     = Column(String(3), nullable=False, primary_key=True)
    lap_number      = Column(SmallInteger, nullable=False, primary_key=True)
    time_ms         = Column(Integer, nullable=False, primary_key=True)
    session_time_ms = Column(Integer, nullable=False)
    speed           = Column(Float)
    throttle        = Column(Float)
    brake           = Column(Boolean)
    gear            = Column(SmallInteger)
    rpm             = Column(SmallInteger)
    drs             = Column(SmallInteger)
    x               = Column(Float)
    y               = Column(Float)


class Weather(Base):
    """파티셔닝 테이블 — FK 없음."""
    __tablename__ = 'weather'

    season     = Column(SmallInteger, nullable=False, primary_key=True)
    session_id = Column(Integer, nullable=False, primary_key=True)
    time_ms    = Column(Integer, nullable=False, primary_key=True)
    air_temp   = Column(Float)
    track_temp = Column(Float)
    humidity   = Column(Float)
    rainfall   = Column(Boolean)
    wind_speed = Column(Float)
    wind_dir   = Column(SmallInteger)


class EtlProgress(Base):
    __tablename__ = 'etl_progress'

    season       = Column(SmallInteger, nullable=False, primary_key=True)
    round        = Column(SmallInteger, nullable=False, primary_key=True)
    session_type = Column(String(10), nullable=False, primary_key=True)
    status       = Column(Enum('pending', 'running', 'done', 'failed'))
    telemetry_rows = Column(Integer)
    weather_rows   = Column(Integer)
    started_at   = Column(DateTime)
    completed_at = Column(DateTime)
    error_msg    = Column(Text)
