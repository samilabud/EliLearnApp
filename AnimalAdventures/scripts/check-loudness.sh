#!/usr/bin/env bash
# Lists every audio file under assets/sounds that is outside the target
# loudness (-18 to -14 LUFS integrated) or peaks above -1 dBTP. The app's
# standard is about -16 LUFS (EBU R128); run this before adding new clips.
#
# Usage: bash scripts/check-loudness.sh [directory]   (default assets/sounds)
# Very short clips (under ~0.4 s) can't be measured reliably and are
# reported as "too short" instead of failing.
set -euo pipefail
DIR="${1:-assets/sounds}"
LOW=-18; HIGH=-14; PEAK=-1
checked=0; bad=0
while IFS= read -r -d '' f; do
  out=$(ffmpeg -nostdin -nostats -hide_banner -i "$f" -af loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json -f null - 2>&1 || true)
  lufs=$(printf '%s' "$out" | grep '"input_i"' | sed -E 's/.*: "([-0-9.inf]+)".*/\1/')
  tp=$(printf '%s' "$out" | grep '"input_tp"' | sed -E 's/.*: "([-0-9.inf]+)".*/\1/')
  checked=$((checked+1))
  if [ -z "$lufs" ] || [ "$lufs" = "-inf" ]; then
    echo "too short/silent: $f"; continue
  fi
  if awk -v l="$lufs" -v lo="$LOW" -v hi="$HIGH" -v t="$tp" -v p="$PEAK" 'BEGIN{exit !(l<lo||l>hi||t>p)}'; then
    echo "OUT OF RANGE: $f  ${lufs} LUFS  peak ${tp} dBTP"; bad=$((bad+1))
  fi
done < <(find "$DIR" -type f \( -name '*.mp3' -o -name '*.wav' -o -name '*.m4a' \) -print0)
echo "checked $checked files, $bad out of range"
[ "$bad" -eq 0 ]
