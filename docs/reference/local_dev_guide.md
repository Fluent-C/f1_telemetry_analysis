# 로컬 개발 환경 실행 가이드

> F1 Telemetry Analytics 로컬 테스트 배포용 가이드입니다.  
> 데이터가 이미 적재된 상태에서 UI 동작을 확인하거나 기능을 개발할 때 사용합니다.

---

## ⚡ 한 번에 실행하기 (권장)

프로젝트 루트의 **`start_dev.bat`** 파일을 더블클릭하면:
- Docker MySQL 자동 시작
- FastAPI 백엔드 (새 창)
- React 프론트엔드 (새 창, 네트워크 접속 포함)
- 브라우저 자동 열기

```
f1_telemetry_analysis/
└── start_dev.bat   ← 이 파일을 더블클릭
```

> **조건:** Docker Desktop이 먼저 실행되어 있어야 합니다.

---

## 🌐 네트워크 접속 방법 (스마트폰·태블릿·다른 PC)

같은 Wi-Fi에 연결된 기기에서 접속할 수 있습니다.

### 1단계: 내 PC의 IP 주소 확인

```powershell
ipconfig
# → "IPv4 주소" 항목 확인 (예: 192.168.1.100)
```

또는 `start_dev.bat` 실행 후 창 하단에서 자동으로 표시됩니다.

### 2단계: 다른 기기에서 접속

```
http://192.168.1.100:5173       ← 프론트엔드 대시보드
http://192.168.1.100:8000/docs  ← API Swagger (선택)
```

> IP 주소는 공유기마다 다릅니다. `ipconfig` 출력의 **IPv4** 값을 사용하세요.

### 방화벽 허용 (처음 한 번만, Windows 방화벽이 차단할 경우)

PowerShell을 **관리자 권한**으로 실행 후:

```powershell
netsh advfirewall firewall add rule name="F1 Frontend 5173" dir=in action=allow protocol=TCP localport=5173
netsh advfirewall firewall add rule name="F1 Backend 8000" dir=in action=allow protocol=TCP localport=8000
```

---

## 사전 요구사항

| 도구 | 버전 | 확인 명령 |
|------|------|----------|
| Docker Desktop | 최신 | `docker --version` |
| Python | 3.11+ | `python --version` |
| Node.js | 18+ | `node --version` |
| npm | 9+ | `npm --version` |

---

## 1. 환경 변수 설정

프로젝트 루트에 `.env` 파일이 없으면 `.env.example`을 복사하여 생성합니다.

```bash
cp .env.example .env
```

`.env` 파일 내용 (기본값 그대로 사용 가능):

```env
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

## 2. Docker MySQL 시작

```bash
docker compose up -d
```

정상 실행 확인:

```bash
docker ps
# f1_telemetry_analysis-mysql-1 이 Up 상태여야 함
```

DB 접속 테스트 (선택):

```bash
docker exec f1_telemetry_analysis-mysql-1 mysql -uf1user -pf1pass2025 f1db -e "SHOW TABLES;"
```

---

## 3. 백엔드 (FastAPI) 실행

### 최초 1회: 가상환경 + 패키지 설치

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate

pip install -r requirements.txt
pip install cryptography   # MySQL 인증에 필요
```

### 서버 실행

```bash
cd backend
venv\Scripts\activate      # Windows
uvicorn app.main:app --reload --port 8000
```

정상 실행 시 출력:

```
INFO: Application startup complete.
INFO: Uvicorn running on http://127.0.0.1:8000
```

**Swagger UI 확인:** `http://localhost:8000/docs`

---

## 4. 프론트엔드 (React/Vite) 실행

### 최초 1회: 패키지 설치

```bash
cd frontend
npm install
```

### 개발 서버 실행

```bash
cd frontend
npm run dev
```

브라우저에서 `http://localhost:5173` 접속

---

## 5. 전체 스택 동작 확인 체크리스트

| 항목 | URL / 명령 | 기대 결과 |
|------|-----------|---------|
| MySQL | `docker ps` | `f1_telemetry_analysis-mysql-1` Up |
| Backend health | `http://localhost:8000/health` | `{"status":"ok","cached_sessions":120}` |
| Backend docs | `http://localhost:8000/docs` | Swagger UI 표시 |
| Frontend | `http://localhost:5173` | 대시보드 UI 표시 |
| 세션 API | `http://localhost:8000/sessions?season=2025` | JSON 세션 목록 |

---

## 6. 주요 기능 동작 확인 순서

1. **세션 선택** — 드롭다운에서 2025 시즌 레이스 선택
2. **드라이버 선택** — Driver A, Driver B 각각 선택 (레이스: 순위순 정렬)
3. **텔레메트리 탭**
   - 4-panel 차트 (Speed/Throttle/Brake/Gear) 렌더링 확인
   - Speed 패널: DRS 구간 연초록 밴드 확인 (C-1)
   - 헤더: 날씨 정보(Air/Track/Hum) 표시 확인 (C-2)
   - SC/VSC 이벤트 있는 레이스: 노란 밴드 확인 (C-4)
   - Brake/Throttle 패널: 코너 진입 시 보라 밴드 (D-4, 트레일 브레이킹)
   - DRS ZONE ANALYSIS 차트 확인 (D-2)
   - TrackMap: Elev/Lateral G 토글 확인 (D-3)
4. **결과 탭** — 레이스 결과 테이블, 포지션 차트, 갭 차트 확인
5. **결과 탭 > FUEL-CORRECTED PACE** — 레이스 세션에서 연료 보정 곡선 확인 (D-1)

---

## 7. 종료 방법

```bash
# 프론트엔드: Ctrl+C
# 백엔드: Ctrl+C

# MySQL 컨테이너 중지
docker compose stop

# MySQL 컨테이너 완전 삭제 (데이터 유지됨 — volume 별도)
docker compose down
```

> ⚠️ `docker compose down -v` 는 볼륨(DB 데이터)까지 삭제됩니다. 주의하세요.

---

## 8. 자주 발생하는 오류

### `RuntimeError: 'cryptography' package is required`

```bash
pip install cryptography
```

### 백엔드 시작 시 DB 연결 실패

- Docker MySQL이 실행 중인지 확인: `docker ps`
- `.env` 파일의 `DB_HOST=127.0.0.1` 확인 (localhost가 아닌 127.0.0.1 사용)

### 프론트엔드에서 API 응답 없음

- 백엔드가 8000번 포트에서 실행 중인지 확인
- `http://localhost:8000/health` 직접 접속해서 응답 확인

### PowerShell에서 `&&` 사용 불가

PowerShell은 `&&` 미지원 — 명령을 줄 단위로 따로 실행합니다:

```powershell
cd backend
venv\Scripts\activate
uvicorn app.main:app --reload --port 8000
```

---

## 9. ETL 추가 적재 (선택 사항)

데이터가 이미 적재된 경우 불필요합니다.  
신규 라운드가 생겼거나 특정 세션을 다시 적재할 때만 실행합니다.

```bash
cd etl
venv\Scripts\activate

# 특정 라운드 적재
python load_data.py --season 2025 --round 5 --workers 4

# laps 컬럼만 빠르게 갱신 (telemetry 생략)
python load_data.py --season 2025 --all-rounds --laps-only --workers 8

# 팀 색상 갱신
python load_teams.py --season 2025 --round 5 --update
```
