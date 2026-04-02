# FastF1 API 확장 데이터 레퍼런스

현재 F1 Telemetry Analytics 프로젝트(Phase 1)에서는 랩 타임, 기본 날씨, 기본 브레이크/스로틀/기어 등 **가장 핵심적인 텔레메트리**만 선별하여 수집하고 있습니다. 
하지만 FastF1 API는 공식 F1 라이브 타이밍 데이터를 기반으로 훨씬 방대하고 디테일한 정보를 제공합니다. 

Phase 2, Phase 3에서 추가적으로 DB에 적재하여 프론트엔드 대시보드를 풍부하게 만들 수 있는 **"현재 미사용 중인 추가 데이터"**를 정리했습니다.

---

## 1. 정밀한 트랙 위치 및 차량 주행 궤적 (Position Data)
현재 ETL은 속도, RPM 등 센서 데이터(`car_data`)만 가져오고 있으며, X/Y 좌표는 NULL로 처리되어 있습니다.
API의 `pos_data`를 함께 병합하면 다음 데이터가 제공됩니다.

*   `X`, `Y`, `Z` : 트랙 위 차량의 3차원 위치 좌표
*   `Distance` : 해당 시각에 차량이 출발 선으로부터 이동한 누적 거리 (트랙 위치 산출용)
*   **활용 방안**: 
    - **트랙 맵 시각화**: 프론트엔드에서 드라이버의 실제 주행 궤적(Track Map)을 ECharts나 D3.js로 그릴 판을 깔 수 있습니다.
    - **속도 히트맵**: 트랙 지도 위에 오버레이하여 어떤 코너에서 브레이킹을 늦게 가져갔는지 색상으로 표시(Heatmap)할 수 있습니다.

## 2. 서킷 메타 정보 (Circuit Information)
API의 `Session.get_circuit_info()`는 해당 그랑프리 서킷의 정밀 마커 데이터를 제공합니다.

*   `corners` : 각 코너의 번호(ex: Turn 1, Turn 2A), X/Y 좌표, 진입 각도(Angle), 출발선부터의 거리(Distance)
*   `marshal_lights` & `marshal_sectors` : 서킷 곳곳에 배치된 마샬(안전요원) 포스트 및 섹터의 위치 좌표
*   `rotation` : 공식 트랙 맵과 방위각을 일치시키기 위한 지도 회전 각도(Degrees)
*   **활용 방안**: 
    - 트랙 맵을 그릴 때 단순히 선만 긋는 것이 아니라, **특정 텔레메트리 데이터가 "몇 번 코너"에서 발생했는지 매핑**할 수 있습니다 (예: 헤어핀 코너 분석).

## 3. 타이어 전략 세부 데이터 (Tyre & Stint Data)
`Laps` 오브젝트에는 랩 타임뿐만 아니라 타이어 관리에 대한 아주 귀중한 정보가 포함되어 있습니다.

*   `Compound` : 장착한 타이어 종류 (SOFT, MEDIUM, HARD, INTERMEDIATE, WET)
*   `TyreLife` : 해당 타이어가 몇 랩째 사용되고 있는지(Age)
*   `FreshTyre` : 이번 스틴트에 끼운 타이어가 새 타이어(True)인지 중고 타이어(False)인지 여부
*   `Stint` : 해당 랩이 드라이버의 몇 번째 타이어 스틴트 구간인지
*   `PitOutTime` / `PitInTime` : 피트인/피트아웃 정확한 시간 정보
*   **활용 방안**: 
    - 타이어 컴파운드별 **데그라데이션(타이어 마모도에 따른 랩타임 저하) 차트**를 구현할 수 있습니다.
    - 각 드라이버의 **피트스탑 전략 타임라인 차트(Stint Chart)** 그리기 (예: "버스타펜은 15랩에 Hard 타이어로 교체함").

## 4. 섹터별 정밀 랩 타임 & 스피드 트랩 (Sectors & Speed Traps)
LAP 오브젝트는 단순히 `LapTime` 외에도 트랙을 3구간으로 나눈 세부 데이터를 가집니다.

*   `Sector1Time`, `Sector2Time`, `Sector3Time` : 각 섹터별 통과 시간
*   `SpeedI1`, `SpeedI2`, `SpeedFL`, `SpeedST` : 첫 번째 속도 측정점, 두 번째 측정점, 피니쉬 라인, 그리고 **가장 긴 직선구간에 위치한 최고속도 측정점(Speed Trap)**의 통과 속도(km/h)
*   `IsPersonalBest` : 해당 랩이 드라이버의 개인 최고 기록인지 여부
*   `Position` : 해당 랩 종료 시점의 실제 레이스 순위
*   **활용 방안**:
    - "드라이버 A가 섹터 1에서는 B보다 빨랐지만, 직선 위주의 섹터 3에서 손해를 봤다"와 같은 **섹터별 유불리 분석** 가능.
    - **레이스 랩 차트 (Lap Chart)**: 각 랩마다 드라이버들의 순위(Position)가 어떻게 변했는지 꺾은선으로 시각화.

## 5. 레이스 컨트롤 메시지 & 트랙 상태 (Race Control & Status)
실시간 경기의 흐름을 읽을 수 있는 공식 FIA 메시지들을 그대로 수집할 수 있습니다.

*   `Session.race_control_messages` : 
    - 트랙 리밋 위반 경고 ("Track limits T4")
    - 페널티 부과 내용 ("5 second time penalty for Car #1 - Causing a collision")
    - DRS 사용 활성화/비활성화 시점 ("DRS ENABLED")
*   `Session.track_status` : 
    - 트랙의 위험/안전 상태 (1=Green, 2=Yellow, 4=Safety Car, 5=Red Flag, 6=VSC)
*   **활용 방안**:
    - 대시보드 우측 하단에 **"레이스 컨트롤 Ticker(전광판)"** 디자인 추가.
    - 텔레메트리 차트의 배경색을 칠하여 "이 구간에서 속도가 줄어든 이유는 **VSC(가상 세이프티카)** 때문이었다"라는 컨텍스트를 사용자에게 제공.

## 6. 공식 레이스 결과 분류 (Driver Results)
`Session.results` 에는 경기가 끝난 후 공식 기록이 상세히 집계되어 있습니다.

*   `ClassifiedPosition`, `GridPosition` : 패널티가 적용된 최종 공식 순위 및 스타트 그리드 순위
*   `Points` : 해당 세션에서 획득한 월드 챔피언십 포인트 
*   `Status` : "Finished", "+1 Lap", "Collision", "Engine" 등 최종 리타이어(DNF) 원인
*   **활용 방안**:
    - 라운드를 선택하면 차트 출력 전, 상단에 **해당 세션의 공식 순위 포디움(1, 2, 3위) 및 패스티스트 랩 스코어보드** 표시 가능.

---

### 결론 및 향후 로드맵 추천
현재 Phase 1에서는 데이터 파이프라인의 핵심 뼈대(`Lap Time`, `Telemetry(Speed/Brake 등)`)를 성공적으로 구축했습니다.
이후 고도화(Phase 3) 시점에 위 데이터 중 **Positional X/Y 벡터, Tyre Stints(타이어 전략), Sector Times(섹터별 랩타임)** 세 가지를 DB 스키마에 컬럼으로 추가만 해주면, 곧바로 프로페셔널한 F1 모터스포츠 전략 대시보드로 탈바꿈시킬 수 있습니다.
