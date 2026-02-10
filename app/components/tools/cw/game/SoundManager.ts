export class SoundManager {
  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private fadingGain: GainNode | null = null;
  private fadingLfo: OscillatorNode | null = null;
  private qsbDepth: number = 0;
  private noiseNode: AudioBufferSourceNode | null = null;
  private noiseGain: GainNode | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      const AudioCtx =
        window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.audioCtx = new AudioCtx();
        this.masterGain = this.audioCtx.createGain();
        this.masterGain.connect(this.audioCtx.destination);
        this.masterGain.gain.value = 0.3; // Global volume

        // Fading Gain Node (QSB)
        this.fadingGain = this.audioCtx.createGain();
        this.fadingGain.connect(this.masterGain);
        this.fadingGain.gain.value = 1.0; // Default to full volume (no fading)

        this.noiseGain = this.audioCtx.createGain();
        this.noiseGain.connect(this.masterGain);
        this.noiseGain.gain.value = 0;
      }
    }
  }

  // --- Noise Generator (Pink Noise) ---
  public startNoise(volume: number = 0.1) {
    if (!this.ensureContext() || !this.audioCtx || !this.noiseGain) return;

    // Stop existing noise if any
    this.stopNoise();

    const bufferSize = 2 * this.audioCtx.sampleRate; // 2 seconds buffer
    const buffer = this.audioCtx.createBuffer(
      1,
      bufferSize,
      this.audioCtx.sampleRate,
    );
    const data = buffer.getChannelData(0);

    // Pink noise generation algorithm (Paul Kellet's refined method)
    let b0 = 0,
      b1 = 0,
      b2 = 0,
      b3 = 0,
      b4 = 0,
      b5 = 0,
      b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      data[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      data[i] *= 0.11; // (roughly) compensate for gain
      b6 = white * 0.115926;
    }

    this.noiseNode = this.audioCtx.createBufferSource();
    this.noiseNode.buffer = buffer;
    this.noiseNode.loop = true;
    this.noiseNode.connect(this.noiseGain);

    // Smooth start
    const now = this.audioCtx.currentTime;
    this.noiseGain.gain.setValueAtTime(0, now);
    this.noiseGain.gain.linearRampToValueAtTime(volume, now + 0.5);

    this.noiseNode.start(now);
  }

  public stopNoise() {
    if (this.noiseNode) {
      try {
        // Fade out
        if (this.audioCtx && this.noiseGain) {
          const now = this.audioCtx.currentTime;
          this.noiseGain.gain.cancelScheduledValues(now);
          this.noiseGain.gain.setValueAtTime(this.noiseGain.gain.value, now);
          this.noiseGain.gain.linearRampToValueAtTime(0, now + 0.2);
          this.noiseNode.stop(now + 0.2);
        } else {
          this.noiseNode.stop();
        }
      } catch (_e) {
        // ignore
      }
      this.noiseNode = null;
    }
  }

  public setNoiseVolume(volume: number) {
    if (this.noiseGain && this.audioCtx) {
      const now = this.audioCtx.currentTime;
      this.noiseGain.gain.cancelScheduledValues(now);
      this.noiseGain.gain.linearRampToValueAtTime(volume, now + 0.1);
    }
  }

  // --- QSB (Signal Fading) ---
  public setQsb(depth: number) {
    // depth: 0 to 100
    this.qsbDepth = depth;
    if (!this.ensureContext() || !this.audioCtx || !this.fadingGain) return;

    // Reset fadingGain to 1.0 (we handle QSB in playSequence now)
    this.stopQsb();
  }

  public stopQsb() {
    if (this.fadingLfo) {
      try {
        this.fadingLfo.stop();
        this.fadingLfo.disconnect();
      } catch (_e) {}
      this.fadingLfo = null;
    }
    // Reset gain to 1.0
    if (this.fadingGain && this.audioCtx) {
      this.fadingGain.gain.cancelScheduledValues(this.audioCtx.currentTime);
      this.fadingGain.gain.setValueAtTime(1.0, this.audioCtx.currentTime);
    }
  }

  // --- Morse Sequencer ---
  public playSequence(
    text: string,
    wpm: number = 20,
    frequency: number = 600,
    callback?: () => void,
    farnsworth?: number,
  ) {
    if (
      !this.ensureContext() ||
      !this.audioCtx ||
      !this.masterGain ||
      !this.fadingGain
    )
      return;

    // Timing calculations
    const charWpm = wpm;
    // Farnsworth speed usually applies to spacing. If farnsworth is provided and less than wpm, use it for spacing.
    const spacingWpm = farnsworth && farnsworth < wpm ? farnsworth : wpm;

    const charUnitTime = 1.2 / charWpm;
    const spacingUnitTime = 1.2 / spacingWpm;

    const now = this.audioCtx.currentTime + 0.1; // Start with slight delay
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = "sine";
    osc.frequency.value = frequency;

    osc.connect(gain);
    // Connect to Fading Gain instead of Master directly, so QSB applies to the signal
    gain.connect(this.fadingGain);

    let currentTime = now;
    gain.gain.value = 0;

    const MORSE_MAP: Record<string, string> = {
      A: ".-",
      B: "-...",
      C: "-.-.",
      D: "-..",
      E: ".",
      F: "..-.",
      G: "--.",
      H: "....",
      I: "..",
      J: ".---",
      K: "-.-",
      L: ".-..",
      M: "--",
      N: "-.",
      O: "---",
      P: ".--.",
      Q: "--.-",
      R: ".-.",
      S: "...",
      T: "-",
      U: "..-",
      V: "...-",
      W: ".--",
      X: "-..-",
      Y: "-.--",
      Z: "--..",
      "1": ".----",
      "2": "..---",
      "3": "...--",
      "4": "....-",
      "5": ".....",
      "6": "-....",
      "7": "--...",
      "8": "---..",
      "9": "----.",
      "0": "-----",
      "/": " ",
      " ": " ",
    };

    const upperText = text.toUpperCase();

    for (let i = 0; i < upperText.length; i++) {
      const char = upperText[i];
      if (char === " " || char === "/") continue; // Handled by lookahead or specific spacing

      const pattern = MORSE_MAP[char];
      if (!pattern) continue;

      for (let j = 0; j < pattern.length; j++) {
        const symbol = pattern[j];
        const duration = symbol === "." ? 1 : 3;

        // Key Down
        // Apply QSB (random amplitude per symbol)
        let vol = 1.0;
        if (this.qsbDepth > 0) {
          // Random drop in volume based on depth
          // Example: depth 50 means vol can drop to 0.5
          // We want "some sounds to be smaller", not all.
          // Let's use a random factor.
          const variance = (Math.random() * this.qsbDepth) / 100;
          vol = 1.0 - variance;
        }
        gain.gain.setValueAtTime(vol, currentTime);
        currentTime += duration * charUnitTime;

        // Key Up
        gain.gain.setValueAtTime(0, currentTime);

        // Inter-element space (1 unit) - always standard WPM
        // Except for the last element, where we calculate inter-char/word spacing
        currentTime += 1 * charUnitTime;
      }

      // Determine spacing after this character
      if (i < upperText.length - 1) {
        const nextChar = upperText[i + 1];
        if (nextChar === " " || nextChar === "/") {
          // Word Spacing (7 units)
          // We have already added 1 charUnitTime of silence at the end of the symbol loop.
          // Requirement: Total silence = 7 * spacingUnitTime
          // Adjustment: (7 * spacingUnitTime) - (1 * charUnitTime)
          const delay = 7 * spacingUnitTime - 1 * charUnitTime;
          currentTime += Math.max(0, delay);
        } else {
          // Character Spacing (3 units)
          // Requirement: Total silence = 3 * spacingUnitTime
          // Adjustment: (3 * spacingUnitTime) - (1 * charUnitTime)
          const delay = 3 * spacingUnitTime - 1 * charUnitTime;
          currentTime += Math.max(0, delay);
        }
      }
    }

    osc.start(now);
    osc.stop(currentTime);

    osc.onended = () => {
      if (callback) callback();
    };

    return osc;
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
    if (
      !this.ensureContext() ||
      !this.audioCtx ||
      !this.masterGain ||
      !this.fadingGain
    )
      return;

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
    if (
      !this.ensureContext() ||
      !this.audioCtx ||
      !this.masterGain ||
      !this.fadingGain
    )
      return;

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

  public playSuccess() {
    if (!this.ensureContext() || !this.audioCtx || !this.masterGain) return;

    const now = this.audioCtx.currentTime;
    const gain = this.audioCtx.createGain();
    gain.connect(this.masterGain);

    // Tone 1: 880Hz (A5)
    const osc1 = this.audioCtx.createOscillator();
    osc1.type = "sine";
    osc1.frequency.value = 880;
    osc1.connect(gain);
    osc1.start(now);
    osc1.stop(now + 0.1);

    // Tone 2: 1760Hz (A6) - High beep
    const osc2 = this.audioCtx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.value = 1760;
    osc2.connect(gain);
    osc2.start(now + 0.1);
    osc2.stop(now + 0.2);

    // Envelope
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.3, now + 0.02);
    gain.gain.setValueAtTime(0.3, now + 0.18);
    gain.gain.linearRampToValueAtTime(0, now + 0.2);
  }
}

export const soundManager = new SoundManager();
