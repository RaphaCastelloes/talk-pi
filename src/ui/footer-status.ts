export type FooterStatusKind =
  | "ready"
  | "listen"
  | "transcribing"
  | "thinking"
  | "talking"
  | "paused"
  | "muted"
  | "error"
  | "no-speech";

export type FooterStatusState = {
  voiceStatus?: string;
  voiceMessage?: string;
  speechStatus?: string;
  muted?: boolean;
  playing?: boolean;
  paused?: boolean;
};

type FooterStatusMeta = {
  label: string;
  emoji: string;
};

const STATUS_META: Record<FooterStatusKind, FooterStatusMeta> = {
  ready: { label: "Ready", emoji: "✔" },
  listen: { label: "Listen", emoji: "🎤" },
  transcribing: { label: "Transcribing", emoji: "⏳" },
  thinking: { label: "Thinking", emoji: "🤔" },
  talking: { label: "Talking", emoji: "🗣️" },
  paused: { label: "Paused", emoji: "⏸" },
  muted: { label: "Muted", emoji: "🔇" },
  error: { label: "Error", emoji: "⚠️" },
  "no-speech": { label: "No speech detected", emoji: "👂" },
};

function lower(value: string | undefined): string {
  return String(value ?? "").toLowerCase();
}

export function resolveFooterStatus(state: FooterStatusState): FooterStatusKind {
  const voiceStatus = lower(state.voiceStatus);
  const voiceMessage = lower(state.voiceMessage);
  const speechStatus = lower(state.speechStatus);

  if (state.paused) {
    return "paused";
  }

  if (state.playing || speechStatus.includes("playing")) {
    return "talking";
  }

  if (voiceStatus === "error" || speechStatus.includes("failed") || voiceMessage.includes("error")) {
    return "error";
  }

  if (
    voiceMessage.includes("no speech detected") ||
    voiceStatus === "no-speech" ||
    speechStatus.includes("no speech detected")
  ) {
    return "no-speech";
  }

  if (voiceStatus === "recording") {
    return "listen";
  }

  if (voiceStatus === "transcribing") {
    return "transcribing";
  }

  if (
    speechStatus.includes("queued") ||
    speechStatus.includes("converting text to audio") ||
    speechStatus.includes("ready to play") ||
    speechStatus.includes("deferred")
  ) {
    return "thinking";
  }

  if (state.muted || speechStatus.includes("muted")) {
    return "muted";
  }

  return "ready";
}

export function formatFooterStatus(kind: FooterStatusKind, detail?: string): string {
  const meta = STATUS_META[kind];
  return `| Talk-Pi: ${meta.label} ${detail ? ` — ${detail}` : ""}`;
}

export function formatFooterStatusFromState(state: FooterStatusState, detail?: string): string {
  return formatFooterStatus(resolveFooterStatus(state), detail);
}
