# 검색 실험: 과거 PR #8 기록과 새 실험

**운영 검색은 일시 제외합니다. 이 디렉터리의 기존 측정은 현재 배포 UI의 성능·품질 검증이 아닙니다.** 모델은 운영 페이지에 연결하지 않습니다.

## 보존한 과거 기록

[PR #8 당시 보고서](historical/pr8/experiments/search/README.md)의 수치와 한계는 당시 입력에만 적용됩니다. 결론, 시간 측정, tokenizer parity, 요약, provenance를 새 결과처럼 다시 쓰지 않았습니다.

- `historical/pr8/`의 운영 파일 5개(`index.js`, `index.html`, `index.css`, `projects.json`, `resume.md`)는 측정 기준 커밋 `4a1e9798d7414df244348b1af313300293702157`에서 그대로 복사했습니다. 당시 검색 구현도 여기서 복구할 수 있습니다.
- 그 아래 `experiments/search/` 전체는 변경 전 main `c56f61d681e758d54c025d56772cc5cf89e53551`의 원본입니다. 결과, parity, summary, provenance 및 이들이 지문으로 참조하는 실행 코드와 잠금 파일의 바이트를 보존했습니다.
- `historical/manifest.json`은 각 파일의 원본 커밋과 SHA-256을 기록합니다. 당시 결과 안의 해시는 수정하지 않았습니다.
- 보존된 문서 안의 “현재”, “운영 파일은 변경하지 않았다”, 재현 명령 및 상대 링크는 **당시 상태**를 설명합니다. 현 운영 UI에 대한 설명은 저장소 루트 문서를 따릅니다.

아래 검사는 모델 다운로드나 추론 없이 보존된 결과가 보존된 입력과 일치하는지, 현재 하네스의 순수 함수·서버 계약이 유지되는지 확인합니다. 운영 파일을 과거 해시에 맞추도록 요구하지 않습니다. 새 운영 UI의 회귀 검사는 별도로 실행해야 합니다.

```sh
cd experiments/search
npm test
python3 -m unittest test_summary.py
```

## 과거 실험 재현

원본 스냅샷 안에서 직접 실행해 기록을 덮어쓰지 말고, 별도 임시 디렉터리로 복사해 실행합니다. Node 22+, Python 3.9+, npm 및 모델 다운로드 연결이 필요합니다. 모델은 약 50MB이며 저장소에 포함하지 않습니다.

```sh
# experiments/search 디렉터리에서
repro="$(mktemp -d)"
cp -R historical/pr8/. "$repro/"
cd "$repro/experiments/search"
npm ci
python3 download-models.py
node run-node.mjs
python3 summarize.py
python3 -m pip install tokenizers==0.22.1 numpy
python3 verify-tokenizers.py
npm test
python3 -m unittest test_summary.py
```

새 실행은 같은 과거 소스를 사용해도 시간·환경·결과 해시가 달라질 수 있습니다. 이는 새 측정이며 체크인된 과거 수치를 재검증한 실행으로 부르지 않습니다. 이 보존 작업에서는 모델 다운로드, 추론, 실제 브라우저 실행을 하지 않았습니다. 원본 보고서의 브라우저·모바일 미검증 한계도 그대로입니다.

## 현재/새 소스로 실험하기

최상위 `run-node.mjs`와 `run.mjs`는 **현재 저장소 루트**의 `index.js` 및 `projects.json`을 읽고 현재 하네스의 지문을 기록합니다. 기본 출력은 `results-fresh.json`이며, `summarize.py`와 `verify-tokenizers.py`도 이 파일을 읽고 각각 `summary-fresh.json`, `tokenizer-parity-fresh.json`에 씁니다. `RESULTS_FILE`로 결과 파일을 선택할 수 있습니다.

검색을 일시 제외한 운영 소스에는 기존 baseline 추출 경계가 없으므로 현재 하네스로 새 비교 실행은 성공하지 않을 수 있습니다. 이 실패를 과거 소스로 몰래 대체하거나 과거 해시를 갱신해서 통과시키지 않습니다. 향후 검색 연구에서 baseline 계약을 명시적으로 정하고 새 입력·결과·독립 검증을 함께 만들어야 합니다. 과거 소스 비교가 목적이라면 위 복사본 재현 절차를 사용합니다.

새 결과를 분석하는 도구는 현재 입력 해시가 다르면 거부합니다. `npm test`와 Python 단위 테스트 통과만으로 새 측정 결과나 현재 운영 검색이 검증되지는 않습니다. 모델 채택·운영 통합·배포 승인은 별개입니다.

새 실험의 기존 실행 옵션(`MODELS_DIR`, `RESULTS_FILE`, `CHROMIUM_PATH`, `node run.mjs --serve`)은 유지합니다. 로컬 서버는 127.0.0.1 전용이며 공개 서버로 쓰지 않습니다. 모델/토크나이저 방법론과 원래 제약은 [과거 보고서](historical/pr8/experiments/search/README.md), 향후 검증 기준은 [TESTING.md](../../TESTING.md)를 참고하세요.
