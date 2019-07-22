import {Matrix, Tempo, Vector, Waveform, Clock} from './lib/lib.js';

window.V = window.Vector = Vector;
window.M = window.Matrix = Matrix;
window.T = window.Tempo = Tempo;
window.W = window.Waveform = Waveform;
window.C = window.Clock = Clock;

function unspread(args) {
  return args.length===1 && ['Vector','Matrix','Tempo','WaveTable','Array'].includes(args[0].constructor.name) ? args[0] : args;
}

V.augment('mtow', function () {
  return V.from(dtm.data(this).fft.magtowav().get());
});

M.augment('mtow', function () {
  return this.map(v => v.mtow());
});

V.augment('compose', function (phase) {
  return V.from(dtm.data(this).fft.compose(dtm.data(phase)).get());
});

V.augment('mag', function () {
  return V.from(dtm.data(this).fft.mag().get());
});

V.augment('PQ', function(...args) {
  let sc = unspread(args);
  if (sc.length === 0) sc = V.range(11);

  return this.map(v => {
    var pc = v % 12;
    var oct = v - pc;
    var idx = Math.floor(pc/12*sc.length);
    var frac = v % 1;
    return oct + sc[idx] + frac;
  });
});

T.augment('genSoundComponents', function (indices, resolution, numSegments) {
  let baseSpectra = (i) => {
    switch (i) {
      case 0:
        return M.of(V.comb(this.block, 50, 1, .05)).downsample(2);
      case 1:
        return M.from(V.mix(V.range(30, 120).PQ(0, 5, 7, 10, 14).unique().mtof().map(v => V.comb(this.block, 4, 1, 1 / 500, 0).rotate(-this.freqtobin(v)))));
      case 2:
        return M.of(
          V.comb(this.block, 5),
          V.comb(this.block, 9),
          V.comb(this.block, 13)
        ).phase(V.phasor(resolution)).downsample(2);
      case 3:
        return M.of(
          V.comb(this.block, 8),
          V.random(this.block)
        ).phase(V.phasor(resolution)).downsample(2);
      case 4:
        return M.of(V.mix(
          V.comb(this.block, 10, 1, 0, 0.2),
          V.comb(this.block, 21, 0.5, 0, 0.21),
          V.comb(this.block, 31, 0.5, 0, 0.22)
        )).downsample(2);
      default:
        return;
    }
  };

  let spectalEnvs = (i) => {
    switch (i) {
      case 0:
        return M.from(V.of(.001, 3).phase(V.phasor(resolution).expscale(20)).map(v => V.lognormal(this.block, v))).downsample(2);
      case 1:
        return M.of(
          V.lognormal(this.block),
          V.random(this.block)
        ).phase(V.phasor(resolution)).downsample(2);
      default:
        return;
    }
  };


  let ampMods = (i) => {
    switch (i) {
      case 0:
        return V.hamming(this.outSamps/numSegments);
      case 1:
        return V.decay(Math.round(this.outSamps/numSegments)).expscale(10);
      case 2:
        return V.sin(Math.round(this.outSamps/numSegments),2);
      case 3:
        return V.of(1,0).phasestep(V.phasor(Math.round(this.outSamps/numSegments),5));
      default:
        return;
    }
  };

  // TODO: Pattern lengths / combination
  return [baseSpectra(indices[0]%5),
    spectalEnvs(indices[1]%2),
    ampMods(indices[2]%4)];
});

// let actx = new (window.AudioContext || window.webkitAudioContext)();
let t, p;

let testData = {
  values: null
};

let userData = {
  results: []
};

const app = new Vue({
  el: '#app',
  data: {
    info: {
      title: 'Timbral Sonification Listening Test'
    },
    data: null,
    dataLoaded: null,
    selection: null,

    sliders: null,
    numSliders: 8,
    numReferences: 3,
    references: [],
    sliderChangeEvents: [],
    sliderSize: 20,

    containers: {
      left: {
        dim: [600]
      }
    },

    sliderBox: {
      svg: null,
      dim: [600,200]
    },

    playerBox: {
      dim: [600,100],
      background: {
        svg: null,
        id: '#player-background'
      },
      playhead: {
        svg: null,
        id: '#playhead',
        lineFn: null,
        phase: 0
      },
      // player: null, // Array subclass overwritten by Vue.
    },
    loop: false,
    loopToggleColor: 'white',
    readyToSubmit: false,

    testState: 'loading',
    proceedButtonText: 'Start Test',
    currentStage: 1,
    totalStages: 20,

    highlightLocked: false,

    waveform: {
      canvas: null,
      ctx: null
    },
    spectrum: {
      canvas: null,
      ctx: null
    },

    // tempo: null, // Array subclass mutated into Array by Vue...
    cursorAt: null,

    sound: {
      duration: 5,
      blockSize: Math.pow(2,13),
      hopRatio: 1/4,
      wtResolution: 25,
      downsample: 2,
      signal: null
    },

soundAttributes: ['Relaxed-Tense','Dark-Bright','Natural-Mechanic','Gentle-Metallic','Soft-Hard','Warm-Cold','Clear-Muffled','Smooth-Rough','Close-Distant','Stable-Noisy','Steady-Fluctuating','Narrow-Broad','Natural-Unnatural','Thin-Rich','Pleasant-Unpleasant'],
    selectedAttributes: [],
    attrSelectionMax: 3
  },
  computed: {
    cssProps() {
      return {
        '--left-container-width': this.containers.left.dim[0]+'px',
        '--slider-box-width': this.sliderBox.dim[0]+'px',
        '--slider-box-height': this.sliderBox.dim[1]+'px',
        '--player-box-width': this.playerBox.dim[0]+'px',
        '--player-box-height': this.playerBox.dim[1]+'px'
      }
    }
  },
  methods: {
    setupCanvas() {
      this.waveform.canvas = d3.select('#waveform')
        .select('canvas')
        .attr('width', this.playerBox.dim[0])
        .attr('height', this.playerBox.dim[1]);

      this.waveform.ctx = this.waveform.canvas.node().getContext('2d');
      let waveformColor = '#0088';
      this.waveform.ctx.strokeStyle = waveformColor;
      this.waveform.ctx.fillStyle = waveformColor;
      this.waveform.ctx.lineWidth = 1;

      this.spectrum.canvas = d3.select('#spectrum')
        .select('canvas')
        .attr('width', this.playerBox.dim[0])
        .attr('height', this.playerBox.dim[1]);

      this.spectrum.ctx = this.spectrum.canvas.node().getContext('2d');
      let spectrumColor = '#F002';
      this.spectrum.ctx.strokeStyle = spectrumColor;
      this.spectrum.ctx.fillStyle = spectrumColor;
      this.spectrum.ctx.lineWidth = 1;
    },

    setupSliders() {
      this.sliders = V.range(this.numSliders).map(v => `slider_${v}`);
    },

    async createSliders() {
      // await this.dataLoaded;

      for (let i = 0; i < this.numSliders; i++) {
        let slider = this.sliders[i] = new Nexus.Slider(`#slider_${i}`, {
          size: [this.sliderSize,this.sliderBox.dim[1]],
          mode: 'absolute'
        });

        slider.colorize('accent', '#0000');
        slider.element.style.cursor = 'default';

        // Remove slider body colors.
        slider.colorize('fill', '#0000');
        slider.element.childNodes[1].setAttribute('fill', '#0000');

        this.sliderChangeEvents[i] = () => {};

        slider.on('change', () => {
          this.sliderChangeEvents[i]();
        });
      }

      d3.selectAll('.vslider')
        .on('mouseover', this.highlightBackground)
        .on('mouseout', this.unhighlightBackground);

      // Slider backgrounds
      let bgWidth = this.sliderBox.dim[0]/this.numSliders;
      let bgHeight = this.sliderBox.dim[1];
      this.sliderBox.svg = d3.select('#slider-backgrounds')
        .append('svg')
        .attr('width', this.sliderBox.dim[0])
        .attr('height', this.sliderBox.dim[1]);

      this.sliderBox.svg.selectAll()
        .data(this.sliders)
        .enter()
        .append('rect')
        .attr('x', (d,i) => bgWidth * i)
        .attr('y', 0)
        .attr('width', bgWidth)
        .attr('height', bgHeight)
        .attr('fill', '#0000')
        .on('mouseover', this.highlightBackground)
        .on('mouseout', this.unhighlightBackground);
    },

    resetSliders(data) {
      data = V.from(data);

      let listIsNaN = testData.values.isNaN();

      this.sliders.forEach((slider,i) => {
        if (listIsNaN[i]) {
          slider.colorize('accent', '#0000');
          slider.element.style.cursor = 'default';
        } else {
          // Reference points should be in red.
          if (this.references.includes(i)) {
            slider.colorize('accent', 'red');
            slider.element.style.cursor = 'default';

            this.sliderChangeEvents[i] = () => {
              slider._value.value = testData.values[i];
            };
            slider.value = testData.values[i];
          } else {
            slider.colorize('accent', '#2bb');
            slider.element.style.cursor = 'pointer';

            slider.value = Math.random();
            // slider.value = testData.values[i];

            this.sliderChangeEvents[i] = () => {};
          }
        }

        // Remove slider body colors.
        slider.colorize('fill', '#0000');
        slider.element.childNodes[1].setAttribute('fill', '#0000');
      });
    },

    highlightBackground(data, index) {
      [this.sliderBox, this.playerBox.background].forEach(elem => {
        elem.svg.selectAll('rect')
          .filter((d,i) => i === index)
          .attr('fill', '#00F3');
      });

      this.cursorAt = index;
    },

    unhighlightBackground(data, index) {
      [this.sliderBox, this.playerBox.background].forEach(elem => {
        elem.svg.selectAll('rect')
          .filter((d,i) => i === index)
          .attr('fill', '#0000');
      });

      this.cursorAt = null;
    },

    unhighlightAllBackgrounds() {
      [this.sliderBox, this.playerBox.background].forEach(elem => {
        elem.svg.selectAll('rect')
          .filter((d,i) => i !== this.cursorAt)
          .attr('fill', '#0000');
      });
    },

    highlightBackgroundWithPlayhead(phase) {
      let index = Math.floor(phase*this.numSliders);
      this.unhighlightOtherBackgrounds(index);

      [this.sliderBox, this.playerBox.background].forEach(elem => {
        elem.svg.selectAll('rect')
          .filter((d,i) => i === index)
          .attr('fill', '#0F03');
      });
    },

    unhighlightOtherBackgrounds(index) {
      [this.sliderBox, this.playerBox.background].forEach(elem => {
        elem.svg.selectAll('rect')
          .filter((d,i) => i!==index && i!==this.cursorAt)
          .attr('fill', '#0000');
      });
    },

    lockHighlight(bool) {
      this.highlightLocked = bool;
    },

    createPlayer() {
      [this.playerBox.background, this.playerBox.playhead].forEach(elem => {
        elem.svg = d3.select(elem.id)
          .append('svg')
          .attr('width', this.playerBox.dim[0])
          .attr('height', this.playerBox.dim[1]);
      });

      this.playerBox.playhead.svg.append('path')
        .attr('class', 'playhead')
        .attr('stroke', 'red')
        .attr('stroke-width', '2')
        .attr('fill', 'none');

      this.playerBox.playhead.lineFn = d3.line()
        .x(d => d * this.playerBox.dim[0])
        .y((d,i) => i * this.playerBox.dim[1])
        .curve(d3.curveStep);

      let bgWidth = this.playerBox.dim[0]/this.numSliders;
      let bgHeight = this.playerBox.dim[1];
      this.playerBox.background.svg.selectAll()
        .data(this.sliders)
        .enter()
        .append('rect')
        .attr('x', (d,i) => bgWidth * i)
        .attr('y', 0)
        .attr('width', bgWidth)
        .attr('height', bgHeight)
        .attr('fill', '#0000')
        .on('mouseover', this.highlightBackground)
        .on('mouseout', this.unhighlightBackground);
    },

    documentClick(e) {
      if (dtm.wa.actx.state !== 'running') {
        console.log('Resuming web audio context');
        dtm.wa.actx.resume();
        dtm.startWebAudio();
      }

      document.onclick = null;
    },

    loadData() {
      return this.dataLoaded = d3.csv('./data/PeriodicTable.csv').then(data => {
        this.data = data;
      });
    },

    loadTest() {
      let a = Vector.from(this.data.map(r => r['MeltingPoint']))
        .parseFloat()
        .rescale();

      // Note: this.testValues will be implicitly converted to Array by Vue at some point.
      // testData.values = a.nth(...Vector.range(this.numSliders).add(Vector.random(1,a.length-this.numSliders).round()[0]));

      testData.values = V.random(this.numSliders);

      let data = testData.values;
      // this.references = V.range(this.numSliders).shuffle().slice(0,2);
      let [min,median,max] = [data.min()[0],data.clone().sort()[Math.floor(data.length/2)],data.max()[0]];
      let [minIdx,medianIdx,maxIdx] = [data.indexOf(min),data.indexOf(median),data.indexOf(max)];

      this.references = [];
      this.references.push(minIdx);
      this.references.push(medianIdx);
      this.references.push(maxIdx);

      this.synthesizeSound(data);
      this.resetSliders(data);
    },

    loadSound() {
      fetch('data/audio/sax.wav')
        .then(response => response.arrayBuffer())
        .then(arrayBuffer => {
          return new Promise(resolve => {
            dtm.wa.actx.decodeAudioData(arrayBuffer, buf => {
              var data = dtm.data();
              var arrays = [];
              for (var c = 0; c < buf.numberOfChannels; c++) {
                var floatArr = buf.getChannelData(c);
                arrays.push(dtm.data(Array.prototype.slice.call(floatArr)).label('ch_' + c).parent(data));
              }

              resolve(data.set(arrays));
            });
          })
        })
        .then(data => {
          let sig = data(0);
          let wfData = sig.abs().step(this.playerBox.dim[0]).range(0,1).get();
          this.drawWaveform(wfData);
        });
    },

    synthesizeSound(data) {
      data = V.from(data);

      t = new Tempo();
      t.blocksize(this.sound.blockSize)
        .hopratio(this.sound.hopRatio)
        .duration(this.sound.duration);

      let indices = V.random(3).rescale(0,10,0,1).round();
      let components = t.genSoundComponents(indices,this.sound.wtResolution,this.numSliders);
      let wt = M.timeslinear(components[0],components[1]).mtow();

      t.process(t => {
        let v = data.phasestep(t.phase)[0];
        return wt.phasestep(v)[0];
      }).render()
        .inplace(t => t.rotate(t.hop*3).multiply(components[2]));

      this.drawWaveform(t.rescale(-1,1).step(this.playerBox.dim[0]));
    },

    drawWaveform(data) {
      this.waveform.ctx.clearRect(0,0,this.playerBox.dim[0],this.playerBox.dim[1]);

      let pos = 0;
      let halfY;
      halfY = this.playerBox.dim[1]/2;

      this.waveform.ctx.beginPath();
      data.forEach((v,i) => {
        pos = i + 0.5;
        this.waveform.ctx.moveTo(pos, halfY + v*halfY);
        this.waveform.ctx.lineTo(pos, halfY - v*halfY);
      });
      this.waveform.ctx.stroke();
      this.waveform.ctx.closePath();
    },

    drawPlayhead(phase) {
      this.playerBox.playhead.svg.selectAll('path.playhead')
        .attr('stroke-opacity', '1')
        .attr('d', this.playerBox.playhead.lineFn([phase,phase]))
    },

    clearSpectrum() {
      let [w,h] = this.playerBox.dim;
      this.spectrum.ctx.clearRect(0,0,w,h);
    },

    drawSpectrum(data) {
      let [w,h] = this.playerBox.dim;
      this.clearSpectrum();

      let pos = 0;

      this.spectrum.ctx.beginPath();
      data.forEach((v,i) => {
        pos = i + 0.5;
        let y = h*v;
        this.spectrum.ctx.moveTo(pos, h);
        this.spectrum.ctx.lineTo(pos, h-y);
      });
      this.spectrum.ctx.stroke();
      this.spectrum.ctx.closePath();
    },

    play() {
      if (p && p.playing) {
        return null;
      }

      let nfft = 2048;

      // if (actx.audioWorklet) {
        p = Waveform.from(t.rescale(-1,1)).gain(0.3)
          .interval(nfft)
          .phase(p => {
            if (p < .999) {
              this.drawPlayhead(p);
              this.highlightBackgroundWithPlayhead(p);
            }
          })
          .intercept(v => {
            if (v.length === nfft) {
              let mag = v.multiply(t.block/100)
                .mag().squeeze(this.sliderBox.dim[0])
                .logscale(10);
              this.drawSpectrum(mag);
            }
          })
          .onended(v => {
            this.drawPlayhead(0);
            this.unhighlightAllBackgrounds();
            this.clearSpectrum();

            if (this.loop) {
              this.play();
            }
          })
          .play();
      // } else {
      //   p = dtm.music(t.block).play()
      //     .wave(t.rescale(-1,1))
      //     .amp(0.3)
      //     .freq(t.oscFreq)
      //     .for(t.outDur)
      //     .phase(p => {
      //       let pv = p.get(0);
      //       this.drawPlayhead(pv);
      //       this.highlightBackgroundWithPlayhead(pv);
      //     },nfft).offnote(m => {
      //       this.drawPlayhead(0);
      //       this.unhighlightAllBackgrounds();
      //       this.clearSpectrum();
      //
      //       if (this.loop) {
      //         this.play();
      //       }
      //
      //     }).monitor(wf => {
      //       let mag = V.from(wf.get())
      //         .multiply(t.block/100)
      //         .mag().squeeze(this.sliderBox.dim[0])
      //         .logscale(10);
      //       this.drawSpectrum(mag);
      //     });
      // }
    },

    stop() {
      if (this.loop) {
        this.toggleLoop();
      }
      if (p) {
        p.stop();
      }
      // this.playerBox.playhead.phase = 0;
      this.drawPlayhead(0);
      this.unhighlightAllBackgrounds();
      this.clearSpectrum();
    },

    toggleLoop() {
      this.loop = !this.loop;
      this.loopToggleColor = this.loop ? 'lawngreen' : 'white';
    },

    proceed() {
      switch (this.testState) {
        case 'loading':
          this.loadTest();
          this.testState = 'testing';
          this.proceedButtonText = 'Submit';
          break;
        case 'testing':
          this.stop();
          this.submit();

          this.currentStage++;
          this.clearAttrSelection();
          this.clearSpectrum();
          this.loadTest();

          this.testState = 'testing';
          this.proceedButtonText = 'Submit';
          break;
        default:
          break;
      }
    },

    submit() {
      let sliderValues = Vector.from(this.sliders.map(slider => slider.value));

      // TODO: Handle NaNs.
      let score = testData.values.subtract(sliderValues).abs().map(v => {
        return v > .5 ? 1 : v*2; // Notes: Range of [0,1]; Error bigger than .5 is counted as 0.
      }).sum().divideby(sliderValues.len().subtract(this.numReferences)).subtractfrom(1);

      let roundedScore = Math.round(score*1e+4)/1e+4;
      console.log('Accuracy:',roundedScore);
      console.log('Actual:',testData.values);
      console.log('Input:',sliderValues);
      console.log('Error:',sliderValues.subtract(testData.values));
      alert(`Accuracy: ${roundedScore} (${['Horrible','Pretty Bad','Meh','OK','Great'][Math.floor(roundedScore*5)]})`);

      this.storeUserData();
    },

    storeUserData() {
      let res = {};

      res.stage = this.currentStage;
      res.source = testData.values;
      res.input = Vector.from(this.sliders.map(slider => slider.value));
      // res.score;
      // res.started
      // res.finished
      // res.duration
      res.attributes = this.selectedAttributes;

      userData.results.push(res);
      console.log(userData);
    },

    checkAttrSelection(event) {
      if (this.selectedAttributes.length > this.attrSelectionMax) {
        alert(`You have already selected ${this.attrSelectionMax} items. Please unselect others if you want to select this one.`);
        this.selectedAttributes.pop();
        event.target.checked = false;
      }
    },

    clearAttrSelection() {
      this.selectedAttributes = [];
      this.$refs.attrSelectables.forEach(el => el.checked=false);
    }
  },
  created() {
    document.onclick = this.documentClick;

    this.setupSliders();
    this.loadData();
      // .then(this.loadTest);
  },
  mounted() {
    this.setupCanvas();
    this.createSliders();
    this.createPlayer();
  }
});