class ClockProcessor extends AudioWorkletProcessor {
  constructor(...args) {
    super(...args);

    this.dur = 1;
    this.initTime = currentTime;
    this.cbInterval = 1;
    this.samps = 0;
    this.prevSamps = 0;
    this.intercept = false;
    this.stream = [];

    this.port.onmessage = e => {
      if (e.data.type === 'init') {
        this.dur = e.data.duration;
        this.cbInterval = e.data.cbInterval;
        this.intercept = e.data.intercept;
      }
    };
  }
  process (inputs) {
    let stream = inputs[0][0];
    let inputLen = stream.length;
    this.samps = (this.samps+inputLen) % this.cbInterval;
    if (this.samps <= this.prevSamps) {
      let phase = (currentTime-this.initTime)/this.dur;
      if (phase >= 1) {
        phase = 1-Number.EPSILON;
      }
      this.port.postMessage({
        type: 'phase',
        phase: phase
      });

      if (this.intercept) {
        if (this.samps === this.prevSamps) {
          this.port.postMessage({
            type: 'intercept',
            stream: stream
          });
        } else {
          this.port.postMessage({
            type: 'intercept',
            stream: this.stream
          });
          this.stream = [stream];
        }
      }
    } else {
      if (this.intercept) {
        this.stream = this.stream.concat(stream);
      }
    }
    this.prevSamps = this.samps;
    return true;
  }
}

registerProcessor('clock-processor', ClockProcessor);