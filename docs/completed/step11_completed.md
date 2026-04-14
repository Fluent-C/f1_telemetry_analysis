# Step 11: Option C — 트랙 맵 고도화

**시작일:** 2026-04-14  
**완료일:** 2026-04-14 | 커밋: `ae9bc86`  
**목표:** 서킷 코너 번호를 TrackMap 2D 위에 오버레이하고, 레이스 컨트롤 메시지(SC/VSC/플래그)를 타임라인으로 표시한다.

## 적재 결과
- `circuits`: 24개 서킷, 평균 16.8개 코너
- `race_control_messages`: 6,256개 메시지 / 120개 세션 (2025 전체)

---

## 구현 순서

### 11-1. DB (2개 테이블)
- `circuits` — circuit_key PK, rotation, corners JSON, marshal_sectors JSON
- `race_control_messages` — session_id FK, time_ms, lap_number, category, message, flag, driver_code

### 11-2. ETL (2개 신규 파일)
- `etl/fetch_circuit_info.py` — `session.get_circuit_info()` → corners/marshal_sectors
- `etl/fetch_race_control.py` — `session.race_control_messages` → rows
- `etl/load_data.py` 수정 — `messages=True` 추가, `insert_circuit_info()` / `insert_race_control()` 호출

### 11-3. Backend (2개 신규 라우터)
- `GET /circuits/{circuit_key}` — corners, marshal_sectors 반환
- `GET /race-control?session_id=X` — 메시지 목록 time_ms 오름차순 반환

### 11-4. Frontend
- `TrackMap.tsx` — `circuitKey` prop 추가, 2D 맵에 코너 번호 레이블 오버레이
- `RaceControlTimeline.tsx` — 신규: SC/VSC/플래그 타임라인 (ECharts markLine/markArea)
- `App.tsx` — `circuitKey` 전달, `RaceControlTimeline` 배치

---

## 완료 기준
- 2D TrackMap에 코너 번호(T1, T2 …)가 표시됨
- 레이스 세션 선택 시 RaceControlTimeline에 SC/VSC/플래그 이벤트가 표시됨
- TypeScript 컴파일 에러 없음
