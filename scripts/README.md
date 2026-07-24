# scripts — 파이프라인 스크립트

멤버십 강의 155편을 내려받아 전사하고 노트·교재로 가공한 파이프라인이다. 모두 macOS 기준이며 `yt-dlp`, `ffmpeg`, `whisper.cpp`(`whisper-cli`)에 의존한다.

## 폴더 구성

| 폴더 | 내용 |
|---|---|
| `download/` | 영상·오디오 내려받기 |
| `transcribe/` | 전사(STT) 및 통합 실행 |
| `archive/` | 폐기된 구버전 (`.superseded`) |
| `logs/` | 실행 로그 (git 미추적) |

## download/

| 파일 | 역할 |
|---|---|
| `predownload.sh` | 재생목록 전체를 720p mp4 + mp3로 사전 다운로드. 디스크 여유 8GB에 도달하면 중단하고, 받은 영상 폴더에 `.batchA` 표시를 남긴다 |
| `redo.sh` | 전사 품질 불량으로 판정된 영상만 골라 재다운로드 |

## transcribe/

| 파일 | 역할 |
|---|---|
| `transcribe.sh` | 현행 전사 스크립트. mp3→16kHz wav→`whisper-cli`(large-v3-turbo)로 txt·srt 생성. 길이·반복 검증을 통과한 경우에만 `.batchA` 표시가 있는 원본을 삭제한다 |
| `run-all.sh` | 다운로드부터 전사까지 한 번에 도는 통합 스크립트 |

### 전사 시 주의 (실측으로 확인된 것)

- **`-mc 0`(max-context 0)은 필수다.** 없으면 large-v3-turbo가 긴 한국어 강의에서 반복 환청 루프에 빠져 한 문장을 수백~수천 번 되풀이한다(실측 965회·2,128회). `-mc 0`으로 965회 → 2회까지 떨어지는 것을 확인했다.
- **`whisper-cli`는 실패해도 exit 0을 반환한다.** 따라서 종료 코드만 믿으면 안 되고, 결과물을 두 축으로 검증해야 한다. ①길이: txt 바이트 ≥ 오디오 초 × 5 ②반복: 10바이트 초과 문장이 40회 이상 반복되면 실패로 간주. 검증 실패 시 원본을 지우지 않고 재시도한다.
- 원본 삭제는 되돌릴 수 없으므로, 검증을 통과하고 `.batchA` 표시가 있는 경우로만 한정한다.

## archive/

`pipeline.sh` → `queue-playlists.sh` → `queue-playlists-2.sh` 순으로 발전하다 `run-all.sh`·`transcribe.sh`로 통합되며 폐기된 구버전이다. 이력 참고용으로만 남긴다.

## 실행 순서

```bash
scripts/download/predownload.sh     # 1. 영상·오디오 확보
scripts/transcribe/transcribe.sh    # 2. 전사 → txt·srt 생성 후 원본 삭제
```

산출물은 `원본 스크립트/<재생목록>/<NN - 제목>/`에 `.txt`·`.srt`로 쌓인다.
