#!/usr/bin/env bash
#
# Record a demo of the app from a connected Android device or emulator,
# with audio, and normalise the result so it is actually audible.
#
#   ./scripts/record-demo.sh [output.mp4] [--time-limit SECONDS] [--keep-raw]
#
# Why this exists:
#   - `adb shell screenrecord` produces no audio track at all, so it cannot
#     be used for a demo with sound.
#   - macOS cannot capture system audio without a virtual device such as
#     BlackHole, so QuickTime alone will not pick up emulator sound either.
#   - scrcpy pulls audio straight off the device over adb, which sidesteps
#     both problems.
#   - The emulator's audio path is heavily attenuated: captured peaks land
#     around -31 dB even at full volume, against source files that peak near
#     -1 dB. The loudnorm pass at the end makes up that difference.
#
# Recording on a physical device (Android 10+) avoids the attenuation, but
# the normalise step is harmless there too.

set -euo pipefail

OUTPUT="demo.mp4"
TIME_LIMIT=""
KEEP_RAW=false

while [ $# -gt 0 ]; do
  case "$1" in
    --time-limit)
      TIME_LIMIT="${2:-}"
      if [ -z "$TIME_LIMIT" ]; then
        echo "error: --time-limit needs a value in seconds" >&2
        exit 1
      fi
      shift 2
      ;;
    --keep-raw)
      KEEP_RAW=true
      shift
      ;;
    -h|--help)
      sed -n '3,20p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    -*)
      echo "error: unknown option $1" >&2
      exit 1
      ;;
    *)
      OUTPUT="$1"
      shift
      ;;
  esac
done

# --- prerequisites -----------------------------------------------------------

missing=false
for tool in adb scrcpy ffmpeg; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "error: '$tool' not found on PATH" >&2
    case "$tool" in
      adb)    echo "  install: brew install --cask android-platform-tools" >&2 ;;
      scrcpy) echo "  install: brew install scrcpy" >&2 ;;
      ffmpeg) echo "  install: brew install ffmpeg" >&2 ;;
    esac
    missing=true
  fi
done
$missing && exit 1

if ! adb get-state >/dev/null 2>&1; then
  echo "error: no Android device or emulator connected." >&2
  echo "  start one with: \$ANDROID_HOME/emulator/emulator -avd <name>" >&2
  echo "  list targets with: adb devices" >&2
  exit 1
fi

DEVICE=$(adb devices | awk 'NR==2 {print $1}')
echo "==> Device: $DEVICE"

# --- volume ------------------------------------------------------------------
# Emulators boot with media volume part-way down and reset it on restart, so
# raise it every run rather than assuming a previous run stuck.

echo "==> Raising media volume to maximum"
for _ in $(seq 1 15); do
  adb shell input keyevent KEYCODE_VOLUME_UP >/dev/null 2>&1 || true
done

# --- record ------------------------------------------------------------------

RAW="${OUTPUT%.mp4}-raw.mp4"

echo "==> Recording to $RAW"
if [ -n "$TIME_LIMIT" ]; then
  echo "    Stopping automatically after ${TIME_LIMIT}s."
else
  echo "    Interact with the mirror window. Press Ctrl+C or close it to stop."
fi

SCRCPY_ARGS=(--record="$RAW")
[ -n "$TIME_LIMIT" ] && SCRCPY_ARGS+=(--time-limit="$TIME_LIMIT")

# scrcpy exits non-zero when interrupted with Ctrl+C, which is the normal way
# to end an untimed recording. The file is still finalised, so judge success by
# whether it exists rather than by the exit code.
scrcpy "${SCRCPY_ARGS[@]}" || true

if [ ! -f "$RAW" ]; then
  echo "error: no recording was produced." >&2
  exit 1
fi

# --- normalise ---------------------------------------------------------------

level_of() {
  ffmpeg -i "$1" -af volumedetect -f null - 2>&1 |
    grep -oE 'max_volume: -?[0-9.]+ dB' | head -1 | cut -d' ' -f2-
}

BEFORE=$(level_of "$RAW")

echo "==> Normalising audio (peak was ${BEFORE:-unknown})"
# -c:v copy leaves the video stream untouched: fast, and no quality loss.
# I=-16 LUFS is the usual target for web video; TP=-1.5 leaves headroom.
ffmpeg -y -loglevel error -i "$RAW" \
  -af loudnorm=I=-16:TP=-1.5:LRA=11 \
  -c:v copy -c:a aac -b:a 192k \
  "$OUTPUT"

AFTER=$(level_of "$OUTPUT")

if [ "$KEEP_RAW" = true ]; then
  echo "==> Kept unprocessed capture at $RAW"
else
  rm -f "$RAW"
fi

echo
echo "==> Done: $OUTPUT"
echo "    Peak ${BEFORE:-unknown} -> ${AFTER:-unknown}"
echo "    Size $(du -h "$OUTPUT" | cut -f1)"

if [ "${BEFORE:-}" = "-91.0 dB" ]; then
  echo
  echo "    Note: the capture was silent. Check that sounds actually played," >&2
  echo "    and that the device is not muted." >&2
fi
