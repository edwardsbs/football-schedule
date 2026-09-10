import { ChangeDetectionStrategy, Component, ElementRef, HostListener, NgZone, OnDestroy, effect, inject, signal, viewChild } from '@angular/core';
import { NesAudioHandler, NesInstance, NesjsLoaderService } from '../../core/services/nesjs-loader';

type NesButtonName = keyof NesInstance['INPUT'];

/** Same mapping NesJs's own reference demo uses -- kept identical since it's
 * exactly what was already verified working in the Step 0 spike. */
const KEY_MAP: Record<string, NesButtonName> = {
  arrowright: 'RIGHT',
  arrowleft: 'LEFT',
  arrowdown: 'DOWN',
  arrowup: 'UP',
  enter: 'START',
  shift: 'SELECT',
  z: 'B',
  a: 'A',
};

/**
 * Phase 1 of the Retro Football mini-game: NesJs wired into a real Angular
 * component. Deliberately just Tecmo Super Bowl -- selecting this game from
 * the Mini-Games hub goes straight here, no ROM picker menu.
 *
 * The ROM itself is never bundled, fetched, or committed -- ROMs/ and *.nes
 * are gitignored (this repo is public), and this component only ever reads a
 * file the user picks locally, matching how every legitimate browser-based
 * emulator front-end works. Phase 2 adds IndexedDB caching so that pick only
 * has to happen once per browser profile; for now it's once per visit.
 */
@Component({
  selector: 'app-retro-football',
  templateUrl: './retro-football.component.html',
  styleUrl: './retro-football.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RetroFootballComponent implements OnDestroy {
  private readonly nesjsLoader = inject(NesjsLoaderService);
  private readonly ngZone = inject(NgZone);

  private readonly romInput = viewChild<ElementRef<HTMLInputElement>>('romInput');
  private readonly screen = viewChild<ElementRef<HTMLCanvasElement>>('screen');

  readonly romLoaded = signal(false);
  readonly loadingCore = signal(false);
  readonly paused = signal(false);
  readonly errorMessage = signal<string | null>(null);

  private nes: NesInstance | null = null;
  private audioHandler: NesAudioHandler | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private imageData: ImageData | null = null;
  private animationFrameId: number | null = null;

  constructor() {
    // Warm the loader in the background as soon as this route opens, so
    // there's a good chance the scripts are already in place by the time the
    // user has picked their ROM file.
    this.nesjsLoader.load().catch(() => {
      // Swallowed here on purpose -- a real failure surfaces to the user
      // only if it's still unresolved when they actually try to load a ROM.
    });

    // The canvas only exists in the DOM once romLoaded flips (it's behind an
    // @if), so react to the viewChild signal itself rather than guessing at
    // timing with a microtask/setTimeout -- this fires exactly once Angular
    // has actually rendered the element, whatever its internal CD scheduling
    // happens to be.
    effect(() => {
      const canvas = this.screen()?.nativeElement;
      if (canvas && !this.ctx) this.setUpCanvasAndStart(canvas);
    });
  }

  ngOnDestroy(): void {
    this.stopLoop();
    this.audioHandler?.stop();
  }

  promptForRom(): void {
    this.errorMessage.set(null);
    this.romInput()?.nativeElement.click();
  }

  onRomSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      void this.startEmulation(new Uint8Array(reader.result as ArrayBuffer));
    };
    reader.onerror = () => this.errorMessage.set('Could not read that file. Please try again.');
    reader.readAsArrayBuffer(file);
  }

  private async startEmulation(rom: Uint8Array): Promise<void> {
    this.loadingCore.set(true);
    this.errorMessage.set(null);
    try {
      const { Nes, AudioHandler } = await this.nesjsLoader.load();
      const nes = new Nes();
      if (!nes.loadRom(rom)) {
        this.errorMessage.set(
          'This file couldn’t be loaded — make sure it’s a valid Tecmo Super Bowl .nes ROM file.',
        );
        return;
      }

      this.nes = nes;
      nes.reset(true);

      const audioHandler = new AudioHandler();
      audioHandler.resume();
      this.audioHandler = audioHandler;

      this.romLoaded.set(true);
    } catch {
      this.errorMessage.set('The emulator core failed to load. Check your connection and try again.');
    } finally {
      this.loadingCore.set(false);
    }
  }

  private setUpCanvasAndStart(canvas: HTMLCanvasElement): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    this.ctx = ctx;
    this.imageData = ctx.createImageData(256, 240);
    this.audioHandler?.start();
    this.startLoop();
  }

  togglePause(): void {
    if (!this.nes) return;
    if (this.paused()) {
      this.paused.set(false);
      this.audioHandler?.start();
      this.startLoop();
    } else {
      this.paused.set(true);
      this.audioHandler?.stop();
      this.stopLoop();
    }
  }

  softReset(): void {
    this.nes?.reset(false);
  }

  hardReset(): void {
    this.nes?.reset(true);
  }

  private startLoop(): void {
    this.stopLoop();
    this.ngZone.runOutsideAngular(() => {
      const loop = () => {
        this.runFrame();
        this.animationFrameId = requestAnimationFrame(loop);
      };
      this.animationFrameId = requestAnimationFrame(loop);
    });
  }

  private stopLoop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private runFrame(): void {
    const { nes, audioHandler, ctx, imageData } = this;
    if (!nes || !audioHandler || !ctx || !imageData) return;
    nes.runFrame();
    nes.getSamples(audioHandler.sampleBuffer, audioHandler.samplesPerFrame);
    audioHandler.nextBuffer();
    nes.getPixels(imageData.data);
    ctx.putImageData(imageData, 0, 0);
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (!this.nes) return;
    const button = KEY_MAP[event.key.toLowerCase()];
    if (button === undefined) return;
    this.nes.setButtonPressed(1, this.nes.INPUT[button]);
    event.preventDefault();
  }

  @HostListener('window:keyup', ['$event'])
  onKeyUp(event: KeyboardEvent): void {
    if (!this.nes) return;
    const button = KEY_MAP[event.key.toLowerCase()];
    if (button === undefined) return;
    this.nes.setButtonReleased(1, this.nes.INPUT[button]);
    event.preventDefault();
  }
}
