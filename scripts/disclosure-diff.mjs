import crypto from "node:crypto";

const SNAPSHOT_VERSION = "1.0";
const MAX_SEGMENTS = 30;
const MAX_EXCERPT_LENGTH = 220;
const MAX_CHANGES = 5;
const LEFT_CONTEXT = 90;
const RIGHT_CONTEXT = 150;

function hash(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function normalizeSpace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function excerptAround(text, start, length) {
  const left = Math.max(0, start - LEFT_CONTEXT);
  const right = Math.min(text.length, start + length + RIGHT_CONTEXT);
  let excerpt = normalizeSpace(text.slice(left, right));
  if (excerpt.length > MAX_EXCERPT_LENGTH) excerpt = `${excerpt.slice(0, MAX_EXCERPT_LENGTH - 1)}…`;
  return excerpt;
}

export function buildWatchSnapshot(text, keywords = [], capturedAt = null) {
  const normalizedText = normalizeSpace(text);
  const lowerText = normalizedText.toLowerCase();
  const normalizedKeywords = [...new Set(
    (Array.isArray(keywords) ? keywords : [])
      .map((keyword) => normalizeSpace(keyword))
      .filter(Boolean)
  )];

  const byHash = new Map();
  for (const keyword of normalizedKeywords) {
    const needle = keyword.toLowerCase();
    let fromIndex = 0;

    while (fromIndex < lowerText.length && byHash.size < MAX_SEGMENTS) {
      const index = lowerText.indexOf(needle, fromIndex);
      if (index === -1) break;

      const excerpt = excerptAround(normalizedText, index, keyword.length);
      if (excerpt) {
        const segmentHash = hash(excerpt.toLowerCase());
        const existing = byHash.get(segmentHash);
        if (existing) {
          existing.matchedKeywords = [...new Set([...existing.matchedKeywords, keyword])];
        } else {
          byHash.set(segmentHash, {
            hash: segmentHash,
            excerpt,
            matchedKeywords: [keyword]
          });
        }
      }

      fromIndex = index + Math.max(needle.length, 1);
    }
  }

  return {
    version: SNAPSHOT_VERSION,
    capturedAt,
    keywords: normalizedKeywords,
    segments: [...byHash.values()].slice(0, MAX_SEGMENTS)
  };
}

export function diffWatchSnapshots(previousSnapshot, currentSnapshot) {
  if (!previousSnapshot?.segments || !currentSnapshot?.segments) {
    return {
      status: "baseline_missing",
      method: "watched-context-diff-v1",
      added: [],
      removed: [],
      addedCount: 0,
      removedCount: 0,
      currentRelevant: (currentSnapshot?.segments || []).slice(0, MAX_CHANGES).map((segment) => segment.excerpt),
      note: "A comparable watched-context baseline is not available yet. Current relevant excerpts were captured for future scans."
    };
  }

  const previousByHash = new Map(previousSnapshot.segments.map((segment) => [segment.hash, segment]));
  const currentByHash = new Map(currentSnapshot.segments.map((segment) => [segment.hash, segment]));

  const addedSegments = currentSnapshot.segments.filter((segment) => !previousByHash.has(segment.hash));
  const removedSegments = previousSnapshot.segments.filter((segment) => !currentByHash.has(segment.hash));

  return {
    status: "comparable",
    method: "watched-context-diff-v1",
    added: addedSegments.slice(0, MAX_CHANGES).map((segment) => segment.excerpt),
    removed: removedSegments.slice(0, MAX_CHANGES).map((segment) => segment.excerpt),
    addedCount: addedSegments.length,
    removedCount: removedSegments.length,
    currentRelevant: [],
    note: addedSegments.length || removedSegments.length
      ? "The page fingerprint changed and one or more keyword-focused context windows also changed. These excerpts are review candidates, not semantic conclusions."
      : "The page fingerprint changed, but the keyword-focused context windows did not change. The difference may be unrelated boilerplate, navigation, metadata, or dynamic page content."
  };
}

export function buildChangeEvidence({ previousSnapshot, currentSnapshot, pageChanged }) {
  if (!pageChanged) {
    return {
      status: "unchanged",
      method: "watched-context-diff-v1",
      added: [],
      removed: [],
      addedCount: 0,
      removedCount: 0,
      currentRelevant: [],
      note: "No page fingerprint change was detected."
    };
  }

  return diffWatchSnapshots(previousSnapshot, currentSnapshot);
}
