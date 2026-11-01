import assert from "node:assert/strict";
import { formatFooterStatus, formatFooterStatusFromState, resolveFooterStatus } from "../../src/ui/footer-status.ts";

assert.equal(formatFooterStatus("ready"), "| Talk-Pi: Ready ");
assert.equal(formatFooterStatus("listen"), "| Talk-Pi: Listen ");
assert.equal(formatFooterStatus("transcribing"), "| Talk-Pi: Transcribing ");
assert.equal(formatFooterStatus("thinking"), "| Talk-Pi: Thinking ");
assert.equal(formatFooterStatus("talking"), "| Talk-Pi: Talking ");
assert.equal(formatFooterStatus("paused"), "| Talk-Pi: Paused ");
assert.equal(formatFooterStatus("muted"), "| Talk-Pi: Muted ");
assert.equal(formatFooterStatus("error"), "| Talk-Pi: Error ");
assert.equal(formatFooterStatus("no-speech"), "| Talk-Pi: No speech detected ");

assert.equal(resolveFooterStatus({ voiceStatus: "recording" }), "listen");
assert.equal(resolveFooterStatus({ voiceStatus: "transcribing" }), "transcribing");
assert.equal(resolveFooterStatus({ speechStatus: "Spoken reply playing: file.wav" }), "talking");
assert.equal(resolveFooterStatus({ muted: true }), "muted");
assert.equal(resolveFooterStatus({ playing: true, paused: true }), "paused");
assert.equal(resolveFooterStatus({ voiceStatus: "error" }), "error");
assert.equal(resolveFooterStatus({ voiceMessage: "No speech detected" }), "no-speech");
assert.equal(formatFooterStatusFromState({ voiceStatus: "idle" }), "| Talk-Pi: Ready ");
assert.equal(formatFooterStatusFromState({ voiceStatus: "transcribing" }), "| Talk-Pi: Transcribing ");
