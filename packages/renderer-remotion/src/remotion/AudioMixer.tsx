import React, { useMemo } from "react";
import { Audio, Sequence } from "remotion";
import type { VideoSpec } from "@faceless/core";
import { createDuckedVolumeEvaluator } from "./audio/ducking.js";

export interface AudioSources {
  /** Narration audio playable URL or data URI. */
  narration?: string;
  /** Music audio track ID or libraryId -> playable URL or data URI. */
  music?: Record<string, string>;
  /** SFX instance ID or sfxId -> playable URL or data URI. */
  sfx?: Record<string, string>;
}

export interface AudioMixerProps {
  spec?: VideoSpec;
  audioSources?: AudioSources;
}

export const AudioMixer: React.FC<AudioMixerProps> = ({ spec, audioSources }) => {
  const fps = spec?.fps || 30;

  // 1. Narration track
  const narrationSrc = useMemo(() => {
    if (audioSources?.narration) {
      return audioSources.narration;
    }
    const path = spec?.narration?.audioPath;
    if (path && (path.startsWith("data:") || path.startsWith("http:") || path.startsWith("https:"))) {
      return path;
    }
    return undefined;
  }, [audioSources?.narration, spec?.narration?.audioPath]);

  // 2. Sound Effects (SFX) anchored to words
  const sfxTriggers = useMemo(() => {
    if (!spec) return [];
    const wordMap = new Map<string, { startSec: number; endSec: number }>();
    for (const w of spec.narration?.words || []) {
      wordMap.set(w.id, w);
    }

    const list: Array<{
      id: string;
      sfxId: string;
      triggerFrame: number;
      volume: number;
      src?: string;
    }> = [];

    for (const ch of spec.chapters || []) {
      for (const b of ch.beats || []) {
        for (const s of b.sfx || []) {
          const anchor = wordMap.get(s.anchorWordId);
          const triggerSec = (anchor ? anchor.startSec : 0) + (s.offsetSec ?? 0);
          const triggerFrame = Math.max(0, Math.round(triggerSec * fps));

          const src =
            audioSources?.sfx?.[s.id] ||
            audioSources?.sfx?.[s.sfxId] ||
            (s.sfxId.startsWith("data:") || s.sfxId.startsWith("http:") || s.sfxId.startsWith("https:")
              ? s.sfxId
              : undefined);

          list.push({
            id: s.id,
            sfxId: s.sfxId,
            triggerFrame,
            volume: s.volume ?? 0.8,
            src,
          });
        }
      }
    }
    return list;
  }, [spec, fps, audioSources?.sfx]);

  // 3. Music tracks with auto-ducking
  const musicTracks = useMemo(() => {
    if (!spec?.music || spec.music.length === 0) return [];
    const words = spec.narration?.words || [];

    return spec.music.map((track) => {
      const from = Math.max(0, Math.round(track.startSec * fps));
      const durationInFrames =
        track.endSec !== undefined
          ? Math.max(1, Math.round((track.endSec - track.startSec) * fps))
          : undefined;

      const baseVolume = track.volume ?? 0.3;
      const evaluator = createDuckedVolumeEvaluator(fps, words, baseVolume);

      const src =
        audioSources?.music?.[track.id] ||
        audioSources?.music?.[track.libraryId] ||
        (track.libraryId.startsWith("data:") ||
        track.libraryId.startsWith("http:") ||
        track.libraryId.startsWith("https:")
          ? track.libraryId
          : undefined);

      return {
        id: track.id,
        from,
        durationInFrames,
        src,
        // Remotion passes sequence-relative frame to volume callback
        volumeCallback: (relativeFrame: number) => evaluator(relativeFrame + from),
      };
    });
  }, [spec?.music, spec?.narration?.words, fps, audioSources?.music]);

  return (
    <>
      {/* Narration Track */}
      {narrationSrc && <Audio src={narrationSrc} volume={1} />}

      {/* Background Music Tracks (looped with auto-ducking) */}
      {musicTracks.map((track) => {
        if (!track.src) return null;
        return (
          <Sequence
            key={`music-${track.id}`}
            from={track.from}
            durationInFrames={track.durationInFrames}
            layout="none"
          >
            <Audio src={track.src} loop volume={track.volumeCallback} />
          </Sequence>
        );
      })}

      {/* SFX Tracks (word-anchored triggers) */}
      {sfxTriggers.map((sfx) => {
        if (!sfx.src) return null;
        return (
          <Sequence key={`sfx-${sfx.id}`} from={sfx.triggerFrame} layout="none">
            <Audio src={sfx.src} volume={sfx.volume} />
          </Sequence>
        );
      })}
    </>
  );
};
