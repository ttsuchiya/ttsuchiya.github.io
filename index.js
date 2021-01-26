import { Sonar as snr } from './lib/sonar.esm.js';

snr.alias('vector','v')
  .alias('matrix','m')
  .alias('tempo','t')
  .alias('transport', 'tp')
  .alias('clock','c')
  .alias('waveform','wf')
  .alias('wavetable','wt')
  .alias('fetch','f')
  .alias('ringbuf', 'rb')
  .alias('Utility', 'util');

snr.clock.setAudioWorklet('./lib/clock.js');
snr.import('./lib/fft.esm.js', null, {
  fft: function (...args) {
    let res = this.of(...args);
    if (args.length === 1) {
      res = res.append(snr.v.const(args[0].length,0));
    }
    return res;
  }
});

window.snr = snr;