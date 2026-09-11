# NesJs (vendored)

Source: https://github.com/angelo-wf/NesJs (MIT, see `LICENSE.txt`). Unmodified from the upstream `nes/`, `mappers/`, and `js/audio.js` files, verified against mapper 4 (MMC3) for Kickoff's Retro Football mini-game — see `nesjs-loader.ts` for load order and usage.

Plain global scripts, not an npm package -- loaded on demand by `NesjsLoaderService`, not bundled into the app's main JS.

## Known issue: audio popping, specific to Tecmo Super Bowl's mapper

Audio pops occasionally on both a laptop and the KTC tablet, worse on the tablet. Other ROMs on simpler mappers run clean on the same device -- confirmed by the user swapping ROMs in directly -- which points at mapper 4 (MMC3) itself, not a timing bug in this vendoring.

Two things make MMC3 more expensive per frame than a simple mapper: `mappers/mmc3.js`'s `ppuRead()` does extra bookkeeping on every single PPU memory read to detect the A12 signal edge that drives its scanline IRQ (the trick Tecmo Super Bowl uses to keep its scoreboard bar static while the field scrolls), and `nes/pipu.js` emulates the PPU one dot (pixel) at a time rather than in batched chunks -- accurate, but not a fast design in JS. Tecmo Super Bowl also switches CHR banks roughly once per scanline for that HUD split, adding real per-frame CPU cost on top. None of this is a bug in the vendored code; it's inherent overhead a naive JS interpreter-style emulator pays for this specific mapper and this specific game's use of it.

Three fixes were tried and rolled back before this was traced to the ROM's mapper rather than a timing bug: widening `AudioHandler`'s ring buffer only delayed the pops, pacing emulation off the audio callback's own clock instead of `requestAnimationFrame` fixed neither the pops nor the slightly choppier motion it introduced, and a `requestAnimationFrame`-delta-time accumulator didn't fix either symptom. All three assumed a synchronization bug; the real constraint is a CPU budget ceiling this device can't clear for this particular mapper, which no pacing change can fix. `js/audio.js` is back to unmodified upstream. Left as a known, accepted limitation -- fixing it for real would mean either moving emulation off the main thread (Web Worker) or replacing NesJs with a faster (e.g. WASM-based) core, both bigger undertakings than this game currently justifies.
