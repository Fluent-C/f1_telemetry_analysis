# Phase 1.75: 배포 전 분석 고도화

**시작일:** 2026-04-16  
**목표:** Phase 2 퍼블릭 배포 전, 이미 적재된 데이터를 최대한 활용하여 경쟁 플랫폼 대비 차별화 기능을 확보한다.  
**원칙:** 구현 후 검증 완료된 기능만 배포에 포함. 미검증 기능은 코드는 유지하되 UI에서 비활성화.

---

## 실행 순서

### C항목 — 프론트엔드 시각화 (즉시 구현 가능, 새 ETL 불필요)

| # | 기능 | 데이터 소스 | 구현 범위 |
|---|------|-----------|----------|
| C-1 | ✅ DRS 구간 하이라이트 | `telemetry.drs` (0/1/2) | TelemetryChart 배경에 DRS=2 구간 초록 밴드 — `eac9289` |
| C-2 | ✅ 날씨 정보 헤더 표시 | `weather` 테이블 | 세션 헤더에 기상 요약 표시 + GET /sessions/{id}/weather — `6a2ab31` |
| C-4 | ✅ SC/VSC 밴드 텔레메트리 오버레이 | `race_control_messages.flag` | TelemetryChart 배경에 SC/VSC 구간 반투명 노란 밴드 — `eac9289` |

### D항목 — 분석 모델 (수학적 검증 필요)

| # | 기능 | 데이터 소스 | 구현 범위 | 검증 기준 |
|---|------|-----------|----------|----------|
| D-2 | DRS 델타 팀별 비교 | `telemetry.drs`, `telemetry.speed` | DRS 활성 전후 최고속도 차이 차트 | 레드불 vs 맥라렌 등 알려진 특성과 일치하는지 |
| D-4 | 트레일 브레이킹 구간 표시 | `telemetry.brake`, `telemetry.throttle` | Brake+Throttle 동시 입력 구간 하이라이트 | 코너 진입 시점에만 나타나는지 |
| D-3 | 횡가속도(Lateral G) 히트맵 | `telemetry.x`, `telemetry.y`, `telemetry.speed` | X,Y 곡률 미분 → G-Force 컬러링 트랙 맵 | 고속 코너에서 높은 G, 직선에서 0 근접 |
| D-1 | 연료 보정 페이스 곡선 | `laps.lap_time_ms`, `laps.tyre_life`, `weather.track_temp` | 연료 무게 차감 후 순수 타이어 열화율 도출 | TyreLife 증가 시 보정 랩타임 증가 확인 |

### C-3 — 랜딩 페이지 (Phase 2 배포 직전)

| # | 기능 | 구현 범위 |
|---|------|----------|
| C-3 | 랜딩 페이지 | 프로젝트 소개 + 기능 스크린샷 + AdSense 준비 |

---

## 완료 기준

- C항목: UI 렌더링 확인, TypeScript 에러 없음
- D항목: 최소 3개 레이스에서 상식적인 결과 확인 (검증 기록을 completed/ 에 남김)
- 배포 시: 검증 완료 기능만 활성화, 미검증은 feature flag로 비활성화
