export type SpokenReplyStatusKind =
  | "queued"
  | "synthesizing"
  | "ready"
  | "playing"
  | "paused"
  | "deferred"
  | "success"
  | "failure"
  | "stopped"
  | "muted";

export function formatSpokenReplyStatus(kind: SpokenReplyStatusKind, detail?: string): string {
  switch (kind) {
    case "queued":
    case "synthesizing":
      return `Thinking${detail ? `: ${detail}` : ""}`;
    case "ready":
      return `Thinking${detail ? `: ${detail}` : ""}`;
    case "playing":
      return `Talking${detail ? `: ${detail}` : ""}`;
    case "paused":
      return `Paused${detail ? `: ${detail}` : ""}`;
    case "deferred":
      return `Muted${detail ? `: ${detail}` : ""}`;
    case "success":
    case "stopped":
      return `Ready${detail ? `: ${detail}` : ""}`;
    case "failure":
      return `Error${detail ? `: ${detail}` : ""}`;
    case "muted":
      return `Muted${detail ? `: ${detail}` : ""}`;
  }
}
