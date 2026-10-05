import {
  VideoSpecSchema,
  type VideoSpec,
  type Chapter,
  type Beat,
} from "./schemas/video-spec.js";
import type { Word } from "./types.js";
import type { ShortCandidate } from "./schemas/task-results.js";

export interface ExtractShortOptions {
  startWordId: string;
  endWordId: string;
  title?: string;
  shortIndex?: number;
  templateId?: string;
}

export function extractShort(spec: VideoSpec, options: ExtractShortOptions): VideoSpec {
  const words = spec.narration.words;
  if (!words || words.length === 0) {
    throw new Error("Cannot extract short: spec has no narration words");
  }

  const startIdx = words.findIndex((w) => w.id === options.startWordId);
  const endIdx = words.findIndex((w) => w.id === options.endWordId);

  if (startIdx === -1) {
    throw new Error(`startWordId '${options.startWordId}' not found in narration.words`);
  }
  if (endIdx === -1) {
    throw new Error(`endWordId '${options.endWordId}' not found in narration.words`);
  }
  if (startIdx > endIdx) {
    throw new Error(
      `Invalid range: startWordId index (${startIdx}) > endWordId index (${endIdx})`,
    );
  }

  const selectedWords = words.slice(startIdx, endIdx + 1);
  const timeOffset = selectedWords[0].startSec;

  // Shift timestamps to start at 0
  const shiftedWords: Word[] = selectedWords.map((w) => ({
    ...w,
    startSec: Math.max(0, Number((w.startSec - timeOffset).toFixed(3))),
    endSec: Math.max(0, Number((w.endSec - timeOffset).toFixed(3))),
  }));

  const durationSec = shiftedWords[shiftedWords.length - 1].endSec;
  const selectedWordIds = new Set(selectedWords.map((w) => w.id));

  // Extract and clamp chapters/beats
  const clampedChapters: Chapter[] = [];

  for (const chapter of spec.chapters) {
    const clampedBeats: Beat[] = [];

    for (const beat of chapter.beats) {
      const bStart = words.findIndex((w) => w.id === beat.range.startWordId);
      const bEnd = words.findIndex((w) => w.id === beat.range.endWordId);

      // Check if beat range overlaps with [startIdx, endIdx]
      const overlapStart = Math.max(bStart !== -1 ? bStart : startIdx, startIdx);
      const overlapEnd = Math.min(bEnd !== -1 ? bEnd : endIdx, endIdx);

      if (overlapStart <= overlapEnd) {
        const clampedStartWord = words[overlapStart].id;
        const clampedEndWord = words[overlapEnd].id;

        // Filter captions
        const clampedCaptions = (beat.captions || [])
          .map((c) => ({
            ...c,
            wordIds: c.wordIds.filter((wid) => selectedWordIds.has(wid)),
          }))
          .filter((c) => c.wordIds.length > 0);

        // Filter SFX
        const clampedSfx = (beat.sfx || []).filter((s) =>
          selectedWordIds.has(s.anchorWordId),
        );

        clampedBeats.push({
          ...beat,
          range: {
            startWordId: clampedStartWord,
            endWordId: clampedEndWord,
          },
          captions: clampedCaptions,
          sfx: clampedSfx,
        });
      }
    }

    if (clampedBeats.length > 0) {
      clampedChapters.push({
        ...chapter,
        beats: clampedBeats,
      });
    }
  }

  // Fallback if no chapter matched
  if (clampedChapters.length === 0) {
    clampedChapters.push({
      id: "c1",
      title: options.title || "Short Highlight",
      beats: [
        {
          id: "b1",
          range: {
            startWordId: shiftedWords[0].id,
            endWordId: shiftedWords[shiftedWords.length - 1].id,
          },
          layout: "center-text",
          assets: [],
          captions: [],
          sfx: [],
        },
      ],
    });
  }

  // Shift music if present
  const shiftedMusic = (spec.music || [])
    .filter(
      (m) =>
        (m.endSec === undefined || m.endSec > timeOffset) &&
        m.startSec < timeOffset + durationSec,
    )
    .map((m) => ({
      ...m,
      startSec: Math.max(0, Number((m.startSec - timeOffset).toFixed(3))),
      ...(m.endSec !== undefined
        ? { endSec: Math.min(durationSec, Number((m.endSec - timeOffset).toFixed(3))) }
        : {}),
    }));

  const shortIndex = options.shortIndex || 1;
  const shortTitle =
    options.title ||
    `${(spec.meta?.title as string) || spec.projectSlug} — Short #${shortIndex}`;

  const shortSpecRaw = {
    specVersion: spec.specVersion,
    projectSlug: spec.projectSlug,
    topicId: spec.topicId,
    templateId: options.templateId || spec.templateId,
    fps: spec.fps,
    narration: {
      audioPath: spec.narration.audioPath,
      durationSec,
      words: shiftedWords,
    },
    chapters: clampedChapters,
    music: shiftedMusic,
    meta: {
      ...spec.meta,
      title: shortTitle,
      isShort: true,
      shortIndex,
      parentSpecSlug: spec.projectSlug,
    },
  };

  return VideoSpecSchema.parse(shortSpecRaw);
}

export function autoDetectShortCandidates(
  spec: VideoSpec,
  maxDurationSec = 60,
  maxCandidates = 3,
): ShortCandidate[] {
  const words = spec.narration.words;
  if (!words || words.length === 0) return [];

  const candidates: ShortCandidate[] = [];

  // If total narration <= maxDurationSec, the whole video can be Candidate 1
  if (spec.narration.durationSec <= maxDurationSec) {
    candidates.push({
      id: "short-1",
      title: `${(spec.meta?.title as string) || spec.projectSlug} - Full Short`,
      startWordId: words[0].id,
      endWordId: words[words.length - 1].id,
      hookReason: "Toàn bộ nội dung ngắn gọn dưới 60 giây, hoàn hảo cho Short",
      estimatedSeconds: spec.narration.durationSec,
    });
    return candidates;
  }

  // Iterate chapters to find chunks
  let candidateIdx = 1;
  for (const chapter of spec.chapters) {
    if (chapter.beats.length === 0) continue;
    const firstBeat = chapter.beats[0];
    const lastBeat = chapter.beats[chapter.beats.length - 1];

    const wStart = words.find((w) => w.id === firstBeat.range.startWordId);
    const wEnd = words.find((w) => w.id === lastBeat.range.endWordId);

    if (wStart && wEnd) {
      const dur = wEnd.endSec - wStart.startSec;
      if (dur > 5 && dur <= maxDurationSec) {
        candidates.push({
          id: `short-${candidateIdx}`,
          title: `${chapter.title || "Highlight"}`,
          startWordId: wStart.id,
          endWordId: wEnd.id,
          hookReason: `Chương '${chapter.title}' cô đọng trong ${dur.toFixed(1)}s`,
          estimatedSeconds: Number(dur.toFixed(1)),
        });
        candidateIdx++;
        if (candidates.length >= maxCandidates) break;
      }
    }
  }

  // If no chapter fit, chunk words up to 45 seconds
  if (candidates.length === 0) {
    const chunkWordsCount = Math.min(words.length, 60);
    const chunkWords = words.slice(0, chunkWordsCount);
    candidates.push({
      id: "short-1",
      title: `${(spec.meta?.title as string) || spec.projectSlug} - Đoạn Mở Đầu`,
      startWordId: chunkWords[0].id,
      endWordId: chunkWords[chunkWords.length - 1].id,
      hookReason: "Đoạn mở đầu có hook cao trào",
      estimatedSeconds: Number(
        (chunkWords[chunkWords.length - 1].endSec - chunkWords[0].startSec).toFixed(1),
      ),
    });
  }

  return candidates;
}
