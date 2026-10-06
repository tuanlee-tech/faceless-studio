import { interpolate } from "remotion";
import type { VideoSpec, Beat, Word } from "@faceless/core";

export interface ActiveBeatInfo {
  activeBeat?: Beat;
  activeBeatIndex: number;
  totalBeats: number;
  beatProgress: number; // 0 to 1
  activeImage?: string; // data URI or URL
  cameraScale: number; // 1.0 -> 1.08
}

export function getActiveBeatInfo(
  spec: VideoSpec | undefined,
  currentTime: number,
  imageSources?: Record<string, string>
): ActiveBeatInfo {
  const allBeats: Beat[] = (spec?.chapters || []).flatMap((c) => c.beats || []);
  if (allBeats.length === 0) {
    return {
      activeBeatIndex: -1,
      totalBeats: 0,
      beatProgress: 0,
      cameraScale: 1,
    };
  }

  const words: Word[] = spec?.narration?.words || [];
  const wordMap = new Map<string, Word>(words.map((w) => [w.id, w]));

  const beatTimings = allBeats.map((beat, idx) => {
    const startWord = wordMap.get(beat.range?.startWordId);
    const endWord = wordMap.get(beat.range?.endWordId);
    let startSec = startWord ? startWord.startSec : 0;
    let endSec = endWord ? endWord.endSec : startSec + 5;

    // If words are missing or have 0 duration, distribute evenly across durationSec
    if (words.length === 0 && spec?.narration?.durationSec) {
      const durPerBeat = spec.narration.durationSec / allBeats.length;
      startSec = idx * durPerBeat;
      endSec = (idx + 1) * durPerBeat;
    }

    return {
      beat,
      index: idx,
      startSec,
      endSec,
    };
  });

  // Find the beat corresponding to currentTime
  let currentTiming = beatTimings.find(
    (bt) => currentTime >= bt.startSec && currentTime < bt.endSec
  );

  // If before first beat, choose first beat
  if (!currentTiming && currentTime < beatTimings[0].startSec) {
    currentTiming = beatTimings[0];
  }

  // If after last beat or boundary, choose last beat
  if (!currentTiming) {
    currentTiming = beatTimings[beatTimings.length - 1];
  }

  const activeBeat = currentTiming.beat;
  const beatStart = currentTiming.startSec;
  const beatEnd = currentTiming.endSec;
  const beatDuration = Math.max(0.1, beatEnd - beatStart);
  const beatProgress = Math.min(1, Math.max(0, (currentTime - beatStart) / beatDuration));

  // Ken burns slow zoom: 1.0 to 1.08 (deterministic Remotion interpolate)
  const cameraScale = interpolate(beatProgress, [0, 1], [1.0, 1.08], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  // Find image from imageSources
  let activeImage: string | undefined = undefined;
  if (imageSources) {
    // 1. By beat id (e.g. "b1")
    if (imageSources[activeBeat.id]) {
      activeImage = imageSources[activeBeat.id];
    }
    // 2. By assets in beat
    if (!activeImage && activeBeat.assets && activeBeat.assets.length > 0) {
      for (const asset of activeBeat.assets) {
        if (asset.assetId && imageSources[asset.assetId]) {
          activeImage = imageSources[asset.assetId];
          break;
        }
        if (asset.filePath && imageSources[asset.filePath]) {
          activeImage = imageSources[asset.filePath];
          break;
        }
      }
    }
    // 3. Fallback: by index e.g. "b1"
    if (!activeImage) {
      const fallbackKey = `b${currentTiming.index + 1}`;
      if (imageSources[fallbackKey]) {
        activeImage = imageSources[fallbackKey];
      }
    }
  }

  return {
    activeBeat,
    activeBeatIndex: currentTiming.index,
    totalBeats: allBeats.length,
    beatProgress,
    activeImage,
    cameraScale,
  };
}
