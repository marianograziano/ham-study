export class SoundManager {
  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      const AudioCtx =
        window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.audioCtx = new AudioCtx();
        this.masterGain = this.audioCtx.createGain();
        this.masterGain.connect(this.audioCtx.destination);
        this.masterGain.gain.value = 0.3; // Global volume
      }
    }
  }

  private ensureContext() {
    if (!this.audioCtx) return false;
    if (this.audioCtx.state === "suspended") {
      this.audioCtx
        .resume()
        .catch((err) => console.error("Audio resume failed", err));
    }
    return true;
  }

  public playDit() {
    if (!this.ensureContext() || !this.audioCtx || !this.masterGain) return;

    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.connect(gain);
    gain.connect(this.masterGain);

    const now = this.audioCtx.currentTime;
    osc.frequency.value = 600;
    osc.type = "sine";

    // Envelope to avoid clicking
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + 0.005);
    gain.gain.setValueAtTime(1, now + 0.075);
    gain.gain.linearRampToValueAtTime(0, now + 0.08);

    osc.start(now);
    osc.stop(now + 0.08);
  }

  public playDah() {
    if (!this.ensureContext() || !this.audioCtx || !this.masterGain) return;

    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.connect(gain);
    gain.connect(this.masterGain);

    const now = this.audioCtx.currentTime;
    osc.frequency.value = 600;
    osc.type = "sine";

    // Envelope
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + 0.005);
    gain.gain.setValueAtTime(1, now + 0.235);
    gain.gain.linearRampToValueAtTime(0, now + 0.24);

    osc.start(now);
    osc.stop(now + 0.24);
  }

  public playError() {
    if (!this.ensureContext() || !this.audioCtx || !this.masterGain) return;

    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.connect(gain);
    gain.connect(this.masterGain);

    const now = this.audioCtx.currentTime;
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.linearRampToValueAtTime(100, now + 0.15);

    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  public playDamage() {
    if (!this.ensureContext() || !this.audioCtx || !this.masterGain) return;

    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.connect(gain);
    gain.connect(this.masterGain);

    const now = this.audioCtx.currentTime;
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(100, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.3);

    gain.gain.setValueAtTime(1.0, now); // Louder for damage
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

    osc.start(now);
    osc.stop(now + 0.3);
  }
}

export const soundManager = new SoundManager();
