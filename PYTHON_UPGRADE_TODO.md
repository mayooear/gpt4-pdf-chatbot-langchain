# Python Dependency Upgrade TODO

This document tracks **same-major version** upgrades for all Python packages in `requirements.in` and the steps for
safely applying each batch.

---

## Upgrade Strategy

1. Split dependencies into logical batches so we can detect breakage quickly.
2. For **each batch**:
   1. Bump the package pins in `requirements.in`.
   2. `pip-compile requirements.in -o requirements.txt` (or equivalent lock-file update).
   3. Re-install the env (`pip install -r requirements.txt`).
   4. Run the _Validation Checklist_ (below).
   5. If everything passes, commit & push.

---

## Batches & Version Deltas

> Tick the checkbox once the batch has been successfully merged to `main`.

### ✅ Batch 1 — Core AWS SDK

| Package      | Current  | Target  |
| ------------ | -------- | ------- |
| `boto3`      | 1.34.144 | 1.38.35 |
| `botocore`   | 1.34.144 | 1.38.35 |
| `s3transfer` | 0.10.2   | 0.13.0  |

---

### ✅ Batch 2 — Google Cloud stack

| Package                    | Current   | Target |
| -------------------------- | --------- | ------ |
| `google-api-core`          | 2.24.2    | 2.25.0 |
| `google-auth`              | 2.38.0    | 2.40.3 |
| `google-cloud-firestore`   | 2.20.2    | 2.21.0 |
| `googleapis-common-protos` | 1.69.2    | 1.70.0 |
| `rsa`                      | 4.9       | 4.9.1  |
| `grpcio`                   | 1.72.0rc1 | 1.73.0 |
| `grpcio-status`            | 1.71.0    | 1.73.0 |

#### To test manually

- [x] Add an answer.
- [x] Admin actions on answers - Fixed, ignore, etc.
- [x] Answers page.
- [x] Rate limiting data handling in Firestore.
- [x] Related questions: single entry handling and batch handling.

---

### ✅ Batch 3 — Networking / HTTP basics

| Package        | Current | Target  |
| -------------- | ------- | ------- |
| `aiohttp`      | 3.11.18 | 3.12.12 |
| `frozenlist`   | 1.6.0   | 1.7.0   |
| `multidict`    | 6.4.3   | 6.4.4   |
| `h11`          | 0.14.0  | 0.16.0  |
| `httpcore`     | 1.0.5   | 1.0.9   |
| `httpx`        | 0.27.0  | 0.28.1  |
| `urllib3`      | 2.2.2   | 2.4.0   |
| `websockets`   | 15.0    | 15.0.1  |
| `requests`     | 2.32.3  | 2.32.4  |
| `yarl`         | 1.20.0  | 1.20.1  |
| `cryptography` | 45.0.3  | 45.0.4  |

---

### ✅ Batch 4 — Data-science utilities

| Package             | Current | Target  |
| ------------------- | ------- | ------- |
| `pandas`            | 2.2.3   | 2.3.0   |
| `networkx`          | 3.4.2   | 3.5     |
| `tqdm`              | 4.66.4  | 4.67.1  |
| `typing_extensions` | 4.13.2  | 4.14.0  |
| `pycryptodomex`     | 3.21.0  | 3.23.0  |
| `filelock`          | 3.15.4  | 3.18.0  |
| `dill`              | 0.3.8   | 0.4.0   |
| `multiprocess`      | 0.70.16 | 0.70.18 |
| `greenlet`          | 3.0.1   | 3.2.3   |

---

### ✅ Batch 5 — NLP / AI layer

| Package                    | Current | Target |
| -------------------------- | ------- | ------ |
| `spacy`                    | 3.8.6   | 3.8.7  |
| `blis`                     | 1.2.1   | 1.3.0  |
| `huggingface-hub`          | 0.30.2  | 0.33.0 |
| `transformers`             | 4.42.4  | 4.52.4 |
| `tokenizers`               | 0.19.1  | 0.21.1 |
| `datasets`                 | 3.5.1   | 3.6.0  |
| `optimum`                  | 1.24.0  | 1.25.3 |
| `onnx`                     | 1.17.0  | 1.18.0 |
| `onnxruntime`              | 1.21.1  | 1.22.0 |
| `langchain-core`           | 0.3.63  | 0.3.65 |
| `langchain-openai`         | 0.3.6   | 0.3.22 |
| `langchain-text-splitters` | 0.3.6   | 0.3.8  |
| `langsmith`                | 0.3.43  | 0.4.1  |
| `openai`                   | 1.63.2  | 1.86.0 |

---

### ✅ Batch 6 — PDF / Media helpers

| Package      | Current   | Target   |
| ------------ | --------- | -------- |
| `yt-dlp`     | 2025.5.22 | 2025.6.9 |
| `playwright` | 1.40.0    | 1.52.0   |

---

### ✅ Batch 7 — Tooling / Developer UX

| Package         | Current | Target  |
| --------------- | ------- | ------- |
| `pytest`        | 8.3.5   | 8.4.0   |
| `ruff`          | 0.11.12 | 0.11.13 |
| `pip`           | 25.0.1  | 25.1.1  |
| `pipdeptree`    | 2.25.0  | 2.26.1  |
| `click`         | 8.1.8   | 8.2.1   |
| `typer`         | 0.15.4  | 0.16.0  |
| `python-dotenv` | 1.0.1   | 1.1.0   |

---

### ✅ Batch 8 — Major Version Upgrades

| Package | Current | Target     | Breaking Changes                             |
| ------- | ------- | ---------- | -------------------------------------------- |
| `numpy` | <2.0    | >=2.0,<3.0 | ABI break, type promotion rules, API cleanup |
| `torch` | auto    | >=2.2.2    | NumPy 2.0 compatibility                      |

**Major Breaking Changes**:

- **NumPy 2.0**: First major release since 2006
  - ABI break requiring C extension recompilation
  - Type promotion rule changes (NEP 50)
  - ~10% reduction in main namespace
  - Windows default integer now 64-bit
  - Significant performance improvements

**Migration Steps**:

1. ✅ Use Ruff NPY201 rule for automated code fixes: `ruff check --fix --select NPY201`
2. ✅ Test chunking algorithms with new type promotion rules
3. ✅ Validate embedding operations and vector math
4. ⚠️ PyTorch compatibility: Working with warnings (PyTorch 2.2.2 + NumPy 2.3.0)

**Notes**:

- PyTorch 2.2.2 shows `_ARRAY_API not found` warning but all operations work correctly
- Warning will be resolved when PyTorch releases NumPy 2.0 compatible version
- All 387/387 core tests pass

---

## Validation Checklist (run after _each_ batch)

- [ ] **Import sweep**: `python bin/import_sweep.py` (imports every top-level module).
- [ ] **Dependency integrity**: `python -m pip check`.
- [ ] **Smoke tests** (`pytest -q tests/smoke/`).
- [ ] **Static analysis**: `ruff check`, `mypy`/`pyright`.
- [ ] **Dry-run ingestion**: `python data_ingestion/pdf_to_vector_db.py --dry-run sample.pdf`.
- [ ] **Local chat API hit**: `curl -s localhost:3000/api/chat -d '{"message":"ping"}'` returns 200 + non-empty.
- [ ] **/healthz endpoint** returns 200 (Firestore & Pinecone ping).
- [ ] **Canary chat** on Vercel preview passes the golden-set queries.

## Rollback Plan

If any checklist item fails:

1. Revert the batch commit (git revert or redeploy the previous tag).
2. Pin the problematic package to the last known good patch version.
3. Open an issue linking build logs and traceback.

---

## Phase II — GitHub CI Automation

| Status | Task                                                                                              |
| ------ | ------------------------------------------------------------------------------------------------- |
| 🐣     | Create `python-ci.yml` GitHub Actions workflow that runs the **Validation Checklist** on every PR |
| 🐣     | Add job matrix for all supported Python versions (3.10-3.12)                                      |
| 🐣     | Install Node deps and run `npm run lint && npm run build --prefix web` inside the same workflow   |
| 🐣     | Cache pip/poetry and npm assets for faster builds                                                 |
| 🥚     | Configure required status checks so merges are blocked until CI passes                            |
| 🐣     | Add nightly scheduled workflow to run full test suite + `bin/import_sweep.py` on `main`           |
| 🥚     | Enable Dependabot or Renovate to re-use this workflow for automatic PRs                           |

**Implementation Notes:**

- ✅ **python-ci.yml**: Comprehensive workflow with Python 3.10-3.12 matrix
- ✅ **python-nightly.yml**: Full test suite with security audits
- ✅ **Caching**: Added pip and npm caching to both workflows
- ✅ **Documentation**: Complete setup guide in `.github/workflows/README.md`

---

**Last updated:** 2025-01-03 <!-- KEEP THIS LINE; edit date when modifying -->
