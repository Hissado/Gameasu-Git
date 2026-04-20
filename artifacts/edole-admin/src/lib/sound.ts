let _ctx: AudioContext | null = null;
let _ringtoneStop: (() => void) | null = null;

function ctx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!_ctx) {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    _ctx = new AC();
  }
  return _ctx;
}

function tone(freq: number, durationMs: number, gain = 0.18, type: OscillatorType = "sine", startAt = 0) {
  const ac = ctx();
  if (!ac) return;
  const t = ac.currentTime + startAt;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.01);
  g.gain.linearRampToValueAtTime(gain, t + durationMs / 1000 - 0.02);
  g.gain.linearRampToValueAtTime(0, t + durationMs / 1000);
  osc.connect(g).connect(ac.destination);
  osc.start(t);
  osc.stop(t + durationMs / 1000 + 0.05);
}

/** Soft, professional message notification ("ding"). */
export function playMessagePing() {
  try {
    tone(880, 110, 0.12, "sine", 0);
    tone(1320, 140, 0.10, "sine", 0.08);
  } catch {/* ignore */}
}

/** Looping ringtone (incoming call). Returns stop function. */
export function startRingtone(): () => void {
  stopRingtone();
  const ac = ctx();
  if (!ac) return () => {};
  if (ac.state === "suspended") ac.resume().catch(() => {});
  let stopped = false;
  const cycle = () => {
    if (stopped) return;
    // Two-tone ring: 480 Hz + 620 Hz, 1s on, 2s off (PSTN-style)
    tone(480, 1000, 0.16, "sine", 0);
    tone(620, 1000, 0.14, "sine", 0);
    setTimeout(cycle, 3000);
  };
  cycle();
  _ringtoneStop = () => { stopped = true; };
  return _ringtoneStop;
}

export function stopRingtone() {
  if (_ringtoneStop) { _ringtoneStop(); _ringtoneStop = null; }
}

/** Outgoing dial tone — short repeated beep. Returns stop fn. */
export function startDialTone(): () => void {
  const ac = ctx();
  if (!ac) return () => {};
  if (ac.state === "suspended") ac.resume().catch(() => {});
  let stopped = false;
  const cycle = () => {
    if (stopped) return;
    tone(420, 400, 0.08, "sine", 0);
    setTimeout(cycle, 2200);
  };
  cycle();
  return () => { stopped = true; };
}
