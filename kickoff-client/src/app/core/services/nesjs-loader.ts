import { Injectable } from '@angular/core';

/** The subset of NesJs's `Nes` instance API this app actually calls.
 * NesJs (github.com/angelo-wf/NesJs, MIT) has no type definitions of its
 * own -- it's plain global scripts, not an npm package. */
export interface NesInstance {
  readonly INPUT: {
    RIGHT: number;
    LEFT: number;
    DOWN: number;
    UP: number;
    START: number;
    SELECT: number;
    B: number;
    A: number;
  };
  loadRom(rom: Uint8Array): boolean;
  reset(hard: boolean): void;
  runFrame(): void;
  getPixels(target: Uint8ClampedArray): void;
  getSamples(target: Float64Array, count: number): void;
  setButtonPressed(player: number, button: number): void;
  setButtonReleased(player: number, button: number): void;
  getState(): unknown;
  setState(state: unknown): boolean;
}

export interface NesAudioHandler {
  sampleBuffer: Float64Array;
  samplesPerFrame: number;
  resume(): void;
  start(): void;
  stop(): void;
  nextBuffer(): void;
}

export interface NesjsGlobals {
  Nes: new () => NesInstance;
  AudioHandler: new () => NesAudioHandler;
}

/** Vendored under public/nesjs/ (see LICENSE.txt there) -- served as plain
 * static files, loaded in this exact order because NesJs's mapper/CPU/PPU
 * files depend on globals defined by the files before them. */
const NESJS_SCRIPTS = [
  '/nesjs/nes/mappers.js',
  '/nesjs/mappers/nrom.js',
  '/nesjs/mappers/mmc1.js',
  '/nesjs/mappers/uxrom.js',
  '/nesjs/mappers/cnrom.js',
  '/nesjs/mappers/mmc3.js',
  '/nesjs/mappers/axrom.js',
  '/nesjs/nes/cpu.js',
  '/nesjs/nes/pipu.js',
  '/nesjs/nes/apu.js',
  '/nesjs/nes/nes.js',
  '/nesjs/js/audio.js',
];

/**
 * Loads the vendored NesJs emulator core on demand. It's a set of plain
 * global scripts (no module system, no npm package), so rather than adding
 * ~90KB to every page via angular.json's (eager) `scripts` array, this
 * injects them the first time the Retro Football game is actually opened.
 * The result is cached -- revisiting the route reuses the same globals
 * instead of re-injecting and redefining them.
 */
@Injectable({ providedIn: 'root' })
export class NesjsLoaderService {
  private loadPromise: Promise<NesjsGlobals> | null = null;

  load(): Promise<NesjsGlobals> {
    if (!this.loadPromise) this.loadPromise = this.loadSequentially();
    return this.loadPromise;
  }

  private async loadSequentially(): Promise<NesjsGlobals> {
    // NesJs's own source calls a global log() for its status messages.
    const globalWindow = window as unknown as { log?: (message: string) => void };
    globalWindow.log ??= (message: string) => console.log('[NesJs]', message);

    for (const src of NESJS_SCRIPTS) {
      await this.loadScript(src);
    }

    const globals = window as unknown as Partial<NesjsGlobals>;
    if (!globals.Nes || !globals.AudioHandler) {
      throw new Error('NesJs scripts loaded but did not define the expected globals.');
    }
    return { Nes: globals.Nes, AudioHandler: globals.AudioHandler };
  }

  private loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.body.appendChild(script);
    });
  }
}
