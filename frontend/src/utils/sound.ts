/**
 * Web Audio API Sound Utility for TaskFlow Pro
 * Provides subtle, high-quality synthesized sound effects with zero external audio assets.
 */

const STORAGE_KEY = 'taskflow_sound_enabled';

class SoundManager {
  private ctx: AudioContext | null = null;
  private enabled: boolean;

  constructor() {
    this.enabled = localStorage.getItem(STORAGE_KEY) !== 'false';
  }

  private getContext(): AudioContext | null {
    if (!this.enabled) return null;
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setEnabled(val: boolean) {
    this.enabled = val;
    try {
      localStorage.setItem(STORAGE_KEY, val ? 'true' : 'false');
    } catch {
      // ignore
    }
  }

  /**
   * Subtle smooth tactile chime when a card is moved between columns
   */
  public playCardMoved() {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now); // A4
      osc.frequency.exponentialRampToValueAtTime(587.33, now + 0.12); // D5

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.22);
    } catch {
      // ignore audio errors
    }
  }

  /**
   * Harmonic celebration chime when dependent tasks become Ready
   */
  public playDependencyResolved() {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      // Arpeggio: C5 (523Hz) -> E5 (659Hz) -> G5 (784Hz)
      const notes = [523.25, 659.25, 783.99];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.08);

        gain.gain.setValueAtTime(0.1, now + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + i * 0.08);
        osc.stop(now + i * 0.08 + 0.35);
      });
    } catch {
      // ignore
    }
  }

  /**
   * Subtle rewind/undo chime
   */
  public playUndo() {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(392.0, now + 0.15); // G4

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.25);
    } catch {
      // ignore
    }
  }

  /**
   * Crisp tactile switch toggle click sound
   */
  public playSwitchToggle(on: boolean = true) {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      if (on) {
        osc.frequency.setValueAtTime(650, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.04);
      } else {
        osc.frequency.setValueAtTime(750, now);
        osc.frequency.exponentialRampToValueAtTime(520, now + 0.04);
      }

      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.05);
    } catch {
      // ignore
    }
  }
}

export const soundManager = new SoundManager();
