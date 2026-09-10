
function AudioHandler() {

  this.hasAudio = true;
  let Ac = window.AudioContext || window.webkitAudioContext;
  this.sampleBuffer = new Float64Array(735);
  this.samplesPerFrame = 735;

  // Kickoff tuning (see kickoff-client/public/nesjs/README.md): upstream used
  // a 4096-sample ring buffer with a 2048-sample ScriptProcessor callback,
  // leaving only ~1 callback's worth of slack between the rAF-paced producer
  // and the steady hardware audio clock before a correction fires below --
  // and every correction is a hard jump in the waveform, heard as a pop.
  // Widening both quadruples that slack, trading a bit more audio latency
  // (harmless for a football game) for far fewer pops.
  const RING_SIZE = 16384; // must stay a power of two -- see the `& RING_MASK` below
  const RING_MASK = RING_SIZE - 1;
  const CALLBACK_SIZE = 4096;

  if(Ac === undefined) {
    log("Audio disabled: no Web Audio API support");
    this.hasAudio = false;
  } else {
    this.actx = new Ac();

    let samples = this.actx.sampleRate / 60;
    this.sampleBuffer = new Float64Array(samples);
    this.samplesPerFrame = samples;

    log("Audio initialized, sample rate: " + samples * 60);

    this.inputBuffer = new Float64Array(RING_SIZE);
    this.inputBufferPos = 0;
    this.inputReadPos = 0;

    this.scriptNode = undefined;
    this.dummyNode = undefined;
  }

  this.resume = function() {
    // for Chrome autoplay policy
    if(this.hasAudio) {
      this.actx.onstatechange = function() { console.log(this.actx.state) };
      this.actx.resume();
    }
  }

  this.start = function() {
    if(this.hasAudio) {

      this.dummyNode = this.actx.createBufferSource();
      this.dummyNode.buffer = this.actx.createBuffer(1, 44100, 44100);
      this.dummyNode.loop = true;

      this.scriptNode = this.actx.createScriptProcessor(CALLBACK_SIZE, 1, 1);
      let that = this;
      this.scriptNode.onaudioprocess = function(e) {
        that.process(e);
      }

      this.dummyNode.connect(this.scriptNode);
      this.scriptNode.connect(this.actx.destination);
      this.dummyNode.start();

    }
  }

  this.stop = function() {
    if(this.hasAudio) {
      if(this.dummyNode) {
        this.dummyNode.stop();
        this.dummyNode.disconnect();
        this.dummyNode = undefined;
      }
      if(this.scriptNode) {
        this.scriptNode.disconnect();
        this.scriptNode = undefined;
      }
      this.inputBufferPos = 0;
      this.inputReadPos = 0;
    }
  }

  this.process = function(e) {
    if(this.inputReadPos + CALLBACK_SIZE > this.inputBufferPos) {
      // we overran the buffer
      //log("Audio buffer overran");
      this.inputReadPos = this.inputBufferPos - CALLBACK_SIZE;
    }
    if(this.inputReadPos + RING_SIZE < this.inputBufferPos) {
      // we underran the buffer
      //log("Audio buffer underran");
      this.inputReadPos += CALLBACK_SIZE;
    }
    let output = e.outputBuffer.getChannelData(0);
    for(let i = 0; i < CALLBACK_SIZE; i++) {
      output[i] = this.inputBuffer[(this.inputReadPos++) & RING_MASK];
    }
  }

  this.nextBuffer = function() {
    if(this.hasAudio) {
      for(let i = 0; i < this.samplesPerFrame; i++) {
        let val = this.sampleBuffer[i];
        this.inputBuffer[(this.inputBufferPos++) & RING_MASK] = val;
      }
    }
  }
}
