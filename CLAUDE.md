# F1 Telemetry Analytics — AI 컨텍스트 파일

> **새 AI 세션을 시작할 때 이 파일을 먼저 읽으세요.**
> 이 파일은 세션 간 컨텍스트를 유지하기 위한 Source of Truth입니다.
> 변경 사항이 생기면 세션 말미에 반드시 업데이트하세요.

---

## ⚠️ 이중 AI 개발 환경 안내 (필독)

이 프로젝트는 **두 개의 AI 도구가 동시에 개발**에 참여합니다.

| 도구 | 역할 | 특징 |
|------|------|------|
| **Claude Code** (VSCode 익스텐션) | 파일 편집, 명령 실행, 코드 생성 | VSCode 내 사이드바에서 대화형으로 사용 |
| **Antigravity** (독립 실행형 앱) | 파일 편집, 브라우저 조작, 차트 확인 | 별도 프로그램으로 실행, VSCode와 병행 사용 |

### 충돌 방지 규칙

1. **같은 파일을 동시에 수정하지 않는다.**
   작업을 시작하기 전에 아래 `현재 진행 중인 작업` 섹션을 확인하고,
   다른 AI가 진행 중인 파일과 겹치지 않는지 먼저 체크하라.

2. **작업 시작 시 즉시 선점 표시를 남긴다.**
   `현재 진행 중인 작업` 섹션에 자신의 도구명과 담당 파일/작업을 기록하라.

3. **작업 완료 시 선점 표시를 해제하고 완료 내역을 갱신한다.**
   완료된 항목은 `Step 진행 현황`으로 이동시키고 `현재 진행 중인 작업`을 비운다.

4. **CLAUDE.md가 최종 진실(Source of Truth)이다.**
   코드 파일과 CLAUDE.md가 충돌하면 코드 파일을 기준으로 CLAUDE.md를 수정하라.

---

## 🔄 세션 인계 프로토콜 (토큰 소진 전 필수)

> AI는 자신의 컨텍스트 한계(토큰 소진)가 가까워지면,
> 다음 AI가 즉시 작업을 이어받을 수 있도록 **반드시 아래 체크리스트를 수행**한다.

### 인계 전 체크리스트

- [ ] 작업 중이던 파일을 저장하고 문법 오류가 없는지 확인
- [ ] `현재 진행 중인 작업` 섹션을 최신화 — 무엇을 했고, 어디서 멈췄는지 명시
- [ ] 미완성 작업이 있으면 TODO 항목으로 남긴다 — 파일명과 라인번호 포함
- [ ] 서버/프로세스 상태 기록 — 백엔드/프론트엔드/Docker가 현재 실행 중인지 여부
- [ ] 마지막으로 실행한 명령어와 출력 요약 기록
- [ ] `최종 업데이트` 타임스탬프 갱신 (파일 맨 아래)

### 인계 메시지 양식

아래 양식을 복사해서 `현재 진행 중인 작업` 섹션에 붙여넣어라:

```
### 인계 메시지 (YYYY-MM-DD HH:MM KST)
- 작성 주체: Claude Code / Antigravity
- 완료한 작업: ...
- 중단 지점: [파일명:라인번호] 또는 "완전 완료"
- 다음 AI가 할 일: ...
- 주의사항: ...
- 서버 상태: Docker ? | Backend ? port 8000 | Frontend ? port 5173
```

---

## 프로젝트 한 줄 요약

FastF1 → MySQL 8.0 → FastAPI → React 스택의 F1 텔레메트리 분석 대시보드.
드라이버 간 랩 텔레메트리를 4-panel 차트(속도/스로틀/브레이크/기어)로 비교한다.

---

## Step 진행 현황 (2026-04-02)

```
✅ Step 1  개발 환경 (Docker MySQL, Python venv, React scaffold)
✅ Step 2  DB 스키마 (7개 테이블, RANGE 파티셔닝 by season)
✅ Step 3  ETL 파이프라인 (fetch_*.py + load_data.py + load_teams.py)
✅ Step 4  FastAPI 백엔드 (4개 엔드포인트)
✅ Step 5  React 프론트엔드 (SessionSelector, DriverLapSelector, TelemetryChart)
✅ Step 5b TelemetryChart 차트 버그 수정 (기어 Y축, 브레이크 step 렌더링)
✅ Step 5c 브레이크 데이터 ETL 버그 수정 (boolean→int 변환, R1 재적재 완료)
✅ Step 6  통합 테스트 (UI 렌더링, 크로스헤어, 재적재 멱등성, 응답시간 검증 완료)
✅ Step 7  2025 시즌 전체 병렬 적재 (16워커 적재 완료: 2,970만 로우)
```

---

## 🚧 현재 진행 중인 작업

> 이 섹션이 비어 있으면 어느 AI도 자유롭게 다음 작업을 시작할 수 있다.
> 작업 시작 시 즉시 채우고, 완료 시 비워라.

```
현재 작업 없음 — Phase 1 로컬 MVP 전체 완료. 이제 Phase 2(안정화 및 클라우드 배포)로 넘어갑니다.
```

### 다음 AI가 할 일 (Phase 2 시작)

1. **Phase 2 계획 검토**: `plan.md`의 Phase 2 (안정화 및 Vercel/VPS 배포) 목표 확인
2. **코드 정리 및 린트**: 배포 전 로컬 환경 코드 정리, React 빌드 검증 (`npm run build`)
3. **환경 변수 관리 전략 수립**: 프로덕션용 DB 연결 및 API URL 처리 방안 마련

---

## 수정된 버그 이력

| 날짜 | Step | 버그 | 수정 내용 |
|------|------|------|-----------|
| 2026-04-02 | 5b | 기어 Y축 0~1로 고정됨 | ECharts yAxis `interval:1`, `min:1`, `max:8` 설정 |
| 2026-04-02 | 5b | 브레이크 라인 렌더링 안 됨 | `step:'end'` + `areaStyle` 추가 |
| 2026-04-02 | 5c | 브레이크 값 전부 0 | `fetch_telemetry.py`에서 pandas bool→int 변환 누락. `.fillna(False).astype(int)` 추가 후 2025 R1 재적재 완료 |
| 2026-04-02 | 7b | 스프린트 세션(SQ, S) 표출 안 됨 | 24/25년 FastF1 스프린트 이벤트명 변경(`sprint_qualifying`) 미대응 수정. `fetch_sessions.py` 지원 추가 및 재적재 완료 |

---

## 디렉토리 구조

```
f1_telemetry_analysis/
├── .env                    # DB 크리덴셜, 포트, 캐시 경로 (git 제외)
├── .env.example            # .env 템플릿
├── docker-compose.yml      # MySQL 8.0 (--local-infile=1, --max_connections=200)
├── plan.md                 # 마스터 플랜 (Phase 1-3 전체 로드맵 + 현황)
├── phase1_plan.md          # Phase 1 Source of Truth (상세 스펙)
├── CLAUDE.md               # 이 파일 (AI 세션 컨텍스트)
│
├── etl/                    # Python ETL 파이프라인
│   ├── venv/               # Python 가상환경 (git 제외)
│   ├── requirements.txt
│   ├── config.py           # get_db_connection(), .env 로드
│   ├── schema.sql          # CREATE TABLE (7개)
│   ├── fetch_sessions.py   # FastF1 schedule → sessions 메타
│   ├── fetch_telemetry.py  # get_car_data() → telemetry DataFrame
│   ├── fetch_weather.py    # session.weather_data → weather DataFrame
│   ├── load_data.py        # 메인 오케스트레이터 (CLI, 체크포인트, Pool)
│   ├── load_teams.py       # 팀 색상 추출 → teams 테이블
│   └── fastf1_cache/       # FastF1 캐시 (worker_0 ~ worker_7)
│
├── backend/                # FastAPI 서버
│   ├── venv/               # Python 가상환경 (git 제외)
│   ├── requirements.txt
│   └── app/
│       ├── main.py         # lifespan, CORS, session_season_cache, 라우터 등록
│       ├── database.py     # SQLAlchemy async engine + get_db()
│       ├── models.py       # ORM 모델 (7개 테이블)
│       ├── schemas.py      # Pydantic v2 응답 스키마
│       └── routers/
│           ├── sessions.py # GET /sessions, GET /sessions/{id}/laps
│           ├── drivers.py  # GET /drivers (팀컬러 LEFT JOIN)
│           └── telemetry.py# GET /telemetry (핵심, 파티션 프루닝)
│
└── frontend/               # React 18 + TypeScript + Vite
    ├── package.json
    └── src/
        ├── types/f1.ts
        ├── api/f1Client.ts
        ├── hooks/           # useSessions, useDrivers, useLaps, useTelemetry
        ├── components/      # SessionSelector, DriverLapSelector, TelemetryChart
        ├── App.tsx
        ├── main.tsx
        └── index.css
```

---

## API 엔드포인트 (백엔드 완성)

| Method | Path | 설명 |
|--------|------|------|
| GET | `/health` | `{"status":"ok","cached_sessions":N}` |
| GET | `/sessions?season=2025` | 시즌별 세션 목록 |
| GET | `/sessions/{id}/laps` | 세션 내 랩 목록 (`?driver=VER` 필터) |
| GET | `/drivers?session_id=5` | 드라이버 목록 + 팀 색상 |
| GET | `/telemetry?session_id=5&drivers=VER,HAM&laps=10,12` | 텔레메트리 비교 |

Swagger UI: `http://localhost:8000/docs`

---

## 핵심 설계 결정 (변경 시 주석 추가)

| 항목 | 결정 | 이유 |
|------|------|------|
| DB 파티셔닝 | RANGE(season) | 시즌별 쿼리 프루닝 |
| telemetry FK | 없음 | MySQL 8.0 파티셔닝 + FK 불가 |
| compound | VARCHAR(20) | INTERMEDIATE(12자) 대응 |
| time_ms | 랩 기준 (차트 X축) | fetch_telemetry: `lap.Time` |
| session_time_ms | 세션 기준 (weather JOIN) | fetch_telemetry: `lap.SessionTime` |
| session_season_cache | 앱 시작 시 전체 로드 | /telemetry 파티션 프루닝용, 추가 쿼리 없음 |
| 텔레메트리 직렬화 | 컬럼 방향 (column-oriented) | JSON 크기 최소화 |
| X/Y 좌표 | 현재 NULL | `get_car_data()` 미제공, Phase 3에서 `get_pos_data()` 병합 |
| brake 저장 타입 | TINYINT 0/1 | FastF1 bool→CSV 직렬화 시 MySQL이 "True"를 0으로 해석하는 버그 방지 |

---

## 구현 주의사항 (코딩 시 필독)

1. **ECharts + React 18 Strict Mode**: `onEvents` prop 사용, `useEffect` 내 이벤트 등록 금지
   ```tsx
   // OK
   <ReactECharts option={option} onEvents={{ 'datazoom': handleZoom }} />
   // NG: StrictMode 이중 마운트로 이벤트 핸들러 중복
   useEffect(() => { chartRef.current?.on('datazoom', handleZoom) }, [])
   ```
2. **크로스헤어 동기화**: `axisPointer.link: [{xAxisIndex: 'all'}]` — 4개 차트 동일 그룹
3. **최속 랩 자동 선택**: `laps` 배열에서 `lap_time_ms`가 가장 작은 랩 번호를 기본값으로
4. **TanStack Query v5 문법**: `useQuery({ queryKey, queryFn })` (v4의 `useQuery(key, fn)` 아님)
5. **팀 색상 표시**: `#${driver.team_color}` (DB는 `#` 없이 6자리 hex 저장)
6. **brake ETL**: FastF1 `Brake`(bool) → `.fillna(False).astype(int)` 필수 (반드시 0/1로 변환 후 저장)

---

## 환경 실행 방법

```bash
# 1. Docker MySQL 시작
docker compose up -d

# 2. 백엔드 실행
cd backend
venv/Scripts/activate          # Windows
uvicorn app.main:app --reload --port 8000

# 3. 프론트엔드 실행
cd frontend
npm run dev                    # → http://localhost:5173

# 4. ETL (라운드 추가 적재)
cd etl
venv/Scripts/activate
python load_data.py --season 2025 --round 2 --workers 4
python load_teams.py --season 2025 --round 2 --update
```

---

## 환경 변수 (.env)

```
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=f1db
DB_USER=f1user
DB_PASSWORD=f1pass2025
DB_ROOT_PASSWORD=f1root2025
FASTF1_CACHE_DIR=./fastf1_cache
BACKEND_PORT=8000
CORS_ORIGINS=http://localhost:5173
ETL_WORKERS=8
ETL_MAX_RETRIES=3
```

---

## 설치된 프론트엔드 패키지

```json
{
  "dependencies": {
    "axios": "latest",
    "@tanstack/react-query": "^5.x",
    "echarts": "latest",
    "echarts-for-react": "latest"
  },
  "devDependencies": {
    "@tanstack/react-query-devtools": "^5.x"
  }
}
```

> TODO: `tslib` devDependency 추가 필요 (echarts-for-react 의존성, 빌드 경고 제거)

---

## Step 5 구현 완료 파일 목록

| 파일 | 역할 |
|------|------|
| `src/main.tsx` | QueryClient + QueryClientProvider + ReactQueryDevtools |
| `src/types/f1.ts` | Session/Driver/Lap/TelemetryResponse TypeScript 인터페이스 |
| `src/api/f1Client.ts` | axios 인스턴스 + fetchSessions/fetchDrivers/fetchLaps/fetchTelemetry |
| `src/hooks/useSessions.ts` | useQuery: GET /sessions |
| `src/hooks/useDrivers.ts` | useQuery: GET /drivers |
| `src/hooks/useLaps.ts` | useQuery: GET /sessions/{id}/laps + fastestLap() 헬퍼 |
| `src/hooks/useTelemetry.ts` | useQuery: GET /telemetry (두 드라이버+랩 모두 선택 시 활성화) |
| `src/components/SessionSelector.tsx` | 라운드별 optgroup 드롭다운 |
| `src/components/DriverLapSelector.tsx` | 드라이버·랩 선택 + 최속랩 자동선택 + 팀컬러 뱃지 |
| `src/components/TelemetryChart.tsx` | ECharts 단일 인스턴스 4-grid (속도/스로틀/브레이크/기어) |
| `src/App.tsx` | 전체 레이아웃 + 선택 상태 관리 |
| `src/index.css` | 다크 테마 스타일 (F1 레드 #e10600) |

---

*최종 업데이트: 2026-04-02 | Antigravity | Phase 1 전체 완료 (스프린트 버그 수정 포함)*
