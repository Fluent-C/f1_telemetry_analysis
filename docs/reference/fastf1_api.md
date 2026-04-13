# FastF1 API 종합 데이터 스펙 위키 (Full Data Dictionary)

이 문서는 FastF1 모듈을 통해 공식 API에서 반환되는 **모든 주요 오브젝트(Session, Timing, Telemetry, Circuit, Results, Weather)의 속성과 반환 타입, 문서상 정의**를 총망라한 종합 레퍼런스 위키입니다.  

> ✅ 마크는 현재 프로젝트(Phase 1)의 ETL에서 수집하여 MySQL에 적재 중인 속성이며, 
> 🔲 마크는 향후 추가 확장을 위해 API가 기본적으로 제공하고 있는 미수집 속성입니다.

---

## 1. 차량 텔레메트리 데이터 (Car Telemetry & Position)
> 패키지 모듈: `fastf1.core.Telemetry`
> 드라이버의 차량에서 실시간 단위(약 18Hz 이상)로 수집되는 물리적 센서 및 위치 값입니다.

### 기계 센서 데이터 (Car Data Channels)
*   ✅ **Speed** (`float`): 차량의 측정 속도 [km/h]
*   ✅ **RPM** (`float`): 엔진 회전수 (Revolutions Per Minute)
*   ✅ **nGear** (`int`): 차량의 사용 기어 단수 (0은 중립을 의미함)
*   ✅ **Throttle** (`float`): 0-100 단위의 스로틀 페달 압력 [%]. *(종종 센서 에러 및 데이터 확인 불가 상태 시 104 값이 로깅될 수 있음)*
*   ✅ **Brake** (`bool`): 브레이크 페달 전개 여부 (True: 밟음 / False: 안 밟음)
*   ✅ **DRS** (`int`): 특정 번호(0~14 등)로 DRS 플랩의 활성화(Open) 및 비활성화(Closed) 상태를 가리키는 지시자

### 위치 센서 데이터 (Position Data Channels)
*   🔲 **X** (`float`): 트랙 상의 X축 좌표 [1/10 m 단위]
*   🔲 **Y** (`float`): 트랙 상의 Y축 좌표 [1/10 m 단위]
*   🔲 **Z** (`float`): 트랙 상의 Z축(고도) 좌표 [1/10 m 단위]
*   🔲 **Status** (`str`): 차량의 트랙 이탈 플래그 상태 판별 (예: `'OffTrack'` / `'OnTrack'`)

### 공통 계산 및 타임스탬프 속성 (Computed & Core)
*   ✅ **Time** (`timedelta`): 데이터 슬라이스(예: 현재 랩) 시작점(0) 기준의 상대적 경과 시간
*   ✅ **SessionTime** (`timedelta`): 세션(Session) 공식 시작 시점으로부터의 경과 시간
*   ✅ **Date** (`datetime`): 해당 샘플이 생성된 정확한 실제 시간(연월일 + 시분초)
*   ✅ **Source** (`str`): 이 샘플 행(Row) 정보의 생성 출처. (`'car'`: 오리지널 센서, `'pos'`: 오리지널 GPS, `'interpolated'`: 병합을 위해 보간된 가상 샘플)
*   🔲 **Distance** (`float`): 세션 시작(혹은 랩 시작) 기준 차량이 연속해서 주행한 누적 이동 거리 [m]. `calculate_distance()` 등을 통해 적분 계산됨.
*   🔲 **DriverAhead** (`str`): 트랙 위 내 바로 앞에 있는 드라이버의 엔트리 차량 번호 (계산 함수 통해 도출)
*   🔲 **DistanceToDriverAhead** (`float`): 앞에 있는 차량과의 물리적 거리 격차 [m] (계산 함수 통해 도출)

---

## 2. 개별 랩 및 타이밍 데이터 (Lap Timing Data)
> 패키지 모듈: `fastf1.core.Lap` & `fastf1.core.Laps`
> 드라이버별 각 바퀴(Lap)마다 집계되는 성적표 및 타이어 기록입니다.

### 타이밍 및 성적 (Timing Performance)
*   ✅ **LapTime** (`pandas.Timedelta`): 기록된 랩 소요 시간. 삭제 처리된 랩의 경우 `Deleted` 항목 체크 필요
*   ✅ **LapNumber** (`float`): 기록된 현재 주행 바퀴 수 (Lap Count)
*   ✅ **IsPersonalBest** (`bool`): 해당 랩이 드라이버 본인의 세션 내 최고 기록인지 여부 (트랙 이탈로 기록이 말소된 기록 제외 후)
*   🔲 **Sector1Time** (`pandas.Timedelta`): 섹터 1 기록 (Sector 1 recorded time)
*   🔲 **Sector2Time** (`pandas.Timedelta`): 섹터 2 기록 (Sector 2 recorded time)
*   🔲 **Sector3Time** (`pandas.Timedelta`): 섹터 3 기록 (Sector 3 recorded time)
*   🔲 **SpeedI1** (`float`): 섹터 1 스피드 트랩 통과 속도 [km/h] *(레드 플래그 상황에서 누락됨)*
*   🔲 **SpeedI2** (`float`): 섹터 2 스피드 트랩 통과 속도 [km/h] *(레드 플래그 상황에서 누락됨)*
*   🔲 **SpeedFL** (`float`): 피니쉬 라인 통과 속도 [km/h] *(피트인하는 랩이나 데르 플래그 상황 시 누락됨)*
*   🔲 **SpeedST** (`float`): 트랙에서 가장 긴 직선 구간에 위치한 메인 스피드 트랩(Speed Trap) 최고 속도 [km/h]
*   🔲 **Deleted** (`bool`): 트랙 리밋 위반 등 부정 주행으로 인해 이 랩 타임이 삭제(무효화)되었는지 여부
*   🔲 **Position** (`float`): 해당 랩을 마친 순간의 드라이버 레이스 실제 순위. *(본선, 스프린트에서만 제공. 예선(Q) 세션의 경우 NaN)*

### 타이어 관리 및 피트 (Tyres & Pit Stops)
*   ✅ **Compound** (`str`): 이벤트용 타이어 컴파운드 이름 (`SOFT`, `MEDIUM`, `HARD`, `INTERMEDIATE`, `WET`, `TEST_UNKNOWN`, `UNKNOWN`)
*   🔲 **TyreLife** (`float`): 해당 타이어가 실제로 굴러간 바퀴 수명. (퀄리파잉 등 이전 세션에서 쓰던 중고 타이어라면 이전 랩수까지 합산됨)
*   🔲 **FreshTyre** (`bool`): 스틴트 시작점 기준 이 타이어의 TyreLife가 0(새 타이어)이었는지 여부
*   🔲 **Stint** (`float`): 드라이버의 타이어 스틴트 구간 번호 카운트
*   🔲 **PitOutTime** (`pandas.Timedelta`): 차량이 차고에서 출발하여 피트 레인 출구를 통과한 세션 타이밍 시각
*   🔲 **PitInTime** (`pandas.Timedelta`): 차량이 피트 레인 입구를 통과하여 들어온 세션 타이밍 시각

---

## 3. 기상 상태 데이터 (Weather Data)
> 매 1분마다 측정되는 대회 환경 센서 관측 기록입니다. (`Session.weather_data`)

*   ✅ **Time** (`timedelta`): 측정된 세션 기준 경과 시각
*   ✅ **AirTemp** (`float`): 대기 기온 [°C]
*   ✅ **TrackTemp** (`float`): 노면 표면 온도 [°C]
*   ✅ **Humidity** (`float`): 습도 [%]
*   ✅ **Pressure** (`float`): 기압 [mbar]
*   ✅ **WindSpeed** (`float`): 풍속 [m/s]
*   ✅ **WindDirection** (`float`): 풍향 원형 각도 [0~360°]
*   ✅ **Rainfall** (`bool`): 경기장 내 실시간 강우 여부. (비가 올 경우 True)

---

## 4. 서킷 메타 정보 및 레이아웃 (Circuit Information)
> 공식 트랙 도면에 맞게 데이터를 정렬하고 위치를 매핑하기 위한 코너 및 마샬 데이터입니다. (`Session.get_circuit_info()`)
> X, Y (마커 위치), Number/Letter (코너명), Angle (지도 내 마커 각도), Distance (타이밍 동기화용 트랙 상 거리)를 Dataframe으로 반환합니다.

*   🔲 **corners**: 각 코너의 정보 (마커의 x/y 위치, Turn 번호 및 출발점으로부터의 거리 메트릭)
*   🔲 **marshal_lights**: 디지털 마샬 깃발(안내등)이 설치된 공간 맵핑 위치
*   🔲 **marshal_sectors**: 마샬 섹션의 X,Y,Z 위치 
*   🔲 **rotation** (`float`): 트랙 지도를 정확한 표준 방위로 그리기 위해 Y/X 축을 얼만큼 회전(Degrees)시켜야 하는지에 대한 상수값.

---

## 5. 이벤트 관리 단위와 트랙 규정 (Event & Race Control)
> 그랑프리 주말 전체 세션 구조, 포맷, 기록 및 실시간 안전 컨트롤 메시지를 획득할 수 있습니다.

### 세션 메인 객체 (Session Object)
*   ✅ **session_info**: 국가, 서킷, 미팅 시간 등 기초정보. (ETL에서 활용 중)
*   ✅ **total_laps**: 본선(Race) 및 스프린트(Sprint) 세션 등에서 예정된(기획된) 총 레이스 소화 바퀴 수.
*   🔲 **track_status**: 변경된 트랙 규정 코드 로그 문자열 (e.g. Yellow flag, Safety Car, Red Flag) 모음. 각 랩 객체(`Lap`)의 `TrackStatus`와 대응하여 맵핑 가능.
*   🔲 **race_control_messages**: 실시간 통제실 공지사항 
    * *공지 목록 예: DRS Enable/Disable 통보, 랩 타임 말소(`Track Limits`), 페널티 부과(`Time Penalty`), 드라이버 조사 착수 메시지 등 전체 통지*

### 공식 리절트 시트 (Results List)
> 세션 종료 후 공식적으로 집계되는 종합 포인트 및 순위 마감표입니다. (`Session.results`)

*   ✅ **DriverNumber**, **BroadcastName**, **TeamName**, **TeamColor**: 기초 드라이버 신상 및 UI 용 컬러코드
*   🔲 **Points** (`float`): 해당 세션 및 그랑프리에서 공식으로 획득한 월드 챔피언십 점수
*   🔲 **ClassifiedPosition** (`int`): 포스트 레이스 시간 페널티 등이 모두 정산 적용 완료된 공식 결선 피니시 순위
*   🔲 **GridPosition** (`int`): 결선(혹은 스프린트) 시작을 위해 대기한 스타트 위치 (그리드 패널티 적용 순위)
*   🔲 **Status** (`str`): 피니쉬 원인 지시자. 차량 결함에 따른 완주 실패 사유 제공(`Engine`, `Hydraulics`, `Collision` 등)이나 정상 완주 여부(`Finished`, `+1 Lap`)를 기록
*   🔲 **Q1, Q2, Q3** (`timedelta`): 예선의 각 단계별로 가장 빨랐던 세션 단위 랩타임 통과 기록 결과.
