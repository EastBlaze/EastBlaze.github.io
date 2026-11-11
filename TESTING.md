# 이력서 사이트 테스트 기준

이 문서는 현재 정적 이력서 UI와 `experiments/search`의 격리된 검색 실험에 적용한다. 테스트의 목적은 실행 횟수나 커버리지 숫자를 늘리는 것이 아니라 **공개 경력의 정확성, 입력의 비공개 처리, 탐색의 신뢰성**을 지키는 것이다.

운영 UI의 기준은 `index.html`, `index.js`, `index.css`, `projects.json`, `scripts/generate_resume.py`다. PR #8의 검색 실험은 운영 기능이 아니며, 테스트 통과는 모델 채택·병합·공개 배포 승인과 다르다. 검색 실험 자체의 통과를 별도 UI 제안(B4)의 승인으로 간주하지 않는다. 이후 사용자의 이력서 디자인 main 반영 요청은 아래 B4 통합 검증에서 별도로 다룬다.

## 0. 현재 배포 범위: 검색 일시 제외 (2026-11-11 UTC)

운영 페이지에는 **분야별 우선 보기**만 남긴다. 선택 분야의 관련 프로젝트를 위로 정렬하지만 전체 카드는 유지한다. `기본 순서`는 공개 데이터의 원래 순서를 복원한다. 검색 입력·분석 버튼·공유 버튼·검색 결과 요약은 없으며, 과거 `needs` URL 조건은 초기화·분야 변경·history 이동에서 무시하고 제거한다. `focus` 허용목록, 다른 query parameter 및 hash 보존은 유지한다.

현재 순수 로직은 `project-view.js`, DOM 연결은 `index.js`, 계약 검사는 `tests/project-view.test.cjs`에 있다. 운영 소스를 변형 없이 실행하는 작은 DOM fake로 검색 요소가 없어도 초기화되고, 로딩 중/실패 시 제어가 잠기며, 반복 정렬과 URL 복원이 정상인지 확인한다. 분야 6개 순서와 동점·전체 유지·기본 순서 복원은 독립 기대값으로 확인한다. 실제 geometry/키보드 초점·화면 품질까지 DOM fake가 보증하지 않는다.

```sh
node --test tests/*.test.cjs
node --check project-view.js
node --check index.js
python3 scripts/generate_resume.py --check
```

아래의 검색 입력·기술 일치·공유·분석/지우기 계약은 **검색을 다시 구현할 때의 기준**이며 현재 기능이나 통과한 검사가 아니다. 분야 정렬/URL/초기화 부분은 위 suite가 최신 근거다. PR8 기록은 `experiments/search/historical/pr8/`로 보존했으며 기존 수치·해시는 바꾸지 않았다. 실험 suite는 보존된 입력과 과거 측정의 무결성을 검증하고 현재 운영 UI나 새 추론을 검증하지 않는다. 새 측정/과거 재현의 분리 절차는 [실험 README](experiments/search/README.md)를 따른다.

## 1. 가치 있는 테스트의 작성 기준

테스트마다 다음 질문에 답한다.

1. **사용자가 잃는 것은 무엇인가?** 예: 사용하지 않은 기술을 사용했다고 표시한다, 공고 원문이 공유된다, 프로젝트를 읽을 수 없다.
2. **어느 신뢰경계가 책임지는가?** 데이터→순위, URL→상태, 상태→DOM, 모델 bytes→추론처럼 입력·출력·오류·부작용을 명시한다.
3. **기대값을 독립적으로 알 수 있는가?** 작은 수작업 fixture, 공개 근거, 별도 구현으로 판단한다. 실제 함수로 기대값을 다시 계산하는 검증만으로 정확하다고 하지 않는다.
4. **더 싼 계층에서 잡을 수 있는가?** 순수 함수/표준 라이브러리 테스트를 먼저 쓰고, 외부 자원은 경계에서만 대체한다. 우리 순위 함수나 검증기를 mock한 뒤 성공했다고 하지 않는다.
5. **어떤 잘못된 구현이면 실패하는가?** 기술/분야 표시 혼동, URL 허용목록 제거, 모델 해시 검증 생략, 오래된 결과 수용처럼 대표 결함을 지정한다. 중요한 계약은 작은 의도적 변형으로 한 번 확인한 뒤 복원한다.

정상값 하나뿐 아니라 빈 값, 경계값, 실패, 반복 요청, 순서 변경을 위험에 맞게 고른다. 한 테스트가 모든 기능을 지나가게 만들지 않는다. 순수 로직의 DOM snapshot, 시간 지연을 기다리는 테스트, 전체 CSS·소스 문자열·숫자 하나에 과도하게 묶인 assertion은 피한다. 현재 고정 실험의 출처 해시는 재현성을 위한 예외이지 UX 정확성의 증명이 아니다.

## 2. 실행 순서와 비용

1. 변경 파일·기존 계약·현재 branch를 확인한다. 문서 변경인지, 공개 근거 변경인지, 동작 변경인지 먼저 구분한다.
2. 해당 경계의 코드화된 테스트, 구문 검사, 생성물 일치 검사를 실행한다. 실패는 여기서 수정한다.
3. DOM adapter나 실제 HTTP handler 등 바뀐 연결부만 코드로 검증한다. 모든 순위 fixture를 브라우저에서 반복하지 않는다.
4. 브라우저 의존성이 바뀌었거나 아직 없는 보장을 출시하려는 경우에만 **소수의 코드화된 실제 브라우저 smoke**를 실행한다.
5. 코드로 판정하기 어려운 시각적 품질·키보드 체감·스크롤 움직임은 마지막에 컴퓨터/브라우저 사용으로 확인한다. 확인할 질문과 화면을 먼저 정하고 반복 탐색하지 않는다.

문서만 바뀐 PR에는 시각적 QA나 모델 재다운로드를 기본으로 요구하지 않는다. 새 테스트가 필요한데 아직 없으면 `미구현`으로 남기며, 수동 확인을 자동 회귀 검증처럼 보고하지 않는다. 토큰과 시간을 아끼기 위해 command와 요약을 재사용하되, 코드가 바뀌면 이전 결과를 재사용하지 않는다.

## 3. 현재 UI의 계약과 최소 검증 계층

| 경계 / 사용자 가치 | 지켜야 할 계약과 예시 | 가장 싼 유효한 검증 | 현재 상태 / 남은 일 |
|---|---|---|---|
| 공개 HTML·JSON → 화면/Markdown | 프로젝트 ID가 중복되지 않고 필요한 문자열·배열이 유효하다. 공개된 기술·성과·근거만 출력한다. HTML과 Markdown의 출처가 같고 JS 없이 Markdown을 읽을 수 있다. | JSON schema/fixture 검사, 생성기 단위 테스트, `generate_resume.py --check`, 로컬 파일 존재 검사 | Markdown drift 검사는 구현됨. 데이터 schema, 생성기의 누락/중복/잘못된 입력 테스트는 미구현. 경력의 사실 여부는 작성자 검토 필요. |
| 공고 문자열 → 인식 항목 | 한/영 별칭과 ASCII 단어 경계, 중복 제거를 명시한다. `GCP`는 Google Cloud이고 AWS 사용 근거가 아니다. 미기재 기술을 실제 사용 기술로 만들지 않는다. | 표 기반 순수 함수 테스트. 영문 부분 문자열, 대소문자, 공백, 문장부호, 한국어, 알려지지 않은 기술을 작은 fixture로 검사 | PR8에 GCP/미기재 기술 예제가 있음. 부정문 오인식은 알려진 한계이지 승인된 정답이 아니다. 더 넓은 입력 계약은 미구현. |
| 인식 항목·공개 근거 → 순위/설명 | 명시 기술과 분야 관련성을 분리한다. 기술 일치 수 우선, 다음 score, 동점은 원래 순서인 현재 규칙을 명시한다. 근거 없는 기술 충족률을 만들지 않는다. | 근거 한두 개의 수작업 fixture로 순위·매치 이유·점수 0·동점을 검증. 공개 corpus 전체 결과는 보조 회귀 검사 | PR8 adapter는 실제 운영 순위 코드를 읽지만 기본 `all` 역할만 검사한다. 모든 role/설명 계약은 미구현. 변경 승인 없이 부정문 한계를 고정 정책으로 만들지 않는다. |
| URL → 상태 → 공유 URL | `focus`와 `needs`는 허용된 키만 상태로 복원하고 중복을 제거한다. 공고 원문은 URL/clipboard에 추가하지 않는다. 공유는 선택 상태와 `#projects`를 전달하며 clipboard 거부 시 복사 안내가 가능하다. | URL 파서/serializer round-trip, 악성·미지·중복 값, clipboard 성공/실패 adapter 테스트 | 실제 구현은 있음. 자동 계약 테스트는 미구현. 현재 serializer는 다른 기존 query parameter를 보존하므로 “URL 전체가 allowlist”라고 주장하지 않는다. 전체 공유 URL 허용목록은 별도 설계 변경이다. |
| 입력·공개 데이터 → DOM/부작용 | 붙여넣은 공고를 저장·전송하지 않는다. 문자열은 텍스트로 렌더링한다. 원문이 fetch, beacon, storage, console, clipboard, URL로 나가지 않는다. | fake network/storage/clipboard/console에 sentinel 문자열을 넣은 adapter 검사. `<script>`/마크업을 텍스트로 다루는 DOM fixture | 현재 화면에 비전송·미저장 약속이 있다. 이 약속을 자동 검증하는 suite는 미구현. 정적 코드 검사만으로 런타임 누출 방지를 보증하지 않는다. |
| 데이터 로딩·사용자 이벤트 → 화면 상태 | 로딩 중 제어가 잠기고 성공하면 풀린다. 오류 시 읽을 수 있는 메시지와 정적 이력서는 남는다. 지우기는 원문/검색항목을 지우되 선택 분야는 유지한다. 같은 동작 반복에 카드가 중복되지 않는다. | DOM contract: 정상/HTTP 실패/잘못된 JSON·shape, 분석→지우기→재분석, 역할 변경, disabled/aria 상태 | 구현은 있으나 DOM suite는 미구현. 계약에는 전체 카드가 유지되는 현재 UI와 “관련 0개”를 구분한다. 검색 결과 없음이 빈 화면이라는 가정은 금지한다. |
| 카드 상태 → 강조/접근성 | hover와 키보드 focus를 구분하고 터치에서는 화면 중앙 카드를 고른다. 재렌더 시 observer를 정리한다. 맨 위 이동 후 초점이 잃어버려지지 않는다. | geometry/우선순위 함수 테스트 + observer cleanup spy. 실제 focus-visible, touch, viewport는 작은 브라우저 smoke | 자동 검증 미구현. 24px hysteresis는 현재 구현값이며 품질 목표가 아니다. 부드러움·시각적 명료성은 별도 UX 판단. |

운영 코드는 IIFE 안에 묶여 있다. 다음 동작 변경 때 필요한 순수 함수와 얇은 DOM adapter를 명시적인 seam으로 분리하고 동작 보존 테스트를 먼저 추가한다. 테스트 편의를 위해 전체 앱을 재작성하거나 운영 소스를 임의 문자열 치환하는 새 하네스를 늘리지 않는다. PR8의 고정 baseline 추출기는 재현 실험용이며 운영 UI 테스트 체계로 확장하지 않는다.

사이트가 외부 아이콘을 로드한다는 사실과 “공고 원문을 전송하지 않음”은 구분한다. 실제 브라우저에서는 허용된 정적 리소스 요청을 기록하고 입력 전후에 원문/그 파생 비밀값이 요청·저장·로그에 추가되지 않는지 검사한다. 외부 리소스 장애가 핵심 이력서 읽기를 막지 않는지도 smoke에 포함한다.

## 4. 격리된 검색 실험의 계약

| 경계 | 코드로 보장할 것 | 현재 증거와 한계 |
|---|---|---|
| corpus·query fixture → ranker | label/expected 결과는 encoder 입력이나 순위를 바꾸지 않는다. 공개 프로젝트 텍스트만 사용한다. fixture ID와 repetition이 유효하다. | label 변경 불변성, fixture 검증, 공개 텍스트 추출 테스트 구현됨. 동일 corpus에서 만든 30개 질의는 독립 품질평가가 아님. |
| 모델 파일 → tokenizer/encoder | manifest 크기·SHA-256 확인 후만 사용한다. 잘못된 tensor, 차원, non-finite vector를 거부하고 토큰 절단을 표시한다. | 모델 reader/경계 테스트 구현됨. tokenizer 독립 비교 45개/모델, Static-64 score 독립 비교 150개는 저장된 과거 증거. E5 embedding 값의 독립 대조는 아직 없음. |
| encoder → benchmark | 한 모델 실패가 다른 모델 실행을 막지 않고 전체는 incomplete다. session을 해제하고 실패가 성공 결과로 보이지 않는다. | fake encoder의 오류·해제 계약 구현됨. 실제 WASM/session 연결은 해당 라이브러리·모델 변경 때만 좁은 실제 자원 smoke로 확인. |
| 결과 → 보고서 | 코드·corpus·fixture·dependency lock 해시가 맞아야 한다. 오래되거나 불완전한 결과를 성공으로 요약하지 않는다. oracle suffix는 주 지표와 분리한다. | Node artifact 검사와 Python metric 테스트 구현됨. 결과가 동일하다는 것과 독립 품질이 좋다는 것은 다름. |
| 로컬 HTTP → 파일 | 경로 traversal, symlink 탈출, 외부 origin/host, 큰 body, 잘못된 JSON을 거부한다. 저장 성공과 실패를 구분한다. | handler 테스트 구현됨. 실경로는 OS별 문자열이 아니라 canonical path로 비교한다. handler 통과는 socket/브라우저 통합 성공이 아님. |

새 실패 fixture는 기대 오류와 이유를 함께 기록한다. snapshot만 업데이트하거나 provenance 해시를 무조건 다시 찍어 테스트를 녹색으로 만들지 않는다. hash가 바뀌면 원인과 재측정 필요성을 검토한다. 재현 실험을 새 입력에 갱신할 때는 결과·요약·독립 검증을 함께 갱신하고 같은 commit에 연결한다.

### 독립 검색 품질평가는 별도의 출시 조건

- 현재 30개 진단 케이스는 고정한다. 새 임계값·chunking·모델을 이 결과에 맞춘 후 같은 점수를 일반 정확도로 보고하지 않는다.
- 적법하게 사용할 수 있는 실제 공고나 별도 작성한 질의를 수집한다. 개발 집합과 holdout을 나누고 거의 같은 공고/템플릿은 같은 쪽에 둔다. 작성 출처와 corpus 버전을 기록한다.
- 모델 출력과 독립적으로 관련 프로젝트를 라벨링한다. 관련 없음, 복수 관련, 모호한 판단을 허용한다. 가능하면 별도 검토자가 이견을 조정한다. 자기 라벨만 있으면 그 한계를 밝힌다.
- 명시 기술, 한/영 바꿔 말하기, 긴 문서 뒤쪽 요건, 부정/선호 조건, 미기재 기술, 무관한 직무, 빈 입력을 포함한다. 빈 입력을 막는 제품 정책과 진단용 빈 입력 추론은 구분한다.
- 기존 lexical baseline과 비교하고 Hit@k/MRR 또는 복수 관련용 nDCG, 그룹별 결과, 관련 없음 오탐, abstention의 precision/coverage를 함께 보고한다. 표본 수·모호한 라벨·불확실성을 공개한다. 5개 후보의 Hit@3만으로 우수하다고 판단하지 않는다.
- 임계값·전처리·분할은 development에서만 정한다. holdout 결과를 보고 다시 조정했다면 그 집합을 새 holdout처럼 쓰지 않는다. `requirementsOnly`는 정답 suffix를 사용한 oracle이므로 자동 추출 성공률에 넣지 않는다.
- **의미 유사도는 기술 보유의 증거가 아니다.** 독립 품질 기준, 명시 기술 표시, abstention/빈 입력 정책, 긴 문서 처리, 브라우저 비용을 충족하기 전까지 운영 통합을 승인하지 않는다. 이번 문서는 그 기능을 구현하거나 채택하지 않는다.

## 5. 통합 검증에 남길 것

앞선 계약이 코드로 채워진 뒤 다음 소수의 연결 위험만 실제 브라우저에 남긴다. 아직 계약 suite가 없는 영역을 “검증 범위 축소”라는 이유로 생략하지 않는다.

1. **정적 진입·오류:** 로컬 HTTP에서 JSON/JS/CSS/Markdown이 연결된다. JSON 실패와 외부 아이콘 실패 때 본문/연락처/Markdown은 사용 가능하다. JS 비활성 경로는 정적 noscript 목록으로 확인한다.
2. **탐색 한 흐름:** 알려진 기술 검색 → 분야 선택 → 지우기 → 공유 상태 새로 열기. 카드/상태/URL의 연결, clipboard 실패, 키보드 focus를 확인한다. 자세한 순위 조합은 하위 테스트에 둔다. 현재 `replaceState`는 검색마다 history 항목을 쌓지 않으므로 Back/Forward가 검색 undo라는 가정을 하지 않는다.
3. **포인터·화면 한 흐름:** 키보드 focus-visible, touch 중앙 카드, 재렌더 후 강조, 맨 위 이동, 좁은 화면과 reduced motion. 실제 geometry·CSS·브라우저 API가 필요한 부분만 본다.
4. **실험을 변경한 경우만:** pinned 모델 1회 초기화와 대표 질의, 오류/재시도 상태, 결과 저장·해제. 향후 비동기 운영 검색에는 취소·연속 검색에서 최신 결과만 표시하는 계약을 먼저 만들고 오래된 결과 race smoke 하나를 추가한다. 현재 하네스에 운영 취소/worker 기능이 있다고 가정하지 않는다.

Safari와 Chromium 등 목표 엔진의 확인이 필요하면 바뀐 위험에 맞게 선택한다. MacMini의 desktop 실행이나 viewport 에뮬레이션을 iOS/Android 실기기 통과로 보고하지 않는다. 페이지가 이미 배포됐다는 이유로 배포본에 입력/자동화를 먼저 수행하지 않는다.

## 6. 성능과 주관적 UX는 따로 판단한다

- 기능 계약: 같은 입력에 올바른 기술/근거/상태가 출력되고 실패가 정직하게 드러나는가?
- UX: 카드의 위계, 가독성, 색/강조의 이해, 초점·스크롤 체감이 좋은가? 테스트 초록색만으로 디자인 승인이나 B4 승인을 대신하지 않는다.
- 성능: exact commit, 모델/runtime hash, OS/CPU·브라우저 버전, cold/warm cache, concurrency, 전원/부하 조건을 기록한다. 최초 전송량·사용 가능까지 시간, warm query 분포, 긴 task/UI 응답, 반복 실행 메모리·취소 후 회수를 구분한다.
- 중요한 사용자 대기·다운로드·메모리 예산은 **채택 결정 전에** 목표 기기에 맞게 정한다. 현재 승인된 숫자 예산은 없다. 임의 threshold나 1회 측정을 회귀 gate로 만들지 않는다. 안정된 runner와 반복 측정으로 변동폭을 안 뒤 regression budget을 정한다.
- Node WASM 수치는 browser/mobile 수치가 아니다. 현재 `no-store` 실험 서버와 측정 시작 전 JS import를 제외한 resource 목록으로 실제 배포 cache·총 전송량을 결론 내리지 않는다.

## 7. MacMini 테스트베드와 실행 명령

연결된 MacMini를 기본 로컬 테스트베드로 사용한다. 작업별 checkout/worktree, loopback 서버, 고유 port와 임시 출력 경로를 사용하며 다른 작업의 branch·서버·B4 산출물을 건드리지 않는다. repo 지침과 dirty 상태를 먼저 확인하고 사용자가 작업 중인 checkout은 reset/clean하지 않는다. 로컬 검증을 위해 회사 노트북으로 전환하지 않는다.

**가벼운 검증은 npm 설치·모델 다운로드·브라우저 없이 실행 가능하다.** 저장된 추론 결과의 무결성과 테스트 로직을 확인하는 것이며 새 모델 추론이 아니다.

```sh
# repository root; Node 22+, Python 3.9+
node --test experiments/search/tests.mjs
python3 -m unittest discover -s experiments/search -p test_summary.py
python3 scripts/generate_resume.py --check
node --check index.js
for file in experiments/search/*.mjs experiments/search/*.js; do node --check "$file"; done
python3 -m py_compile experiments/search/*.py scripts/generate_resume.py
git diff --check
```

실제 모델/의존성/encoder가 바뀔 때만 [실험 재현 절차](experiments/search/README.md#재현)를 따라 별도 설치·모델 검증·추론·독립 대조를 수행한다. Python dependency는 시스템 전역이 아닌 작업별 venv에 둔다. 새 측정은 `RESULTS_FILE` 등 별도 출력 경로를 쓰고 체크인된 증거를 실수로 덮어쓰지 않는다. `python3 experiments/search/download-models.py --verify-only`는 모델이 이미 있을 때만 유효하다.

MacMini의 Node 버전이 CI Node 24와 다르면 양쪽 결과를 구분한다. 임의로 시스템 Node를 바꾸지 않는다. 로컬이 통과해도 exact commit CI를 별도로 확인하며 CI가 안 돌았으면 `미실행`으로 표시한다.

### 변경별 요구사항

| 변경 | 먼저 실행할 코드 검증 | 추가 검증 조건 |
|---|---|---|
| 문서/테스트 기대 경로만 | 관련 기존 suite, Markdown drift, diff 검사 | 동작·화면 변경이 없으면 브라우저와 모델 재추론 불필요 |
| HTML/JSON/공개 경력 | schema/근거 검토, 생성기 검사, 관련 출력·순위 fixture | 화면 구조가 달라지면 해당 화면 smoke. 실험 입력 hash 변경은 의도적 증거 갱신 검토 |
| ranking/URL/DOM | 해당 계약 fixture와 오류·반복 경로, 영향받은 suite | 바뀐 연결/브라우저 API smoke만 |
| 모델/runtime/전처리 | 순수 계약, pinned bytes, 독립 parity/수치 대조, 작은 실제 추론 | 독립 품질평가와 목표 브라우저 비용 확인 후 채택 판단 |
| HTTP/배포 구성 | path/origin/byte limit 등 handler 계약, 정적 자원 경로 | loopback socket smoke. 공개 배포는 별도 승인 |

## 8. 현재 검증 공백과 다음 순서

1. **P0: 원문 비공개·공개 근거 계약.** URL/clipboard/network/storage sentinel, HTML text 렌더링, JSON shape, 기술 일치/관련 분야 분리를 코드화한다. 운영 코드 변경 시 우선 막아야 할 회귀다.
2. **P1: UI state 계약.** 역할, 분석/지우기/재분석, 로딩 오류, URL round-trip과 공유 실패, focus/observer cleanup을 코드화한다. 이 단계가 있어야 매번 수동 브라우저 탐색을 줄일 수 있다.
3. **모델 채택 작업을 시작할 때:** 독립 holdout, abstention/긴 문서 정책, E5 수치 독립 대조, 실제 브라우저 연결과 비용 측정을 수행한다. 기존 synthetic 점수가 높다는 이유로 앞당기지 않는다.

이번 변경은 기준 정리와 Mac 경로 테스트의 이식성 보정이다. 위 P0/P1을 이미 구현했다고 보고하지 않는다. 현재 자동 CI는 생성 Markdown 검사와 실험 회귀/지표/구문 검사이며, 운영 UI DOM suite·실제 브라우저 suite·배포 검증은 아니다.

## 9. PR 검증 보고 형식

- 변경한 계약 / 막는 사용자 피해 / 정확한 commit
- 실행기와 버전, 실행 command, 결과(통과·실패·미실행)
- 하위 계약에 넘긴 영역과 실제 브라우저에 남긴 위험
- 새 측정인지 저장된 artifact 검증인지, fixture·corpus·model 출처
- 미구현 검사·알려진 한계·추가 승인 필요 여부

테스트를 통과해도 공개 이력서에 새 주장을 쓰거나 실제 공고·사용자 원문·개인정보·credential·모델 가중치를 공개 repo/CI artifact에 넣지 않는다. 테스트 fixture는 공개/합성 데이터를 우선 사용한다. 원문을 사용하는 별도 평가가 필요하면 공개 저장 여부와 전달 대상을 따로 확인한다. 서버는 loopback 전용이며 실험 경로를 production에 자동 연결하지 않는다.

### 이 기준을 정리하면서 실행한 검증 (2026-11-10 UTC)

- 기준 commit: PR #8 `814c986360684e15e0a4d8065e9f31ae8b775e92`. MacMini의 Node v26.0.0, Python 3.9.6에서 실행했다. CI의 Node 24와 다른 환경이다.
- 첫 실행은 Node 22/23 통과였다. 경로 안전성 테스트가 macOS의 `/var` → `/private/var` alias 때문에 정상 파일의 원래 문자열과 canonical path를 다르게 비교했다. 기대값을 `realpath`로 바꿨으며 traversal·symlink 거부 assertion은 그대로 유지했다. 운영 서버 동작은 바꾸지 않았다.
- 보정 후 Node 23/23, Python metric 6/6, 생성 Markdown 일치, 운영 JS 및 실험 JS/Python 구문 검사가 통과했다. 모델/의존성 설치 없이 저장된 증거를 확인했다.
- 이번 작업에서 새 모델 추론, 독립 tokenizer/수치 재실행, 실제 브라우저·모바일·성능 검증, 공개 배포는 수행하지 않았다. 위 과거 독립 대조 수치를 MacMini에서 새로 측정한 결과로 읽으면 안 된다.

## Static release cache regression (2026-11-11 UTC)

The first search-pause deployment changed HTML and `index.js` at stable URLs.
A returning user's cached pre-pause JS could execute against new HTML and fail
at old line 411 (`#analyze-job` no longer exists), before loading project data.
Local smoke and fresh HTTP byte checks did not cover this mixed-release case.

Production now references content-hashed JS/CSS filenames. `build_assets.py --check`
and `tests/test_assets.py` enforce the HTML/source/served-byte relationship. A
cache fixture preserves previous-release bytes while changing all current source
files, and requires the new HTML to request different matching resource URLs.
The test failed on the original deployment links, then passed after generation.
Existing hashed assets are retained for older HTML. Run both asset checks in CI
and confirm project cards on the actual production URL after each release.

## B4 blueprint integration (2026-11-11 UTC)

The presentation is ported onto main `797edc058f0a334dff0aa4aa7eb8fb342d7b3df5`,
not copied over the search-pause and cache fixes. Current field ordering and
retired-needs cleanup remain unchanged. The B4 source's old search UI and runtime
are not imported. Original project facts and experiments are byte-preserved.

The source CSS consolidates the mockup's accumulated layers. `ui-controls.js`
contains theme and tooltip behavior and participates in release asset hashes.
Old hashed releases stay available. The Markdown generator now includes the
work-led heading and the original introduction moved to the skills section.

Code contracts verify all six field orders, repeated selection, legacy URLs,
loading and failures. Added presentation contracts verify every evidence text,
the canonical project index, focusable card names, and four cycles per rail.
The final browser smoke additionally checks desktop/mobile light/dark in
Chromium and WebKit, 320px/tablet/landscape overflow, no-JS fallback, failed data,
keyboard focus, tooltip Escape, theme switching, and continuous motion beyond
five seconds. Browser viewport emulation is not physical-device or screen-reader
certification. Screenshot review is separate from automated assertions.

Final local evidence: 9 UI contracts, 24 archived-experiment contracts, 6 Python
metric checks and 4 cache tests pass on MacMini (Node v26.0.0, Python 3.9.6).
All eight browser combinations pass; 320px/tablet/landscape and no-JS checks pass.
Actual screenshot inspection found a light-theme mobile anchor-offset specificity
bug, fixed before final rerun. Identity is now asserted below the sticky header.
Chromium axe reports no confirmed violations. Automatic contrast review remains
incomplete for one desktop project-index link and one mobile project-tech block;
that is not reported as a complete accessibility certification. The explicit
neutral colors retain B4's text contrast on opaque surfaces.

Independent review also found delayed project-fragment navigation: a copied
`#project-…` URL could resolve before async cards existed. One-time restoration
after initial rendering now respects any newer pointer/key/wheel/touch/hash
navigation or focus. Browser-managed scroll restoration during a slow reload
is allowed to settle at the requested project, rather than being mistaken for user input. A delayed-data contract verifies restoration,
cancellation and listener cleanup without moving focus.
