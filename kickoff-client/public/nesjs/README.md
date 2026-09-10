# NesJs (vendored)

Source: https://github.com/angelo-wf/NesJs (MIT, see `LICENSE.txt`). Unmodified from the upstream `nes/`, `mappers/`, and `js/audio.js` files, verified against mapper 4 (MMC3) for Kickoff's Retro Football mini-game — see `nesjs-loader.ts` for load order and usage.

Plain global scripts, not an npm package -- loaded on demand by `NesjsLoaderService`, not bundled into the app's main JS.

## Known issue: audio popping on the KTC tablet

Audio pops occasionally on both a laptop and the KTC tablet, worse on the tablet. Traced to `AudioHandler`'s small ring buffer (`js/audio.js`) combined with `retro-football.component.ts`'s render loop assuming a steady 60 `requestAnimationFrame` ticks/sec -- if the device can't sustain that, generated audio quietly falls behind real playback speed. Two fixes were tried and rolled back: widening the ring buffer only delayed the pops rather than fixing them, and pacing emulation off the audio callback's own clock instead of rAF fixed neither the pops nor introduced visibly choppier motion. Reverted to upstream as-is rather than keep iterating; left as a known rough edge.
