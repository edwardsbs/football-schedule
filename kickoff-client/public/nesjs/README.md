# NesJs (vendored)

Source: https://github.com/angelo-wf/NesJs (MIT, see `LICENSE.txt`). The `nes/` and `mappers/` files are unmodified upstream, verified against mapper 4 (MMC3) for Kickoff's Retro Football mini-game — see `nesjs-loader.ts` for load order and usage.

Plain global scripts, not an npm package -- loaded on demand by `NesjsLoaderService`, not bundled into the app's main JS.

## Local patch: `js/audio.js`

Upstream's `AudioHandler` uses a 4096-sample ring buffer with a 2048-sample `ScriptProcessorNode` callback. That leaves only about one callback's worth of slack between the producer (fed once per `requestAnimationFrame`, which jitters under load — especially on the KTC tablet's Android WebView) and the consumer (the steady hardware audio clock) before the buffer's own overrun/underrun correction kicks in — and each correction is a hard jump in the waveform, audible as a pop or click.

Patched to a 16384-sample ring buffer and a 4096-sample callback (both still powers of two, required for the `& RING_MASK` trick) to quadruple that slack, trading a bit more audio latency for far fewer pops. If updating this file from upstream, reapply that sizing change (`RING_SIZE`/`RING_MASK`/`CALLBACK_SIZE` in `AudioHandler`) rather than overwriting it outright.
