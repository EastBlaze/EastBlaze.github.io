# Independent review and refactor

## Decision

Keep E5 Tiny as a candidate for a separate, real-job-description evaluation. This experiment does not justify replacing production keyword matching, publishing a technology-fit percentage, or choosing an abstention threshold. The change is confined to the isolated experiment and its regression CI; production site files are unchanged.

The refactor preserves the original corpus, 30 queries, labels, ranking rules, and encoder math. A fresh Node WASM run produced exactly the same 90 ordered, scored ranking lists (30 cases × 3 methods) as the previous run. Timing changes are ordinary new measurements, not a demonstrated speedup.

## Findings and resolution

### 1. High: old output could be mistaken for verification of new code

The original tests checked a stored result file and a parity JSON with `exactIdMatches: 30`, but did not bind them to the query fixtures, encoder implementation, or corpus. Updating a query or the encoder could leave those tests green. Model files were verified only by the downloader, not at inference.

Fixed: results now contain SHA-256 values for every declared experiment input and every model file actually consumed. Model bytes are verified before parsing/inference. Tests compare current input hashes, expanded queries, labels, document texts, lexical rankings, and complete result coverage. Tokenizer and summary outputs identify the exact result bytes and verifier source. These checks detect stale artifacts; they are not a claim of cryptographic attestation against an adversarial local author.

### 2. High: failure and successful completion were not distinguished

A model exception was caught and recorded, but the browser still displayed `Complete`; Node exited successfully. Saving browser results also ignored a non-success HTTP status.

Fixed: an incomplete run is marked explicitly, the other model can still finish for diagnosis, Node exits nonzero, and browser save failures are surfaced. Python summary and parity scripts reject incomplete results. Sessions and inference tensors are released. Direct repeated browser calls are rejected while a run is active.

### 3. Medium: Node and browser were connected through source-string rewriting

Node rewrote browser imports and session construction, imported the modified source through a data URL, and patched global fetch/DOM objects. A small source change could bypass a replacement or silently change execution.

Fixed: pure `core.mjs`, injected `encoders.mjs`, shared integrity helpers, and thin environment-specific entrypoints. Only the existing lexical adapter still extracts definitions from the pinned production IIFE, deliberately avoiding production edits. Its expected wrapper and extraction boundary now fail closed when the source structure changes.

### 4. Medium: tokenizer parity omitted retrieval documents and truncation boundaries

Query-only parity did not verify `passage:` tokenization of the indexed corpus. Both long samples were far beyond the boundary and could not catch off-by-one regressions close to 512 tokens.

Fixed: independent Rust tokenizer checks now cover, per model, 30 queries, 5 project passages, 2 oracle-tail probes, and 8 empty/near-boundary inputs. All 45/45 inputs match for each model. E5 project documents are 49–84 tokens and none is truncated. Static pooling matches the independent NumPy calculation across 150 scores to maximum absolute error 3.33e-16. E5 embedding values themselves have not been compared with an independent Python model execution.

### 5. Medium: local server accepted oversized/cross-site result writes too loosely

The original body limit was checked only after reading the entire request; a loopback endpoint could accept a cross-site POST. The path check did not address symlinks, and persistence errors were reported as 404s.

Fixed: incremental byte limits, exact loopback Host validation, same-origin JSON POSTs, atomic result replacement, realpath containment including symlinks, method restrictions, and meaningful failure status codes. Request-handler tests cover these without opening browser sockets. This is still a local development server, not a production server or security-audited public service.

### 6. Low: model-directory override was inconsistent

The runners/verifier honored `MODELS_DIR`, but the downloader always wrote to its own `models/` directory.

Fixed: all routes use the override; download writes are atomic and `--verify-only` checks existing bytes without using the network.

## Leakage, corpus, and methodology assessment

- **No relevance-label input to the rankers was found.** Embedding documents use only public title, subtitle, tags, evidence text, and technology names. The lexical adapter uses the existing public card metadata. A regression test changes labels and verifies that encoder inputs and all rankings remain unchanged.
- **The query set is not independent.** All 30 examples were authored from the same five projects. There is no separate holdout, external annotator, real-job sample, or independently verifiable pre-registration. Treat it as a development/diagnostic set, even though the earlier README said queries were prepared beforehand. It cannot estimate general accuracy, and tuning against it would make it even less suitable for that purpose.
- **The corpus is five cards, not the whole resume.** Introduction, general skills, contact information, and any experience outside these cards are excluded. With one labeled target among five cards, a uniform random ordering has expected hit@1 of 20% and hit@3 of 60%; high hit@3 alone is weak evidence. These are reference probabilities, not measured randomized baselines.
- **This compares retrieval systems, not just model architectures.** The original lexical search uses curated evidence keys/facets, whereas embeddings use repeated public prose/technology names. Title/subtitle/evidence repetition may weight topics. No ablation isolates those effects.
- **The long-document tail is an oracle.** `requirementsOnly` encodes the known `suffix` from the test fixture. It does not parse arbitrary job requirements. It is now labeled explicitly as an oracle and tests ensure it cannot affect primary quality or latency metrics.
- **Negative examples are observations, not passing safety tests.** Six guardrail cases are shown separately in the summary. No semantic abstention, negation-safe requirement extractor, automatic document chunking, or blank-input guard has been implemented for production. Embeddings still return a nearest neighbor for irrelevant input; a zero vector can produce arbitrary corpus-order ties. This is intentional diagnostic behavior, not a release-ready search UI.
- **Latency is descriptive.** Forty-four warm timings are two repeats of 22 fixed queries in one session, not 44 independent samples. Model initialization excludes network and now includes integrity hashing. Neither throughput nor cold-start/mobile responsiveness is established. Fixed query/model order and shared hardware can affect timings.
- **Resource reporting is not a download budget.** Browser resource entries start after module loading, while the local server uses `no-store`. Initial JS imports, deployment compression, cold vs warm cache, memory use, worker behavior, repeated/canceled UI searches, Safari/iOS/Android remain unverified.

## Verification

Passed on the cloud workspace:

- Fresh full Node v24.22.1, Linux x64, one-thread ONNX Runtime Web WASM inference over the unchanged 30 cases and five projects.
- Node logic/artifact/server-handler regression tests: **23/23**.
- Python summary regression tests: **6/6**.
- Independent token IDs: **45/45 per model**; independent Static-64 cosine scores: **150 comparisons**, maximum error **3.33e-16**.
- Local model manifest verification: **14/14 files**.
- All experiment JavaScript and Python syntax checks.
- Existing `scripts/generate_resume.py --check` and five production-file provenance hashes.

Not run here: real browser or mobile E2E. A prior attempt could not launch Chromium or reach the local server in the execution environment. Browser-entrypoint changes are syntax-/shared-core-/handler-tested only. No claim is made that browser behavior or browser performance has passed.

## Next useful experiment

Freeze this diagnostic set. Before implementation, assemble actual job descriptions with independent relevance labels and explicitly include unrelated jobs, unknown technologies, negated requirements, and long mixed-language documents. Choose any thresholds/chunking on a separate development portion, evaluate once on an untouched holdout, and report false positive/abstention behavior as well as ranking. Then test the exact browser build on the intended desktop and mobile devices before considering production integration.
