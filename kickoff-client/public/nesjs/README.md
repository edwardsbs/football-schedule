# NesJs (vendored)

Source: https://github.com/angelo-wf/NesJs (MIT, see `LICENSE.txt`). The `nes/` and `mappers/` files are unmodified upstream, verified against mapper 4 (MMC3) for Kickoff's Retro Football mini-game — see `nesjs-loader.ts` for load order and usage.

Plain global scripts, not an npm package -- loaded on demand by `NesjsLoaderService`, not bundled into the app's main JS.

## Local patch: `js/audio.js`

Upstream's `AudioHandler` uses a 4096-sample ring buffer with a 2048-sample `ScriptProcessorNode` callback. That leaves only about one callback's worth of slack between the producer (fed once per `requestAnimationFrame`, which jitters under load — especially on the KTC tablet's Android WebView) and the consumer (the steady hardware audio clock) before the buffer's own overrun/underrun correction kicks in — and each correction is a hard jump in the waveform, audible as a pop or click.

Patched to a 16384-sample ring buffer and a 4096-sample callback (both still powers of two, required for the `& RING_MASK` trick) to quadruple that slack, trading a bit more audio latency for far fewer pops.

That alone wasn't the real fix, though -- on the KTC tablet the pops persisted, because the actual bug is one level up in `retro-football.component.ts`. `nextBuffer()` always enqueues exactly `samplesPerFrame` (one 1/60s slice) per call, on the assumption that it's called at a steady 60Hz. If the device driving it can't actually sustain 60 `requestAnimationFrame` callbacks/sec, every call still only enqueues 1/60s of audio despite more real time having passed -- a systematic, ever-growing shortfall no buffer size can outrun, which is exactly why widening this one only delayed the pops instead of fixing them.

A follow-up attempt moved emulation stepping into this file's own audio callback (pulling `nes.runFrame()` on demand via a `stepCallback` hook) to pace it off the audio hardware's clock instead of rAF. That's since been reverted -- `ScriptProcessorNode` timing on this Android WebView wasn't reliable enough to fix the pops, and running emulation in bursts inside the audio callback made on-screen motion visibly choppy. The real fix belongs entirely in the component: track real elapsed time between `requestAnimationFrame` callbacks and step the emulator as many (or as few) times as that elapsed time actually calls for, instead of assuming exactly one step per tick. See the `FRAME_MS`/accumulator logic in `retro-football.component.ts`'s render loop.

If updating this file from upstream, reapply the `RING_SIZE`/`RING_MASK`/`CALLBACK_SIZE` sizing change above rather than overwriting it outright.
