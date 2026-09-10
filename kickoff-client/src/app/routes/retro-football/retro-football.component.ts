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

/** Persisted so a Bluetooth pad that reports A/B backwards from what feels
 * natural only has to be fixed once, not every time the game reloads. */
const SWAP_FACE_BUTTONS_KEY = 'retro-football:swap-face-buttons';

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
  readonly controllerConnected = signal(false);
  readonly swapFaceButtons = signal(this.loadSwapFaceButtonsPreference());

  private nes: NesInstance | null = null;
  private audioHandler: NesAudioHandler | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private imageData: ImageData | null = null;
  private animationFrameId: number | null = null;
  private gamepadHeld: ReadonlySet<NesButtonName> = new Set();

  constructor() {
    // Bluetooth pads on Android often register as a real Gamepad AND
    // synthesize keyboard/navigation events for legacy TV-remote support --
    // the polling loop below reads the Gamepad API directly (see runFrame),
    // and the connect/disconnect events here are only for the on-screen badge.
    window.addEventListener('gamepadconnected', () => this.controllerConnected.set(true));
    window.addEventListener('gamepaddisconnected', () => this.controllerConnected.set(false));

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

  toggleFaceButtonSwap(): void {
    const next = !this.swapFaceButtons();
    this.swapFaceButtons.set(next);
    try {
      localStorage.setItem(SWAP_FACE_BUTTONS_KEY, String(next));
    } catch {
      // Private browsing / storage disabled -- the swap still works for this session.
    }
  }

  private loadSwapFaceButtonsPreference(): boolean {
    try {
      return localStorage.getItem(SWAP_FACE_BUTTONS_KEY) === 'true';
    } catch {
      return false;
    }
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
    this.pollGamepad();
    nes.runFrame();
    nes.getSamples(audioHandler.sampleBuffer, audioHandler.samplesPerFrame);
    audioHandler.nextBuffer();
    nes.getPixels(imageData.data);
    ctx.putImageData(imageData, 0, 0);
  }

  /** Polled once per rendered frame rather than event-driven -- the Gamepad
   * API only ever hands back a point-in-time snapshot, there's no
   * "gamepadbuttondown" event to hook. `held` is diffed against the previous
   * frame so NesJs still sees the same press/release edges the keyboard path
   * gives it. */
  private pollGamepad(): void {
    if (!this.nes) return;
    const pad = navigator.getGamepads().find((candidate): candidate is Gamepad => candidate !== null);
    const held = pad ? this.readGamepadButtons(pad) : new Set<NesButtonName>();

    for (const button of held) {
      if (!this.gamepadHeld.has(button)) this.nes.setButtonPressed(1, this.nes.INPUT[button]);
    }
    for (const button of this.gamepadHeld) {
      if (!held.has(button)) this.nes.setButtonReleased(1, this.nes.INPUT[button]);
    }
    this.gamepadHeld = held;
  }

  /** Standard Gamepad layout (Xbox/DualShock/Switch-Pro style pads all
   * normalize to this in Chrome). Face buttons are doubled up on purpose --
   * Tecmo only needs one throw/juke button and one turbo button, so whichever
   * one the controller labels "A" or "B" still does something useful.
   * `swapFaceButtons` flips which physical pair maps to NES A vs. B, for pads
   * that come out feeling backwards -- there's no way to remap this on the
   * KTC's kiosk browser itself. */
  private readGamepadButtons(pad: Gamepad): Set<NesButtonName> {
    const held = new Set<NesButtonName>();
    const pressed = (index: number) => pad.buttons[index]?.pressed ?? false;
    const AXIS_DEADZONE = 0.5;

    if (pressed(12) || pad.axes[1] < -AXIS_DEADZONE) held.add('UP');
    if (pressed(13) || pad.axes[1] > AXIS_DEADZONE) held.add('DOWN');
    if (pressed(14) || pad.axes[0] < -AXIS_DEADZONE) held.add('LEFT');
    if (pressed(15) || pad.axes[0] > AXIS_DEADZONE) held.add('RIGHT');
    const primaryFace = pressed(0) || pressed(3);
    const secondaryFace = pressed(1) || pressed(2);
    if (this.swapFaceButtons()) {
      if (secondaryFace) held.add('A');
      if (primaryFace) held.add('B');
    } else {
      if (primaryFace) held.add('A');
      if (secondaryFace) held.add('B');
    }
    if (pressed(8)) held.add('SELECT');
    if (pressed(9)) held.add('START');
    return held;
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (!this.nes) return;
    // Swallow every key while a game is running, not just mapped ones --
    // some Bluetooth pads dual-report as a gamepad AND a keyboard, and the
    // synthesized keys (Escape/Tab/etc.) were reaching Fully Kiosk's own
    // navigation instead of the game.
    event.preventDefault();
    event.stopPropagation();
    const button = KEY_MAP[event.key.toLowerCase()];
    if (button === undefined) return;
    this.nes.setButtonPressed(1, this.nes.INPUT[button]);
  }

  @HostListener('window:keyup', ['$event'])
  onKeyUp(event: KeyboardEvent): void {
    if (!this.nes) return;
    event.preventDefault();
    event.stopPropagation();
    const button = KEY_MAP[event.key.toLowerCase()];
    if (button === undefined) return;
    this.nes.setButtonReleased(1, this.nes.INPUT[button]);
  }
}
