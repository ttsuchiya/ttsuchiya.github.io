function unspread(args) {
  return args.length===1 && ['Vector','Matrix','Array'].includes(args[0].constructor.name) ? args[0] : args;
}

let actx = new (window.AudioContext || window.webkitAudioContext)();
if (actx.audioWorklet) {
  actx.audioWorklet.addModule('./lib/clock.js');
}
let waveforms = [];
let clocks = [];

class Vector extends Array {
  constructor(...args) {
    super(...args);
  }
  static augment(name, fn) {
    Vector.prototype[name] = fn;
  }
  static concat(...args) {
    args = unspread(args);
    let res = new Vector();
    args.forEach(v => {
      res = res.concat(Vector.from(v));
    });
    return res;
  }
  static mix(...args) {
    // Note: Don't spread -- always expect Vectors.
    return args.reduce((a,b) => a.mix(b));
  }
  static range(...args) {
    let [start,stop,step] = [0,1,1];
    switch (args.length) {
      case 1: [stop] = args; break;
      case 2: [start,stop] = args; break;
      case 3: [start,stop,step] = args; break;
      default: break;
    }
    let len = Math.floor(stop>start ? (stop-start)/step : (start-stop/step));
    step = start>stop ? -step : step;
    return Vector.from(Array(len).keys()).multiply(step).add(start);
  }
  static phasor(...args) {
    args = unspread(args);
    let [len,freq,shift] = [1,1,0];
    [len,freq,shift] = args.concat([len,freq,shift].slice(args.length));
    let max = 1-(Number.EPSILON*2); // Note: (1-Number.EPSILON).modulo(1) is unstable.
    let range;
    if (freq < 0) {
      range = Vector.range(len-1,-1);
      freq = Math.abs(freq);
    } else {
      range = Vector.range(len);
    }
    return range.multiply(freq*max/(len-1)).add(shift).modulo(1);
  }
  static const(...args) {
    args = unspread(args);
    let [len,val] = [1,0];
    [len,val] = args.concat([len,val].slice(args.length));
    let res = new Vector(len);
    for (let i = 0; i < len; i++) {
      res[i] = val;
    }
    return res;
  }
  static random(...args) {
    args = unspread(args);
    let [len,min,max] = [1,0,1];
    switch (args.length) {
      case 1: [len] = args; break;
      case 2: [len,max] = args; break;
      case 3: [len,min,max] = args; break;
      default: break;
    }
    return Vector.range(len).map(() => Math.random()*(max-min)+min);
  }
  static rise(...args) {
    args = unspread(args);
    let [len,min,max] = [1,0,1];
    switch (args.length) {
      case 1: [len] = args; break;
      case 2: [len,max] = args; break;
      case 3: [len,min,max] = args; break;
      default: break;
    }
    return this.range(len).multiply((max-min)/(len===1?1:len-1)).add(min);
  }
  static decay(...args) {
    args = unspread(args);
    let [len,min,max] = [1,0,1];
    switch (args.length) {
      case 1: [len] = args; break;
      case 2: [len,max] = args; break;
      case 3: [len,min,max] = args; break;
      default: break;
    }
    return this.range(len-1,-1).multiply((max-min)/(len===1?1:len-1)).add(min);
  }
  static comb(...args) {
    args = unspread(args);
    let [len,peaks,amp,jitter,phase] = [1,1,1,0,null];
    [len,peaks,amp,jitter,phase] = args.concat([len,peaks,amp,jitter,phase].slice(args.length));

    let seg = Math.floor(len/peaks)-1;
    let rem = len - (seg*peaks+peaks);
    let shift = Vector.random(peaks,-jitter/2,jitter/2).multiply(seg).round();
    let res = Vector.const(Math.floor(seg/2)+shift[0],0);
    res.push(amp);

    for (let i = 1; i < peaks; i++) {
      res = res.concat(Vector.const(seg+shift[i]-(i>0?shift[i-1]:0),0));

      if (rem !== 0) {
        res.push(0);
        rem--;
      }

      res.push(amp);
    }

    res = res.concat(Vector.const(Math.ceil(seg/2)+rem-shift[shift.length-1],0));

    if (phase !== null) {
      res = res.rotate(res.indexOf(amp)).phaseshift(-phase);
    }

    return res;
  }
  static prime(...args) {
    args = unspread(args);
    let res;

    let [len,min,max] = [1,null,null];
    switch (args.length) {
      case 1:
        len = args[0];

        res = Vector.of(2);
        let cur = 3;

        for (let i=(min?0:1); i<len; i++) {
          while (res.some(v => cur%v === 0)) {
            cur++;
          }
          res.push(cur);
          if (min && cur<min) {
            i--;
          }
        }
        return res;
      case 2:
        [min,max] = args;
        if (min<2) min = 2;

        res = Vector.range(max+1);
        let rt = Math.sqrt(max);
        for (let i=2; i<=rt; i++) {
          for (let j=i*i; j<=max; j+=i) {
            res[j] = 0;
          }
        }
        return res.filter(v => v>=min);
      default:
        return Vector.of(2);
    }
  }
  static angles(...args) {
    args = unspread(args);
    let [len,phase,radian] = [1,0,true];
    [len,phase,radian] = args.concat([len,phase,radian].slice(args.length));

    if (radian) {
      return Vector.range(len).map(v => {
        let x = v*phase%1 * 2;
        return (x>1 ? -2+x : x)*Math.PI
      });
    } else {
      return Vector.range(len).map(v => v*phase%1);
    }
  }
  static hamming(...args) {
    args = unspread(args);
    let [len,alpha,beta] = [1,0.54,0.46];
    [len,alpha,beta] = args.concat([len,alpha,beta].slice(args.length));

    return Vector.of(0,1).linear(len).map(v => {
      return alpha-beta*Math.cos(2*Math.PI*v);
    });
  }
  static gauss(...args) {
    let [len,mean,variance] = [2,0,1];
    [len,mean,variance] = args.concat([len,mean,variance].slice(args.length));
    return Vector.of(-Math.PI,Math.PI).linear(len).gauss(mean,variance);
  }
  static lognormal(...args) {
    let [len,mean,std] = [1,0,1];
    [len,mean,std] = args.concat([len,mean,std].slice(args.length));
    return Vector.of(Number.EPSILON,6).linear(len).lognormal(mean,std);
  }
  static logistic(...args) {
    let [len,L,k,mid] = [1,1,1,0];
    [len,L,k,mid] = args.concat([len,L,k,mid].slice(args.length));
    return Vector.of(-6,6).linear(len).logistic(L,k,mid);
  }
  static sin(...args) {
    args = unspread(args);
    let [len,freq,shift] = [1,1,0];
    [len,freq,shift] = args.concat([len,freq,shift].slice(args.length));
    return Vector.phasor(len,freq,shift).radian().sin();
  }
  static cos(...args) {
    args = unspread(args);
    let [len,freq,shift] = [1,1,0];
    [len,freq,shift] = args.concat([len,freq,shift].slice(args.length));
    return Vector.phasor(len,freq,shift).radian().cos();
  }
  clone() {
    return Vector.from(this);
  }
  inplace(fn) {
    let result = fn(this);
    if (!result || typeof(result.clone)!=='function') {
      result = this.clone();
    }
    while (this.length) {
      this.pop();
    }
    for (let i=0; i<result.length; i++) {
      this[i] = result[i];
    }
    return this;
  }
  print() {
    console.log(this);
    return this;
  }
  parseFloat() {
    return this.map(Number.parseFloat);
  }
  isNaN() {
    return this.map(Number.isNaN);
  }
  removeNaN() {
    return this.filter(v => !Number.isNaN(v));
  }
  replaceNaN(r=-1) {
    return this.map(v => Number.isNaN(v) ? r : v);
  }
  nth(...args) {
    let indices = unspread(args);
    return Vector.from(indices).modulo(this.length).map(i => this[i]);
  }
  add(...args) {
    args = unspread(args);
    return this.map((v,i) => v+args[i%args.length]);
  }
  subtract(...args) {
    args = unspread(args);
    return this.map((v,i) => v-args[i%args.length]);
  }
  subtractfrom(...args) {
    args = unspread(args);
    return this.map((v,i) => args[i%args.length]-v);
  }
  multiply(...args) {
    args = unspread(args);
    return this.map((v,i) => v*args[i%args.length]);
  }
  divideby(...args) {
    args = unspread(args);
    return this.map((v,i) => v/args[i%args.length]);
  }
  divide(...args) {
    args = unspread(args);
    return this.map((v,i) => args[i%args.length]/v);
  }
  reciprocal() {
    return this.map(v => v===0 ? Number.NaN : 1/v);
  }
  power(...args) {
    args = unspread(args);
    return this.map((v,i) => Math.pow(v,args[i%args.length]));
  }
  powerof(...args) {
    args = unspread(args);
    return this.map((v,i) => Math.pow(args[i%args.length],v));
  }
  modulo(...args) {
    args = unspread(args);
    return this.map((v,i) => {
      let x = args[i%args.length];
      return ((v%x)+x)%x;
    })
  }
  min() {
    // return Vector.of(Math.min(...this.removeNaN())); // Spread args failing with max call stack limit.
    return Vector.of(this.removeNaN().reduce((a,b) => a<b ? a : b, Number.MAX_VALUE));
  }
  max() {
    return Vector.of(this.removeNaN().reduce((a,b) => a>b ? a : b, Number.MIN_VALUE));
  }
  absmax() {
    return Vector.of(this.removeNaN().reduce((a,b) => Math.abs(a)>Math.abs(b) ? a : b, Number.MIN_VALUE));
  }
  sum() {
    return Vector.of(this.removeNaN().reduce((a,b) => a+b, 0));
  }
  mix(...args) {
    args = unspread(args);
    return this.map((a,i) => {
      let b = args[i%args.length];
      return Math.abs(a)>Math.abs(b) ? a : b;
    });
  }
  mean() {
    return this.sum().divideby(this.removeNaN().length);
  }
  variance() {
    let mean = this.mean()[0];
    return this.map(v => Math.pow(mean-v,2))
      .sum().divideby(this.length-1);
  }
  deviation() {
    return this.variance().power(1/2);
  }
  median() {
    return this.clone().sort((a,b) => a-b).phase(0.5);
  }
  midrange() {
    return Vector.concat(this.min(),this.max()).mean();
  }
  len() {
    return Vector.of(this.length);
  }
  unique() {
    return Vector.from(new Set(this));
  }
  rescale(...args) {
    args = unspread(args);
    let [min,max,dmin,dmax] = [0,1,this.min()[0],this.max()[0]];
    [min,max,dmin,dmax] = args.concat([min,max,dmin,dmax].slice(args.length));
    if (dmax===dmin) {
      dmax = this[0]+0.5;
      dmin = this[0]-0.5;
    }
    return this.map(v => Number.isNaN(v) ? v : (v-dmin)/(dmax-dmin)*(max-min)+min);
  }
  meannormalize() {
    let [mean,min,max] = [this.mean()[0],this.min()[0],this.max()[0]];
    return this.map(v => (v-mean)/(max-min));
  }
  zscore() {
    let [mean,std] = [this.mean()[0],this.deviation()[0]];
    return this.map(v => (v-mean)/std);
  }
  expscale(...args) {
    args = unspread(args);
    let fn = (v,i) => {
      let factor = args[i%args.length];
      if (factor <= 1) factor = 1+Number.EPSILON;
      return Math.exp(v*Math.log(factor)-1)/(factor-1);
    };
    let [dmin,dmax] = [this.min()[0],this.max()[0]];

    if (dmin<0 || dmax>1) {
      return this.rescale(0,1).map(fn).rescale(dmin,dmax);
    } else {
      return this.map(fn);
    }
  }
  logscale(...args) {
    args = unspread(args);
    let fn = (v,i) => {
      let factor = args[i%args.length];
      if (factor <= 1) factor = 1+Number.EPSILON;
      return Math.log(v*(factor-1)+1)/Math.log(factor);
    };
    let [dmin,dmax] = [this.min()[0],this.max()[0]];

    if (dmin<0 || dmax>1) {
      return this.rescale(0,1).map(fn).rescale(dmin,dmax);
    } else {
      return this.map(fn);
    }
  }
  denormalize() {
    return this.rescale(this.min()[0]+Number.EPSILON,this.max()[0]);
  }
  demodulate(...args) {
    args = unspread(args);
    return this.multiply(...Vector.from(args).denormalize().power(-1));
  }
  phase(...args) {
    args = unspread(args);
    // Note: multiply(1-EPSILON) is questionable.
    let wrappedPhase = Vector.from(args).multiply(1-Number.EPSILON).modulo(1);
    return wrappedPhase.map(v => {
      let fracIndex = v*(this.length-1);
      let int = Math.floor(fracIndex);
      let frac = fracIndex - int;
      return this[int]*(1-frac) + this[int+1]*frac;
    });
  }
  phasestep(...args) {
    args = unspread(args);
    return Vector.from(args).map(v => {
      let index = Math.floor(v*(this.length))%this.length;
      return this[index];
    });
  }
  phasemax(...args) {
    args = unspread(args);
    return Vector.from(args).map(v => {
      let fracIndex = v*(this.length-1);
      let int = Math.floor(fracIndex);
      let a = this[int];
      let b = int===this.length-1 ? 0 : this[int+1];
      return Math.max(a,b);
    });
  }
  phasemaxbp(...args) {
    args = unspread(args);
    return Vector.from(args).map(v => {
      let fracIndex = v * (this.length - 1);
      let int = Math.floor(fracIndex);
      let a = this[int];
      let b = int===this.length - 1 ? 0 : this[int+1];
      return Math.abs(a)>Math.abs(b) ? a : b;
    });
  }
  phaseshift(phase) {
    return this.rotate(Math.round(phase*this.length));
  }
  rotate(steps) {
    let len = this.length;
    steps = ((steps%len)+len)%len;
    let head = this.slice(steps);
    let tail = this.slice(0,steps);
    return head.concat(tail);
  }
  linear(...args) {
    args = unspread(args);
    if (args.length === 1 && args[0] === this.length) {
      return this;
    }
    let phase = new Vector();
    args.forEach((v,i) => {
      let p = Vector.range(v);
      phase = phase.concat(p.divideby(p.length-1).divideby(args.length).add(i/args.length));
    });
    return this.phase(phase);
  }
  step(...args) {
    args = unspread(args);
    if (args.length === 1 && args[0] === this.length) {
      return this;
    }
    let indices = Vector.range(this.length+1).linear(args).floor();
    return this.nth(indices);
  }
  squeeze(...args) {
    args = unspread(args);
    if (args.length === 1 && args[0] === this.length) {
      return this;
    }
    let seg = Math.round(this.length/args.length);
    return Vector.concat(args.map((tgtLen,i) => {
      let start = i*seg, stop = (i+1)*seg;
      let chunk = this.slice(start,stop);

      if (tgtLen < seg) {
        let stepSize = seg/tgtLen;
        return Vector.range(tgtLen).map(v => {
          let start = Math.round(v*stepSize);
          let stop = Math.round((v+1)*stepSize);
          // return chunk.slice(start,stop).absmax()[0]; // Multiple slice-copying can be slow!
          let res = 0;
          for (let i=start; i<stop; i++) {
            res = Math.abs(chunk[i])>Math.abs(res) ? chunk[i] : res;
          }
          return res;
        });
      } else if (tgtLen > seg) {
        return chunk.step(tgtLen);
      } else {
        return chunk;
      }
    }));
  }
  shuffle() {
    let res = this.clone();
    for (let i = this.length-1; i > 0; i--) {
      let j = Math.floor(Math.random()*i);
      let temp = res[i];
      res[i] = res[j];
      res[j] = temp;
    }
    return res;
  }
  gauss(...args) {
    args = unspread(args);
    let [mean,variance] = [this.mean()[0],this.variance()[0]/Math.PI];
    [mean,variance] = args.concat([mean,variance].slice(args.length));
    return this.map(v => {
      return Math.exp(-Math.pow(v-mean,2)/(2*variance))/Math.sqrt(2*Math.PI*variance);
    });
  }
  lognormal(...args) {
    args = unspread(args);
    let [mean,std] = [this.mean()[0],this.deviation()[0]];
    [mean,std] = args.concat([mean,std].slice(args.length));
    return this.map(v => {
      return Math.exp(-Math.pow(Math.log(v)-mean,2)/2*Math.pow(std,2))/(v*std*Math.sqrt(2*Math.PI));
    })
  }
  logistic(...args) {
    args = unspread(args);
    let [L,k,mid] = [1,1,0];
    [L,k,mid] = args.concat([L,k,mid].slice(args.length));
    return this.map(v => {
      return L/(1+Math.exp(-k*(v-mid)));
    });
  }
  radian() {
    return this.multiply(2*Math.PI);
  }
  // Note: These have a very specific behavior.
  downsample(ratio) {
    let samps = Math.floor(this.length/ratio);
    let stepSize = this.length/samps;
    return Vector.range(samps).map(v => {
      let start = Math.round(v*stepSize);
      let stop = Math.round((v+1)*stepSize);

      let res = 0;
      for (let i=start; i<stop; i++) {
        res = Math.abs(this[i])>Math.abs(res) ? this[i] : res;
      }
      return res;
      // return this.slice(start,stop).absmax()[0]; // Slow!
    }).concat(Vector.const(this.length-samps,0));
  }
  upsample(ratio) {
    let phase = Vector.of(0,1/ratio-Number.EPSILON).linear(this.length);
    return this.phasemaxbp(phase);
  }
  mtof() {
    return this.map(v => 440*Math.pow(2,(v-69)/12));
  }
  ftom() {
    return this.map(v => Math.log2(v/440.0)*12+69);
  }
}

Object.getOwnPropertyNames(Math).forEach(name => {
  if (!Object.getOwnPropertyNames(Vector.prototype).includes(name)) {
    Vector.prototype[name] = function() {
      return this.map(Math[name]);
    }
  }
});

class Matrix extends Vector {
  constructor(...args) {
    super(...args);
  }
  static augment(name, fn) {
    Matrix.prototype[name] = fn;
  }
  static timeslinear(...args) {
    // Note: Don't unspread -- always expect matrices as input.
    if (args.length === 1) {
      return args[0];
    }
    let maxNumVec = Vector.from(args.map(m => m.length)).max()[0];
    let maxVecLen = Vector.from(args.map(m => Vector.from(m.map(v => v.length)).max()[0])).max()[0];

    let vLenFixed = args.map(m => m.map(v => v.linear(maxVecLen)));
    let vNumFixed = vLenFixed.map(m => {
      if (m.length !== maxVecLen) {
        return m.phase(Vector.phasor(maxNumVec));
      } else {
        return m;
      }
    });

    return vNumFixed.reduce((a,b) => {
      return a.map((v,i) => v.multiply(b[i]));
    });
  }
  static timesstep(...args) {
    // Note: Don't unspread -- always expect matrices as input.
    if (args.length === 1) {
      return args[0];
    }
    let maxNumVec = Vector.from(args.map(m => m.length)).max()[0];
    let maxVecLen = Vector.from(args.map(m => Vector.from(m.map(v => v.length)).max()[0])).max()[0];

    let vLenFixed = args.map(m => m.map(v => v.step(maxVecLen)));
    let vNumFixed = vLenFixed.map(m => {
      if (m.length !== maxVecLen) {
        return m.phasestep(Vector.phasor(maxNumVec));
      } else {
        return m;
      }
    });

    return vNumFixed.reduce((a,b) => {
      return a.map((v,i) => v.multiply(b[i]));
    });
  }
  transpose() {
    let maxLen = Vector.from(this.map(v => v.length)).max()[0];
    let res = new Matrix();
    for (let i=0; i<maxLen; i++) res.push(new Vector());
    this.forEach((v,i) => {
      v.forEach((w,j) => {
        res[j][i] = w;
      });
    });
    return res;
  }
  nth(...args) {
    let indices = unspread(args);
    return Matrix.from(Vector.from(indices).modulo(this.length).map(i => this[i]));
  }
  phase(...args) {
    args = unspread(args);
    // Note: multiply(1-EPSILON) is questionable.
    let wrappedPhase = Vector.from(args).multiply(1-Number.EPSILON).modulo(1);
    return Matrix.from(wrappedPhase.map(v => {
      if (this.length ===1) return this[0];
      let fracIndex = v*(this.length-1);
      let int = Math.floor(fracIndex);
      let frac = fracIndex - int;
      return this[int].multiply(1-frac).add(this[int+1].multiply(frac));
    }));
  }
  phasemix(...args) {
    args = unspread(args);
    // Note: multiply(1-EPSILON) is questionable.
    let wrappedPhase = Vector.from(args).multiply(1-Number.EPSILON).modulo(1);
    return Matrix.from(wrappedPhase.map(v => {
      if (this.length ===1) return this[0];
      let fracIndex = v*(this.length-1);
      let int = Math.floor(fracIndex);
      let frac = fracIndex - int;
      return this[int].multiply(1-frac).mix(this[int+1].multiply(frac));
    }));
  }
  phasestep(...args) {
    args = unspread(args);
    return Matrix.from(args).map(v => {
      let index = Math.floor(v*(this.length))%this.length;
      return this[index];
    });
  }
  prodlinear() {
    if (this.length === 1) {
      return this[0];
    }
    let maxLen = this.map(v => v.length).max()[0];
    return this
      .map(v => v.constructor.name==='Vector' ? v : Vector.from(v))
      .map(v => v.linear(maxLen))
      .reduce((a,b) => a.multiply(b));
  }
  prodstep() {
    if (this.length === 1) {
      return this[0];
    }
    let maxLen = this.map(v => v.length).max()[0];
    return this
      .map(v => v.constructor.name==='Vector' ? v : Vector.from(v))
      .map(v => v.step(maxLen))
      .reduce((a,b) => a.multiply(b));
  }
  sum() {
    if (this.length === 1) {
      return this[0];
    }
    return this.transpose().map(v => v.sum()).transpose();
  }
  mix() {
    if (this.length === 1) {
      return this[0];
    }
    return Vector.mix(...this);
  }
  OLA(overlap=2) {
    let block = this[0].length;
    let hop = Math.floor(block/overlap);
    let len = hop*(this.length-1)+block;
    let res = Vector.const(len, 0);
    this.forEach((x,i) => {
      x.forEach((y,j) => {
        res[i*hop+j] += y;
      });
    });
    return res;
  }
  OLM(overlap=2) {
    let block = this[0].length;
    let hop = Math.floor(block/overlap);
    let len = hop*(this.length-1)+block;
    let res = Vector.const(len, 0);
    this.forEach((x,i) => {
      x.forEach((y,j) => {
        let v = res[i*hop+j];
        res[i*hop+j] = Math.abs(v)>Math.abs(y) ? v : y;
      });
    });
    return res;
  }
}

let matrixProperties = Object.getOwnPropertyNames(Matrix.prototype);
Object.getOwnPropertyNames(Vector.prototype).forEach(name => {
  if (!matrixProperties.includes(name)) {
    Matrix.prototype[name] = function (...args) {
      return this.map(v => v[name](...args));
    }
  }
});

class Tempo extends Vector {
  constructor(...args) {
    super(...args);
    this.fs = 44100;
    this.block = Math.pow(2,10);
    this.overlap = 4;
    this.dur = 1;
    this.olmethod = 'OLA';
    this.winfn = (t) => Vector.hamming(t.block);
    this.processfn = (t) => {
      this.increment();
      return Vector.const(t.block);
    };

    this.blocks = new Matrix();
    this.init();
    this.reset();
  }
  static augment(name, fn) {
    Tempo.prototype[name] = fn;
  }
  static create(fn) {
    return (new Tempo()).process(fn);
  }
  clone() {
    let newInstance = new Tempo();
    Object.entries(this).forEach((entry) => {
      newInstance[entry[0]] = entry[1];
    });
    return newInstance;
  }
  init() {
    this.hop = Math.round(this.block/this.overlap);
    this.numBlocks = Math.floor((this.fs*this.dur-this.block)/this.hop)+2;
    this.outSamps = this.numBlocks*this.hop+(this.block-this.hop);
    this.outDur = this.outSamps/this.fs;
    this.oscFreq = 1/this.outDur;
    this.binSize = this.fs/this.block;
    this.win = this.winfn(this);
    return this;
  }
  reset() {
    this.currentTime = 0;
    this.index = 0;
    this.phase = 0;
    return this;
  }
  clear() {
    while (this.length) {
      this.pop();
    }
    this.blocks = new Matrix();
    return this;
  }
  increment() {
    this.index++;
    this.currentTime += (this.hop/this.fs);
    this.phase = this.currentTime/this.outDur;
    return this;
  }
  setIndex(index) {
    this.index = index;
    this.currentTime = this.hop*this.index/this.fs;
    this.phase = this.currentTime/this.outDur;
    return this;
  }
  samplerate(fs) {
    this.fs = fs;
    return this.init();
  }
  blocksize(samps) {
    this.block = samps;
    return this.init();
  }
  hopsize(samps) {
    this.overlap = this.block/samps;
    return this.init();
  }
  hopratio(ratio) {
    this.overlap = 1/ratio;
    return this.init();
  }
  duration(dur) {
    this.dur = dur;
    return this.init();
  }
  process(fn) {
    this.processfn = (t) => {
      let out = fn(t);
      this.increment();
      return out
    };
    return this;
  }
  windowfn(winfn) {
    this.winfn = (t) => winfn(t);
    return this.init();
  }
  // TODO: Inconsistent with the windowfn() behavior.
  overlapfn(name) {
    this.olmethod = name;
    return this;
  }
  render(...args) {
    let indices = unspread(args);
    this.clear();
    if (indices.length === 0) {
      Matrix.from(Vector.const(this.numBlocks).map(() => {
        let renderedBlock = this.processfn(this).multiply(this.win);
        this.blocks.push(renderedBlock);
        return renderedBlock;
      }))[this.olmethod](this.overlap).forEach((v,i) => {
        this[i] = v;
      });
      this.reset();
      return this;
    } else {
      let output = indices.map(i => {
        this.setIndex(i);
        return this.processfn(this).multiply(this.win);
      });
      this.reset();
      return output;
    }
  }
  freqtophase(...args) {
    args = unspread(args);
    return args.map(v => 2*(v/this.binSize-1)/this.block);
  }
  freqtobin(...args) {
    args = unspread(args);
    return args.map(v => Math.round(v/this.binSize-1));
  }
  play() {
    return Waveform.from(this).gain(0.5).play();
  }
}

// TODO: Should this extend the clock class?
class Waveform extends Vector {
  constructor(...args) {
    super(...args);
    this.bs = null;
    this._gain = 1;
    this.phaseFn = null;
    this.phasor = null;
    this.interceptorFn = null;
  }
  static augment(name, fn) {
    Waveform.prototype[name] = fn;
  }
  static stop() {
    waveforms.forEach(v => v.stop());
    waveforms = [];
  }
  play() {
    if (!waveforms.includes(this)) {
      waveforms.push(this);
    }

    let buffer = actx.createBuffer(1,this.length,actx.sampleRate);
    let bufferView = buffer.getChannelData(0);
    for (let i = 0; i < this.length; i++) {
      bufferView[i] = this[i];
    }
    this.bs = actx.createBufferSource();
    let gain = actx.createGain();
    this.bs.buffer = buffer;
    gain.gain.setValueAtTime(this._gain,0);
    this.bs.connect(gain);
    gain.connect(actx.destination);
    this.bs.start();

    if (this.phaseFn || this.interceptorFn || this.onendedFn) {
      this.phasor = new Clock().samples(this.length);

      if (this.phasorInterval) {
        this.phasor.interval(this.phasorInterval);
      }
      if (this.phaseFn) {
        this.phasor.phase(this.phaseFn);
      }
      if (this.interceptorFn) {
        this.phasor.intercept(this.interceptorFn, gain);
      }
      if (this.onendedFn) {
        this.phasor.onended(this.onendedFn);
      }

      this.phasor.start();
    }

    return this;
  }
  stop() {
    this.bs.disconnect();
    if (this.phasor) {
      this.phasor.stop();
    }
    return this;
  }
  onended(fn) {
    this.onendedFn = fn;
    return this;
  }
  gain(gain) {
    this._gain = gain;
    return this;
  }
  phase(fn) {
    this.phaseFn = fn;
    return this;
  }
  intercept(fn) {
    this.interceptorFn = fn;
    return this;
  }
  interval(samps) {
    this.phasorInterval = samps;
    return this;
  }
}

class WaveTable extends Matrix {
  constructor(...args) {
    super(...args);

    this.dur = 1;

    this.reset();
    this.init();
  }
  static augment(name, fn) {
    WaveTable.prototype[name] = fn;
  }
  static stop() {
    // wavetables.forEach(v => v.disconnect());
    // wavetables = [];
  }
  play() {

  }
}

class Clock extends Vector {
  constructor(...args) {
    super(...args);
    this.osc = null;
    this.workletAvailable = !!actx.audioWorklet;
    this.worklet = null;
    this.sp = null;
    this.dur = 1;
    this.phaseCurve = null;
    this.phaseFn = () => {};
    this.tickFn = () => {};
    this.cbInterval = 512;
    this.repeatCount = 1;
    this.currentIndex = 0;
    this.nextStart = null;

    this.interceptorFn = null;
    this.streamSrc = null;
  }
  static augment(name, fn) {
    Clock.prototype[name] = fn;
  }
  static stop() {
    clocks.forEach(c => c.terminate());
    clocks = [];
  }
  static for(dur) {
    return new Clock().duration(dur);
  }
  static frequency(freq) {
    return new Clock().frequency(freq);
  }
  static samples(samps) {
    return new Clock().samples(samps);
  }
  init() {}
  start() {
    if (this.repeatCount === 0) {
      return this;
    }

    if (this.currentIndex === 0) {
      clocks.push(this);
    }
    this.tickFn(this.currentIndex++);

    this.osc = actx.createOscillator();
    this.osc.onended = () => {
      this.stop();

      if (--this.repeatCount > 0) {
        this.start();
      } else if (this.repeatCount === 0) {
        if (clocks.includes(this)) {
          clocks.splice(clocks.indexOf(this),1);
        }
      }
    };
    if (this.workletAvailable) {
      this.worklet = new AudioWorkletNode(actx, 'clock-processor');
      this.worklet.port.postMessage({
        type: 'init',
        duration: this.dur,
        cbInterval: this.cbInterval,
        intercept: !!this.interceptorFn
      });

      if (this.interceptorFn) {
        this.worklet.port.onmessage = e => {
          if (e.data.type === 'phase') {
            this.phaseFn(e.data.phase);
          } else if (e.data.type === 'intercept') {
            let stream = Vector.concat(e.data.stream);
            if (stream.length === this.cbInterval) {
              this.interceptorFn(stream);
            }
          }
        };

        let mute = actx.createGain();
        mute.gain.setValueAtTime(0,0);
        this.osc.connect(mute);
        mute.connect(actx.destination);
        this.streamSrc.connect(this.worklet);
      } else {
        this.worklet.port.onmessage = e => {
          this.phaseFn(e.data.phase);
        };
        this.osc.connect(this.worklet);
      }
      this.worklet.connect(actx.destination);

    } else {
      let initTime = actx.currentTime;
      this.sp = actx.createScriptProcessor(this.cbInterval,1,1);

      if (this.interceptorFn) {
        this.sp.onaudioprocess = e => {
          let phase = (actx.currentTime-initTime)/this.dur;
          this.phaseFn(phase);
          let stream = V.from(e.inputBuffer.getChannelData(0));
          this.interceptorFn(stream);
        };
        let mute = actx.createGain();
        mute.gain.setValueAtTime(0,0);
        this.osc.connect(mute);
        mute.connect(actx.destination);
        this.streamSrc.connect(this.sp);
      } else {
        this.sp.onaudioprocess = e => {
          let phase = (actx.currentTime-initTime)/this.dur;
          this.phaseFn(phase);
        };
        this.osc.connect(this.sp);
      }

      this.sp.connect(actx.destination);
    }

    this.osc.start(this.nextStart?this.nextStart:actx.currentTime);
    this.nextStart = (this.nextStart?this.nextStart:actx.currentTime)+this.dur;
    this.osc.stop(this.nextStart);
    return this;
  }
  stop() {
    if (this.onendedFn) {
      this.onendedFn(this);
      this.onendedFn = null;
    }
    this.osc.disconnect();

    if (this.workletAvailable) {
      this.worklet.disconnect();
    }
    if (this.sp) {
      this.sp.disconnect();
      this.sp.onaudioprocess = null;
    }
    return this;
  }
  terminate() {
    this.repeatCount = 0;
    this.stop();
    return this;
  }
  duration(dur) {
    this.dur = dur;
    return this;
  }
  frequency(freq) {
    this.dur = 1/freq;
    return this;
  }
  samples(samps) {
    this.dur = samps / actx.sampleRate;
    return this;
  }
  interval(samps) {
    this.cbInterval = samps;
    return this;
  }
  repeat(count) {
    this.repeatCount = count ? count : Number.MAX_SAFE_INTEGER;
    return this;
  }
  phase(fn) {
    this.phaseFn = fn;
    return this;
  }
  tick(fn) {
    this.tickFn = fn;
    return this;
  }
  intercept(fn, node) {
    this.interceptorFn = fn;
    this.streamSrc = node;
    return this;
  }
  onended(fn) {
    this.onendedFn = fn;
    return this;
  }
}

export {Vector, Matrix, Tempo, Waveform, Clock};