# FastF1 API 종합 데이터 스펙 사전 (Full Data Dictionary)

이 문서는 FastF1 모듈을 통해 접근할 수 있는 공식 F1 라이브 타이밍/텔레메트리 데이터 속성을 **총망라(Comprehensive)**한 레퍼런스입니다.  
프로젝트의 현재 상태(Phase 1)를 기준으로 **현재 ETL 파이프라인에서 수집 중인 데이터(✅)**와 **향후 추가 스키마 확장이 가능한 미수집 데이터(🔲)**상태로 구분되어 있습니다.

---

## 1. 텔레메트리 및 위치 센서 데이터 (Telemetry Data)
`lap.get_car_data()` 및 `lap.get_pos_data()` 등을 통해 얻을 수 있는 고주파(~18Hz) 센서 데이터 모음입니다. 하나의 데이터프레임으로 머지(Merge)하여 많이 사용합니다.

### 기계적/물리 센서 (Car Data)
*   ✅ `Date` / `SessionTime` / `Time`: 해당 데이터가 기록된 절대 시각 및 세션/랩 기준 상대 시각 경과량
*   ✅ `Speed`: 차량의 속도 (km/h)
*   ✅ `RPM`: 엔진 회전수
*   ✅ `nGear`: 현재 기어 단수 (1~8단, 0은 중립(N))
*   ✅ `Throttle`: 스로틀 페달 압력 퍼센티지 (0 ~ 100)
*   ✅ `Brake`: 브레이크 페달 전개 여부 (0 또는 1, Boolean)
*   ✅ `DRS`: DRS 활성화 상태 지시자 (0~14 값으로 각 상태 표현. 예: 8 이상 활성화)

### 위치 산출 센서 (Positional Data)
*   🔲 `X`, `Y`, `Z`: 공식 GPS 기반 트랙 상의 3차원 위치 좌표
*   🔲 `Distance`: 해당 시각까지 출발 선으로부터 주행한 누적 거리 (랩 내 주행 궤적과 브레이킹 포인트 맵핑용 지표)
*   ✅ `Source`: 데이터 수집 출처 식별자 (str)

---

## 2. 개별 랩 메타 데이터 및 타이밍 (Timing & Lap Data)
`session.laps`를 통해 가져오는 드라이버의 각 바퀴별 기록 및 타이어 운영 상태입니다.

### 랩 타이밍 & 퍼포먼스
*   ✅ `LapTime`: 해당 랩 기록 소요 시간 (`TimdeDelta`)
*   ✅ `IsPersonalBest`: 해당 랩이 드라이버의 세션 내 개인 최고 기록인지 여부
*   🔲 `IsFastest`: 해당 랩이 전체 세션에서 가장 빠른 랩인지 여부 (Purple lap)
*   🔲 `Sector1Time`, `Sector2Time`, `Sector3Time`: 섹터 1, 2, 3별 통과 소요 시간
*   🔲 `SpeedI1`, `SpeedI2`, `SpeedFL`, `SpeedST`: 주요 스피드 트랩 지점 통과 속도 (km/h)
    * *(I1, I2: 인터벌 통과 지점, FL: 피니쉬 라인, ST: 트랙 내 가장 긴 직선 최고속 지점)*
*   🔲 `Deleted`: 트랙 리밋 위반 등의 사유로 해당 랩 타임이 공식 삭제되었는지 여부
*   🔲 `Position`: 해당 랩 종료 순간 드라이버의 실제 레이스 순위
*   ✅ `LapNumber`: 현재 주행 바퀴 수

### 타이어 전략 및 피트스탑 (Tyre & Stint)
*   ✅ `Compound`: 사용 중인 타이어 컴파운드명 (`SOFT`, `MEDIUM`, `HARD`, `INTERMEDIATE`, `WET`)
*   🔲 `TyreLife`: 타이어를 장착한 이후 굴러간 랩 수 (타이어 노후화 및 데그라데이션 측정용)
*   🔲 `FreshTyre`: 해당 스틴트 시작 시 새 타이어였는지 중고 타이어였는지 여부
*   🔲 `Stint`: 이번 랩이 드라이버의 현재 레이스에서 몇 번째 스틴트 구간인지
*   🔲 `PitOutTime`, `PitInTime`: 차고로 피트인/아웃한 시각 기록 (`TimeDelta` 기반으로 실제 피트스탑 소요 시간 산출 가능)

---

## 3. 기상 정보 (Weather Data)
`session.weather_data`를 통해 매 1분 주기로 기록되는 서킷의 각종 환경 정보입니다.

*   ✅ `AirTemp`: 현재 대기 온도 (섭씨 °C)
*   ✅ `TrackTemp`: 현재 트랙 표면 노면 온도 (섭씨 °C)
*   ✅ `Humidity`: 습도 (%)
*   ✅ `Pressure`: 기압 (mbar)
*   ✅ `WindSpeed`: 풍속 (m/s)
*   ✅ `WindDirection`: 풍향 각도 (0~360도)
*   ✅ `Rainfall`: 현재 경기장에 비가 오고 있는지 여부 (Boolean. True일 경우 WET/INTER 타이어 필요)

---

## 4. 세션 & 이벤트 상태, 레이스 컨트롤 메시지
라이브 타이밍 로그를 통해 떨어지는 레이스 진행과 관련된 흐름 데이터입니다. 프론트엔드 Ticker 영역 설계에 적합합니다.

### 기본 레이스 세션 (Session Info)
*   ✅ `session_info`: 세션 고유 식별자, 개최국, 시티, 서킷 이름, 날짜(Date), 세션 이름(Q, R, FP1 등)
*   ✅ `total_laps`: 해당 이벤트(본선 혹은 스프린트)의 계획된 총 랩 수치

### 트랙 관제 시스템 (Race Control)
*   🔲 `track_status`: 현재 트랙의 공식 플래그 상태 변화 로깅
    * *예: `1`: Green flag, `2`: Yellow flag, `4`: Safety Car, `5`: Red Flag, `6`: Virtual Safety Car 등*
*   🔲 `race_control_messages`: 대회 공식 심판진(FIA)이 실시간으로 띄워주는 텍스트 메시지.
    * *예: "Car 1 time penalty", "Track Limits turn 4", "DRS Enabled", "Investigation for Causing a collision"*

---

## 5. 서킷 지리/레이아웃 정보 (Circuit Information)
트랙 맵을 올바르게 그리고 텔레메트리(Position Data)를 코너 번호와 올바르게 매핑하기 위한 메타데이터입니다.
(`Session.get_circuit_info()` 로 접근)

*   🔲 `corners`: 서킷 내 모든 코너의 마커 정보.
    * *(`Number`: 코너 번호, `Angle`: 진입 각도, `X`/`Y`: 마커의 위치좌표, `Distance`: 직선거리 매핑용 누적 미터 수)*
*   🔲 `marshal_lights` & `marshal_sectors`: 마샬(안전요원 및 디지털 플래그)이 서있는 위치 좌표
*   🔲 `rotation`: 트랙의 실제 방위(북쪽 기준) 각도. 공식 트랙 도면과 궤적 렌더링(X/Y)의 방향을 동일하게 맞추는 데 사용합니다.

---

## 6. 드라이버 공식 경기 결과표 (Session Results)
경기가 종료된 직후 공식 집계되는 드라이버별 최종 스탯 기록입니다. (`Session.results`)

*   ✅ `DriverNumber`, `BroadcastName`, `FullName`, `TeamName`, `TeamColor`, `CountryCode`: 기본적인 선수 고유 프로필 및 팀 컬러
*   🔲 `ClassifiedPosition` / `GridPosition`: (그리드 패널티/타임 옵셋 등을 모두 반영한) 공식 최종 리절트 순위 및 예선에 따른 그리드 출발 위치
*   🔲 `Points`: 가장 중요한 항목으로 해당 레이스 결과에 따라 얻어간 공식 월드 챔피언십 점수
*   🔲 `Time` & `Status`: 피니시까지 걸린 총 소요시간. 리타이어한 경우 리타이어 사유
    * *예: "Finished", "+1 Lap", "Engine", "Collision", "Drive shaft" 등 다양한 원인*
*   🔲 `Q1`, `Q2`, `Q3` Record: 예선(Qualifying) 세션일 경우 각 녹아웃 섹션 트라이에서 기록한 랩 타임 결과.
