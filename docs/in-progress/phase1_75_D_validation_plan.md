# Phase 1.75 D항목 — 수학·물리 검증 계획

**작성일:** 2026-04-18  
**작성 주체:** Claude Code  
**검토 주체:** Gemini 3.1 Pro (Antigravity)  
**목적:** D항목 4개의 수학적 정합성을 Claude Code + Gemini 3.1 Pro 이중 합의로 확보하고, 검증 완료된 기능만 Phase 2에 배포한다.

> **규칙:** 이 문서의 각 항목은 Claude Code와 Gemini 3.1 Pro 양쪽 모두의 서명(검증 기록)이 있어야 배포 포함 가능. CLAUDE.md "수학·물리 모델 이중 검증 규칙" 참조.

---

## 검증 대상 항목 현황

| 항목 | 기능 | 구현 파일 | Claude 검토 | Gemini 검토 | 수정 구현 | 배포 가능 |
|------|------|----------|------------|------------|---------|---------|
| D-3 | 횡가속도(Lateral G) | `TrackMap.tsx` | ✅ 완료 | ✅ 완료 | ✅ 구현완료 | ⏳ UI검증 대기 |
| D-1 | 연료 보정 페이스 | `FuelCorrectedChart.tsx` | ✅ 완료 | ✅ 완료 | ✅ 구현완료 | ⏳ UI검증 대기 |
| D-4 | 트레일 브레이킹 | `TelemetryChart.tsx` | ✅ 완료 | ✅ 완료 | ✅ 구현완료 | ⏳ UI검증 대기 |
| D-2 | DRS 델타 분석 | `DrsAnalysisChart.tsx` | ✅ 완료 | ✅ 완료 | ✅ 구현완료 | ⏳ UI검증 대기 |

---

## D-3: 횡가속도(Lateral G-Force) — 🔴 우선순위 최고

### 현재 구현 (Claude Code 초안)

**파일:** `frontend/src/components/TrackMap.tsx` → `computeLateralG()`

```typescript
const dx1 = x1 - x0,  dy1 = y1 - y0   // 벡터 v1 (m 단위 가정)
const dx2 = x2 - x1,  dy2 = y2 - y1   // 벡터 v2
const cross = Math.abs(dx1*dy2 - dy1*dx2)
const len1  = Math.sqrt(dx1**2 + dy1**2)
const len2  = Math.sqrt(dx2**2 + dy2**2)

const kappa = cross / (len1 * len2 + 1e-6)   // ← 문제 지점
const v_mps = speed_kmh / 3.6
g[i] = Math.min((v_mps**2 * kappa) / 9.81, 8)
```

### Claude Code 자체 분석

`kappa = |v1 × v2| / (|v1| × |v2|)` 는 수학적으로 `sin(θ)` — 두 벡터 사이 각도의 사인값이며 **무차원수(dimensionless)**다.

올바른 곡률 κ의 단위는 **m⁻¹**이어야 한다:
```
κ (m⁻¹) = dθ/ds ≈ Δθ / Δs = sin(θ) / segment_length
```

따라서 현재 구현에는 `/ segment_length` 항이 누락되어 있을 가능성이 높다.

**추정 오류 크기:** F1 서킷에서 두 포인트 간 거리는 약 5~20m. 이를 나누지 않으면 κ값이 5~20배 과대 추정 → G값도 같은 비율로 왜곡.

**FastF1 좌표 단위 미확인:** X, Y, Z가 미터(m)인지 확인 필요. 미터가 아니면 v_mps 계산도 틀림.

### Gemini 3.1 Pro 검토 요청 사항

1. `kappa = |v1×v2| / (|v1|×|v2|)` 를 lateral_g = v²κ/9.81 에 대입했을 때 단위가 G(9.81 m/s²)로 올바르게 나오는가? 단위 추적(dimensional analysis) 결과를 제시해 달라.
2. 3점(x0,y0), (x1,y1), (x2,y2)으로부터 정확한 곡률 반지름 R을 구하는 외접원 공식과, 이를 TypeScript로 구현하는 코드를 제안해 달라.
3. FastF1 `get_telemetry()` 반환값의 X, Y, Z 좌표 단위는 무엇인가? (공식 문서 또는 소스 코드 근거)
4. Eau Rouge(Spa) 코너에서 F1 차량이 경험하는 실제 lateral G 범위는? (레퍼런스 포함)

### Gemini 검토 결과
*(Gemini 3.1 Pro가 직접 이 칸을 채워주세요)*

```
[결과 기록 영역]
- 단위 분석: 현재 공식의 `kappa`는 `sin(θ)`를 의미하는 무차원수이므로 곡률(m⁻¹)이 아닙니다. 곡률의 단위는 1/반지름(1/R)이어야 합니다.
- 수정 공식: 세 점을 이용한 외접원 반지름 공식을 사용하여 올바른 곡률(m⁻¹)을 구해야 합니다. `kappa = (2 * |v1 × v2|) / (|v1| * |v2| * |v3|)`
```typescript
const dx1 = x1 - x0, dy1 = y1 - y0;
const dx2 = x2 - x1, dy2 = y2 - y1;
const dx3 = x2 - x0, dy3 = y2 - y0;

const len1 = Math.sqrt(dx1**2 + dy1**2); // a
const len2 = Math.sqrt(dx2**2 + dy2**2); // b
const len3 = Math.sqrt(dx3**2 + dy3**2); // c

const cross = Math.abs(dx1*dy2 - dy1*dx2);

// 단위: m^-1
const kappa = (2 * cross) / (len1 * len2 * len3 + 1e-6);

const v_mps = speed_kmh / 3.6;
const lateralG = (v_mps**2 * kappa) / 9.81;
g[i] = Math.min(lateralG, 8);
```
- FastF1 좌표 단위: `pos_data` 기반의 X, Y 좌표는 통상적으로 미터(m) 단위로 제공되므로 m 단위로 간주하고 계산하면 됩니다.
- 검증 기준 G값: Eau Rouge (Spa) 등 최고속 코너에서는 4~6G 사이의 측면 G가 발생합니다. 최대 상한선인 8G는 안전장치로 적절합니다.
- 검증 판정: ❌ 수정 필요 (공식 단위 오류)
```
**Claude Code 수정 완료 (2026-04-20):** 외접원 반지름 공식 `κ = 2|cross|/(a·b·c)` 적용. TypeScript 컴파일 통과.

---

## D-1: 연료 보정 페이스(Fuel-Corrected Pace) — 🟠 우선순위 높음

### 현재 구현 (Claude Code 초안)

**파일:** `frontend/src/components/FuelCorrectedChart.tsx`

```typescript
// 기본 파라미터 (슬라이더로 조정 가능)
totalFuel    = 110    // kg — 레이스 시작 탑재량
fuelPerLap   = 1.8    // kg/lap — 랩당 소모량
lapTimePerKg = 80     // ms/kg — 1kg 감량 시 랩타임 이득

// 보정식
fuelLeft = max(0, totalFuel - lapNum × fuelPerLap)
corrected_ms = lap_time_ms + fuelLeft × lapTimePerKg
```

### Claude Code 자체 분석

**이론적 근거:** F1 차량 연료 1kg 감소 시 중력 하중 감소 → 타이어 마모 감소 + 코너링 속도 증가 → 랩타임 단축.

**파라미터 불확실성:**
- `fuelPerLap = 1.8 kg`: 문헌상 1.5~2.5 kg 범위. 서킷 길이·속도에 따라 다름.
- `lapTimePerKg = 80 ms`: 경험적 추정. 공식 발표된 F1 데이터 없음. 문헌에 따라 60~90 ms 범위.
- 슬라이더로 조정 가능하게 만든 것은 이 불확실성을 인정한 설계.

**보정식 한계:** 연료 소모가 선형이라 가정. 실제로는 연료 농도·엔진 맵핑에 따라 비선형.

### Gemini 3.1 Pro 검토 요청 사항

1. F1 규정 또는 모터스포츠 공학 문헌에서 `lapTimePerKg`의 신뢰할 수 있는 추정 범위는?
2. `fuelPerLap`을 레이스 거리와 FIA 연료 제한(110kg/레이스)으로 추정하는 식은?
3. 연료 무게 보정(Fuel-Correction)과 타이어 열화를 동시에 선형 모델로 분리하는 방법론이 있는가? (예: 다중선형회귀 `lap_time = α×tyre_life + β×fuel + ε`)
4. 이 보정식으로 생성된 커브가 "단조 증가(monotone increasing)"해야 열화 모델이 유효한가?

### Gemini 검토 결과
*(Gemini 3.1 Pro가 직접 이 칸을 채워주세요)*

```
[결과 기록 영역]
- lapTimePerKg 추천값 및 근거: F1 엔지니어링 경험 법칙(Rule of Thumb)에 따르면 10kg당 약 0.3~0.35초(30~35ms/kg)의 랩타임 이득이 발생합니다. 현재 80ms는 과도하게 높습니다. 기본값을 35ms로 수정하고 슬라이더 범위를 20~60ms로 좁히는 것을 권장합니다.
- fuelPerLap 추정 방법: `fuelPerLap = 110(kg) / 레이스 총 랩 수`를 동적으로 계산하여 사용하는 것이 가장 합리적입니다.
- 모델 개선안 (있다면): 복잡한 열화 다중선형회귀 모델 대신, 현재의 연료 감소식에 `35ms/kg` 파라미터를 사용하는 편이 가볍고 실시간 차트에 적합합니다. 
```typescript
const totalFuel = 110; // kg
const fuelPerLap = totalFuel / totalRaceLaps; // 레이스 총 랩 수 기준
const lapTimePerKg = 35; // ms/kg
```
- 검증 판정: ❌ 수정 필요 (경험적 파라미터 값 조정)
```
**Claude Code 수정 완료 (2026-04-20):** `lapTimePerKg` 80→35ms, `fuelPerLap` = totalFuel/maxLap 동적 계산, 슬라이더 범위 20~60ms. TypeScript 컴파일 통과.

---

## D-4: 트레일 브레이킹 구간 표시 — 🟡 우선순위 중간

### 현재 구현 (Claude Code 초안)

**파일:** `frontend/src/components/TelemetryChart.tsx` → `extractTrailBrakingZones()`

```typescript
const isTrail = !!brake && (throttle != null && throttle > 5)
// + 최소 지속 50ms 필터 (노이즈 제거)
```

### Claude Code 자체 분석

**정의:** 트레일 브레이킹 = 코너 진입 시 제동 중 스로틀을 서서히 여는 구간. `brake + throttle 동시 입력`으로 감지.

**불확실성:**
- FastF1 `Brake` 채널이 boolean(0/1)인지 연속값(0~100%)인지 코드에서 boolean 처리 중이나 실제 데이터 특성 미확인.
- `throttle > 5%` 임계값: 너무 낮으면 센서 노이즈 포함, 너무 높으면 실제 트레일 브레이킹 미감지.
- 50ms 필터: 18Hz 샘플링에서 약 1포인트 — 충분한가?

### Gemini 3.1 Pro 검토 요청 사항

1. FastF1 telemetry에서 `Brake` 채널의 실제 타입과 값 범위는 무엇인가?
2. 트레일 브레이킹을 정량적으로 감지하기 위한 표준 임계값(throttle %, 최소 지속 시간)이 레이싱 데이터 분석 문헌에 제시된 것이 있는가?
3. 현재 50ms 최소 지속 시간이 F1 18~20Hz 샘플링에서 충분한 노이즈 필터인가?

### Gemini 검토 결과
*(Gemini 3.1 Pro가 직접 이 칸을 채워주세요)*

```
[결과 기록 영역]
- Brake 채널 특성: 프로젝트 CLAUDE.md 및 DB 스키마에 따르면 Brake는 Boolean(0/1)로 처리/저장되고 있습니다. 따라서 연속적인 브레이크 압력의 감소율은 알 수 없으므로, Brake=1과 Throttle 활성화의 중첩 구간으로 유추해야 합니다.
- 추천 임계값: `brake === 1 && throttle > 2` (스로틀 2% 이상은 센서 노이즈가 아닌 의도적 입력으로 간주)
- 최소 지속 시간 권장: 50ms는 20Hz 텔레메트리 기준 1포인트에 불과하여 센서 디싱크 노이즈일 확률이 매우 높습니다. 최소 **200ms (약 4샘플)** 이상 중첩이 지속될 때만 유효한 트레일 브레이킹/동시 입력으로 간주하도록 필터를 강화하세요.
- 검증 판정: ❌ 수정 필요 (노이즈 필터 시간 연장 및 임계값 명시)
```
**Claude Code 수정 완료 (2026-04-20):** throttle 임계값 5→2%, 최소 지속 50→200ms. TelemetryChart `extractDrsZones`도 `drs>=8`로 동시 수정. TypeScript 컴파일 통과.

---

## D-2: DRS 델타 분석 — 🟡 우선순위 중간

### 현재 구현 (Claude Code 초안)

**파일:** `frontend/src/components/DrsAnalysisChart.tsx`

```typescript
// DRS 존 내 최고속도 비교
maxSpeed  = max(speed[zone_start:zone_end])
entrySpeed = speed[zone_start - 3]          // 활성화 3포인트 전
speedGain  = maxSpeed - entrySpeed
```

### Claude Code 자체 분석

**한계:**
- `speedGain`이 DRS 효과인지, 단순 가속 중인 것인지 구별 불가.
- 진정한 DRS 효과 = `drs=1(사용 가능, 미사용)` 구간의 속도 vs `drs=2(사용 중)` 구간 비교.
- FastF1 `drs` 채널값이 0, 1, 2 외 다른 값(8, 10, 12 등)을 가질 수 있는지 미확인.

### Gemini 3.1 Pro 검토 요청 사항

1. FastF1 `drs` 채널의 가능한 값 목록과 각 값의 의미는? (0=불가, 1=가능, 2=활성 외 다른 값?)
2. DRS 공력 효과(항력 감소, 속도 이득)를 텔레메트리 데이터만으로 정량화하는 올바른 방법은?
3. 같은 서킷의 여러 랩 또는 세션에서 팀별 DRS 효율을 비교할 때 필요한 통제 변수는?

### Gemini 검토 결과
*(Gemini 3.1 Pro가 직접 이 칸을 채워주세요)*

```
[결과 기록 영역]
- DRS 채널 값 의미: FastF1에서 `drs` 채널 값은 0(불가), 8(활성), 10/12/14(활성/열림) 등으로 나타납니다 (0, 1, 2, 3은 비활성). 따라서 단순히 값이 >0인지가 아니라 `drs >= 8`을 기준으로 DRS 활성화 여부를 판별해야 합니다.
- DRS 효과 정량화 방법: 속도 이득(`speedGain`) 전체를 DRS 효과로 보는 것은 수학적으로 무리가 있습니다 (일반적인 엔진 가속도 포함되므로). UI 상에서 이를 "DRS Effect"가 아니라 "DRS Zone Speed Gain"으로 명명하여 DRS를 포함한 직선 가속 성능 지표임을 명확히 하세요.
- 통제 변수: 진정한 비교를 위해서는 동일한 연료량(비슷한 랩 수), 타이어 수명, 슬립스트림(앞차와 1초 이내) 여부가 통제되어야 합니다. UI 툴팁으로 "연료량과 슬립스트림에 따라 속도 이득은 달라질 수 있습니다"라는 한계점을 고지할 것을 제안합니다.
- 검증 판정: ❌ 수정 필요 (DRS 활성 조건 drs >= 8 적용 및 지표 명칭 변경)
```
**Claude Code 수정 완료 (2026-04-20):** `drs >= 8` 조건 적용, Y축·툴팁 명칭 "DRS Zone Speed Gain"으로 변경, 한계 문구 추가. TypeScript 컴파일 통과.

---

## 검증 후 처리 규칙

### Gemini가 "수정 필요" 판정 시
1. Gemini가 수정 공식을 이 문서에 기록
2. Claude Code가 수정 구현 후 TypeScript 컴파일 확인
3. Antigravity가 UI에서 물리적 타당성 재확인
4. 양쪽 통과 시 → 해당 항목 `✅ 배포 가능`으로 갱신

### 검증 완료 시
- 이 문서를 `docs/completed/phase1_75_D_validated.md` 로 이동
- CLAUDE.md 현재 진행 중인 작업 → "D항목 검증 완료, Phase 2 준비 시작"으로 갱신
- plan.md Phase 1.75 항목 최종 업데이트

---

## Gemini 3.1 Pro에게 전달할 프롬프트

```
당신은 모터스포츠 텔레메트리 데이터 분석 플랫폼의 수학·물리 모델 검증자입니다.
아래 문서는 F1 텔레메트리 분석 플랫폼(FastF1 → MySQL → FastAPI → React)의
D항목 분석 모델 구현 현황과 Claude Code의 자체 분석입니다.

각 항목에 대해:
1. 제시된 수식의 단위(dimensional analysis) 검증
2. 파라미터의 물리적 타당성 검토
3. 더 정확한 공식 또는 파라미터 제안 (TypeScript 코드 포함)
4. 검증 판정: ✅ 통과 / ❌ 수정 필요 (수정안 포함)

각 항목의 "Gemini 검토 결과" 칸에 결과를 직접 기록해 주세요.
특히 D-3(횡가속도) 곡률 공식의 단위 오류 여부를 최우선으로 검토해 주세요.

[이 파일 전체 내용 첨부]
```
