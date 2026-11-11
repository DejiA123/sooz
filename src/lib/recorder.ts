/** Video formats for MediaRecorder, best first: MP4 plays everywhere (iPhone included), WebM is the fallback. */
const RECORDER_TYPES = [
  'video/mp4;codecs="avc1.42E01E,mp4a.40.2"',
  "video/mp4;codecs=avc1,mp4a.40.2",
  "video/mp4;codecs=avc1",
  "video/mp4",
  "video/webm;codecs=vp8,opus",
  "video/webm;codecs=vp9,opus",
  "video/webm",
];

/** The best format this browser can record, "" for the browser's default, or null when it can't record at all. */
export const pickRecorderType = (): string | null =>
  typeof MediaRecorder === "undefined"
    ? null
    : RECORDER_TYPES.find((t) => { try { return MediaRecorder.isTypeSupported(t); } catch { return false; } }) ?? "";
