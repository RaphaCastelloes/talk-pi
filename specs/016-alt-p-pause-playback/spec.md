# Feature Specification: Alt+P Pause Playback

**Feature Branch**: `[016-alt-p-pause-playback]`

**Created**: 2026-11-01

**Status**: Implemented

**Input**: User description: "Implement an Alt+P hotkey to pause audio playback. If the user presses it, pause playback; if they press it again, resume from where it paused."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Pause and Resume Spoken Reply (Priority: P1)

As a user listening to a spoken assistant response, I can press Alt+P to pause it and press Alt+P again to continue from the same point.

**Independent Test**: Start spoken reply playback, press Alt+P, confirm audio stops and the footer shows `Paused`; press Alt+P again and confirm audio continues from where it stopped.

**Acceptance Scenarios**:

1. **Given** a spoken reply is playing, **When** the user presses Alt+P, **Then** the audio pauses and the footer shows `Paused`.
2. **Given** a spoken reply is paused, **When** the user presses Alt+P, **Then** audio resumes from the paused position.
3. **Given** a reply was paused and resumed several times, **When** it finishes, **Then** queued replies continue normally.
4. **Given** a reply is paused, **When** the user presses Esc, F9, F10 or mutes, **Then** playback stops as if it were playing.
5. **Given** nothing is playing, **When** the user presses Alt+P, **Then** the key is passed to the editor unchanged.

## Requirements *(mandatory)*

- **FR-001**: Alt+P MUST toggle between pausing and resuming the active spoken reply.
- **FR-002**: Resume MUST continue from the paused position, accumulating across multiple pauses.
- **FR-003**: The pause key MUST be configurable with `TALK_PI_PAUSE_PLAYBACK_KEY` (default `alt+p`).
- **FR-004**: Stop, mute and voice-capture shortcuts MUST still stop paused playback.

## Implementation Notes

- Pausing stops the player process and records elapsed playback time; resuming plays a trimmed copy of the WAV starting at that offset (`src/tts/wav-trim.ts`). This works with every player (Windows `SoundPlayer`, `play-sound` on Linux/macOS), none of which support native pause.
- On Windows, elapsed time is measured from a start signal printed right before `PlaySync`, so PowerShell startup time is not counted as played audio.
