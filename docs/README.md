# F1 Telemetry Analytics — 문서 구조 가이드

> 이 프로젝트의 모든 문서는 이 `docs/` 디렉토리에서 관리됩니다.
> AI(Claude Code, Antigravity)와 개발자 모두 이 규칙을 따릅니다.

---

## 폴더 구조 및 배치 규칙

```
docs/
├── plan/          # 기획·설계 문서 (Phase별 로드맵, Step 상세 스펙)
├── in-progress/   # 현재 진행 중인 작업 스펙 (작업 시작 시 생성, 완료 시 completed로 이동)
├── completed/     # 완료된 작업의 최종 기록 (변경 없이 보존)
└── reference/     # 외부 API, 기술 스펙, 의사결정 기록 (ADR)
```

---

## 각 폴더 상세 설명

### `docs/plan/`

**목적:** 전체 로드맵과 Phase별 상세 구현 계획을 보관합니다.

**배치 기준:**
- 전체 프로젝트 로드맵 (`plan.md`)
- Phase별 상세 스펙 (`phase1_plan.md`, `phase2_plan.md`, ...)
- 아직 시작하지 않은 미래 Phase 계획도 여기에 위치

**파일 명명 규칙:** `phase{N}_plan.md` 또는 `plan.md`

**예시:**
```
docs/plan/
├── plan.md            # 전체 로드맵 (Phase 1~3)
├── phase1_plan.md     # Phase 1 + 1.5 상세 스펙
├── phase2_plan.md     # Phase 2 배포 계획 (Phase 1 완료 후 작성)
└── phase3_plan.md     # Phase 3 AI/수익화 계획 (Phase 2 완료 후 작성)
```

---

### `docs/in-progress/`

**목적:** 현재 활발히 작업 중인 Step/기능의 작업 스펙을 임시 보관합니다.

**배치 기준:**
- 새 Step을 시작할 때 작업 스펙 파일을 이 폴더에 생성
- 해당 Step이 완료되면 `docs/completed/`로 이동
- 동시에 여러 파일이 있을 수 있음 (병렬 작업 시)

**파일 명명 규칙:** `step{N}{suffix}_spec.md`

**예시:**
```
docs/in-progress/
└── step11_spec.md     # Step 11 작업 스펙 (진행 중)
```

---

### `docs/completed/`

**목적:** 완료된 Step의 구현 기록을 영구 보관합니다. 향후 유사 기능 구현 시 레퍼런스로 활용합니다.

**배치 기준:**
- `in-progress/`에서 이동된 완료 스펙
- 완료 후 내용을 수정하지 않음 (불변 레코드)
- 완료 날짜와 커밋 해시를 파일 헤더에 기록

**파일 명명 규칙:** `step{N}{suffix}_completed.md`

**예시:**
```
docs/completed/
├── step09_completed.md    # 랩 데이터 확장 완료 기록
├── step10_completed.md    # 레이스 결과 화면 완료 기록
└── step10b_completed.md   # 동팀 드라이버 시각 구분 완료 기록
```

---

### `docs/reference/`

**목적:** 외부 라이브러리 API 스펙, 기술 결정 기록(ADR), 데이터 스펙 등 변하지 않는 참조 자료를 보관합니다.

**배치 기준:**
- 외부 API/라이브러리 레퍼런스 (`fastf1_api.md`)
- 아키텍처 의사결정 기록 (ADR: Architecture Decision Record)
- DB 스키마 전체 정의, 환경변수 스펙 등

**파일 명명 규칙:** 자유롭게 설명적인 이름 사용

**예시:**
```
docs/reference/
├── fastf1_api.md          # FastF1 라이브러리 데이터 스펙
├── adr_db_partitioning.md # ADR: MySQL RANGE 파티셔닝 선택 이유
└── adr_echarts_vs_d3.md   # ADR: ECharts 선택 이유
```

---

## AI 세션 간 인계 규칙

| 상황 | 행동 |
|------|------|
| 새 Step 시작 | `docs/in-progress/step{N}_spec.md` 생성 |
| Step 완료 | `in-progress` → `completed`로 이동 (`git mv`) |
| 새 Phase 계획 수립 | `docs/plan/phase{N}_plan.md` 생성 |
| 외부 API 조사 결과 | `docs/reference/` 에 저장 |

## `CLAUDE.md`와의 관계

`CLAUDE.md`는 프로젝트 루트에 위치하며 AI 세션 컨텍스트를 담습니다.
`docs/`의 파일들은 상세 스펙과 기록을 담으며, `CLAUDE.md`에서 해당 파일로 링크합니다.

- `CLAUDE.md` → 세션 간 핵심 컨텍스트 (진행 현황, 다음 할 일, 주의사항)
- `docs/plan/` → 상세 구현 스펙 (CLAUDE.md에서 링크로 참조)
- `docs/completed/` → 완료 기록 (필요 시 참조)
