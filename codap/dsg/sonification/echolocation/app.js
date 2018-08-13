/**
 * Created by Takahiko Tsuchiya on 7/9/18.
 */

//================================
// Global callbacks for csound.js
function moduleDidLoad() {
    // csound.StartInputAudio().then(function () {});
    csound.PlayCsd('echolocation.csd');
    app.setEchoState(0.5, 0.5);

    csound.Csound.setMessageCallback(function (message) {
        let message_trunc = message.replace(/\[m/g, '');
        // console.log(message_trunc);
    });

    document.getElementById('loading-screen').style.display = 'none';

    app.randomWalk();
}

// function handleMessage(message) {
//     // document.getElementById('console').innerText += message;
//     app.message = message;
// }

const dataFields = {
    time: 'Chirp Time',
    delL: 'Left Time',
    delR: 'Right Time',
    attenL: 'Left Intensity',
    attenR: 'Right Intensity',
    level: 'Level'
};

const movements = [
    // index 0 for testing
    {
        x: dtm.random(2),
        y: dtm.random(2)
    },
    {
        x: dtm.data(-1,1,-1).amp(0.75).range(0,1,-1,1),
        y: dtm.data(0.5),
        duration: 6,
        deviation: 0.01
    },
    {
        x: dtm.data(0.5),
        y: dtm.data(1,-1,1).amp(0.75).range(0,1,-1,1),
        curve: dtm.data(0,1,0).line(1000).expc(10),
        duration: 8,
        deviation: 0.005
    },
    {
        x: dtm.data(-1,1,1,-1,-1).amp(0.5).range(0,1,-1,1),
        y: dtm.data(-1,-1,1,1,-1).amp(0.5).range(0,1,-1,1),
        duration: 8,
        deviation: 0.01
    },
    {
        x: dtm.sin(100).amp(0.75).range(0,1,-1,1),
        y: dtm.sin(100).amp(0.35).freq(2).range(0,1,-1,1),
        duration: 6,
        deviation: 0.005
    },
    {
        x: dtm.sin(100).amp(0.5).range(0,1,-1,1),
        y: dtm.cos(100).amp(0.5).range(0,1,-1,1),
        curve: null,
        duration: 6,
        deviation: 0.02
    },
    {
        x: dtm.sin(100).amp(0.7).freq(4).range(0,1,-1,1),
        y: dtm.sin(100).amp(0.7).freq(3).range(0,1,-1,1),
        duration: 12,
    },
    {
        x: dtm.data(-1,-1,1,-1,1,1,-1).amp(0.6).range(0,1,-1,1),
        y: dtm.data(-1,1,1,-1,-1,1,-1).amp(0.6).range(0,1,-1,1),
        duration: 12,
        deviation: 0.01
    },
    {
        x: dtm.sin(100).amp(0.6).range(0,1,-1,1),
        y: dtm.cos(100).amp(0.6).range(0,1,-1,1),
        curve: dtm.cos().freq(0.5),
        duration: 8,
        deviation: 0.003
    }
];

const app = new Vue({
    el: '#app',
    data: {
        pluginDim: {
            width: 320,
            height: 480 + 25
        },
        canvasDim: {
            width: 300,
            height: 300
        },
        target: {
            x: 0.5,
            y: 0.5,
            image: null,
            animator: null,
            phaseOffset: 0
        },
        echoState: {
            leftDelay: 0,
            rightDelay: 0,
            leftIntensity: 0,
            rightIntensity: 0,
        },
        signal: {
            image: null,
            animator: null
        },
        crossHair: {
            image: null,
            radius: 30,
            alpha: 0.75
        },
        rays: {
            left: null,
            right: null,
            radius: 0.1,
            alpha: 0.5
        },
        countUp: {
            timer: null,
            active: false,
            current: 0,
            offset: 0,
            text: null
        },
        countDown: {
            duration: 60,
            remaining: null,
            timer: null,
            text: null
        },
        lighting: {
            image: null,
            alpha: dtm.data(0.3,0.5,1),
            timer: null
        },
        autoChirp: {
            interval: 1,
            timer: null
        },
        game: {
            active: true,
            level: 0
        },
        paused: false
    },
    methods: {
        setupCodapTable: function () {
            codapInterface.sendRequest({
                action: 'create',
                resource: 'dataContext',
                values: {
                    name: 'Measurements',
                    title: 'Echo Measurements',
                    collections: [{
                        name: 'Measurements',
                        title: 'Echo Measurements',
                        attrs: Object.values(dataFields).map(function (field) {
                            return {
                                name: field,
                                type: field === 'Chirp Time' ? 'date' : 'numeric'
                            }
                        })
                    }],
                }
            });
        },

        recordMeasurement: function () {
            // let time = CSOUND_AUDIO_CONTEXT.currentTime;
            // data[dataFields.time] = time;
            let data = {};
            data[dataFields.time] = new Date();
            data[dataFields.delL] = this.echoState.leftDelay;
            data[dataFields.delR] = this.echoState.rightDelay;
            data[dataFields.attenL] = this.echoState.leftIntensity;
            data[dataFields.attenR] = this.echoState.rightIntensity;
            data[dataFields.level] = this.game.level;

            codapInterface.sendRequest({
                action: 'create',
                resource: 'collection[Measurements].case',
                values: [{
                    values: data
                }]
            });
        },

        setupCanvas: function () {
            const renderer = PIXI.autoDetectRenderer(this.canvasDim.width, this.canvasDim.height, { view: this.$refs.canvas });
            const mousePosition = renderer.plugins.interaction.mouse.global;

            const forest = new PIXI.Sprite.fromImage('img/Trees-Path-Nature-Landscape-Forest-991704.jpg');
            forest.scale.set(0.417);

            this.lighting.image = new PIXI.Sprite(PIXI.Texture.WHITE);
            this.lighting.image.width = this.canvasDim.width;
            this.lighting.image.height = this.canvasDim.height;
            this.lighting.image.alpha = this.lighting.alpha.get(0);
            this.lighting.image.interactive = true;
            this.lighting.image.on('pointerdown', _ => {
                if (this.paused) {
                    if (this.target.image.position.x < mousePosition.x+this.crossHair.radius &&
                        this.target.image.position.x > mousePosition.x-this.crossHair.radius &&
                        this.target.image.position.y < mousePosition.y+this.crossHair.radius &&
                        this.target.image.position.y > mousePosition.y-this.crossHair.radius) {
                        alert('Caught!');
                    } else {
                        alert('Missed!');
                    }
                } else {
                    this.chirp();
                }
            });

            this.target.image = new PIXI.Graphics();
            this.target.image.beginFill(0x000000, 1);
            this.target.image.drawCircle(0, 0, 5);
            this.target.image.endFill();
            this.target.image.position.set(this.canvasDim.width/2, this.canvasDim.height/2);

            this.crossHair.image = new PIXI.Graphics();
            this.crossHair.image.beginFill(0xFF0000, this.crossHair.alpha);
            this.crossHair.image.drawCircle(0, 0, this.crossHair.radius);
            this.crossHair.image.endFill();
            this.crossHair.image.position.set(999, 999);

            this.rays.left = new PIXI.Graphics();
            this.rays.right = new PIXI.Graphics();

            this.signal.image = new PIXI.Sprite.fromImage('img/1220904_px.svg');
            this.signal.image.scale.set(0.2);
            this.signal.image.anchor.set(0.5, 0.5);
            this.signal.image.position.set(this.canvasDim.width/2, this.canvasDim.height * 0.77);
            this.signal.image.alpha = 0.0;

            this.countDown.text = new PIXI.Text('', {
                font: '100px',
                fill: 'white',
                align: 'center'
            });
            this.countDown.text.anchor.set(0.5);
            this.countDown.text.position.set(this.canvasDim.width / 2, this.canvasDim.height / 2);

            const mousePositionText = new PIXI.Text('', {
                font: '20px',
                fill: 'white',
                align: 'center'
            });
            mousePositionText.anchor.set(0.5);
            mousePositionText.position.set(this.canvasDim.width * 0.7, this.canvasDim.height * 0.05);

            const stage = new PIXI.Container();
            stage.addChild(forest);
            stage.addChild(this.lighting.image);
            stage.addChild(this.target.image);
            // stage.addChild(this.countDown.text);
            stage.addChild(mousePositionText);
            stage.addChild(this.signal.image);
            stage.addChild(this.crossHair.image);
            stage.addChild(this.rays.left);
            stage.addChild(this.rays.right);

            function formatMousePositionText() {
                let x = mousePosition.x / app.canvasDim.width;
                let y = 1 - mousePosition.y / app.canvasDim.height;
                let p = 3;
                if (x >= 0 && x <= 1 && y >= 0 && y <= 1) {
                    return 'x: ' + x.toPrecision(p) + ', y: ' + y.toPrecision(p);
                } else {
                    return '';
                }
            }

            function mouseWithinBoundary() {
                return mousePosition.x >= 0 && mousePosition.x <= app.canvasDim.width && mousePosition.y >= 0 && mousePosition.y <= app.canvasDim.height;
            }

            function draw() {
                requestAnimationFrame(draw);
                renderer.render(stage);

                if (app.paused) {
                    if (mouseWithinBoundary()) {
                        app.crossHair.image.alpha = app.crossHair.alpha;
                        app.crossHair.image.position.set(mousePosition.x, mousePosition.y);
                        mousePositionText.text = formatMousePositionText();

                        app.rays.left.clear();
                        app.rays.left.lineStyle(2, 0xFF0000, app.rays.alpha);
                        app.rays.left.moveTo((0.5-app.rays.radius) * app.canvasDim.width, app.canvasDim.height);
                        app.rays.left.lineTo(mousePosition.x, mousePosition.y);

                        app.rays.right.clear();
                        app.rays.right.lineStyle(2, 0xFF0000, app.rays.alpha);
                        app.rays.right.moveTo((0.5+app.rays.radius) * app.canvasDim.width, app.canvasDim.height);
                        app.rays.right.lineTo(mousePosition.x, mousePosition.y);

                        // let x = mousePosition.x / app.canvasDim.width;
                        // let y = 1 - mousePosition.y / app.canvasDim.height;
                        // let [delL, delR] = app.calcEcho(x, y);
                        // console.log(delL * 343 / 2, delR * 343 / 2);
                    } else {
                        app.crossHair.image.alpha = 0;
                        app.rays.left.clear();
                        app.rays.right.clear();
                    }
                }
            }
            requestAnimationFrame(draw);
        },

        chirp: function () {
            csound.Event('i "CHIRP" 0 2');
            this.animateSignal();

            if (this.game.active && !this.paused) {
                this.recordMeasurement();
            }
        },

        animateSignal: function () {
            if (this.signal.animator) {
                this.signal.animator.stop();
            }

            this.signal.animator = dtm.music().amp(0).play().for(0.75).phase(p => {
                this.signal.image.alpha = p.get(0);
            }).curve(dtm.line(100,1,0).expc(50));
        },

        calcEcho: function (x, y) {
            let relHeadSize = 0.2;
            let headDelay = 0.0004373177843 * 100;
            let maxDist = Math.sqrt(1+Math.pow(1-(0.5-relHeadSize/2),2)) * 2;

            let distY = Math.pow(y,2);
            let distC = Math.sqrt(distY+Math.pow(x-0.5,2));
            let distL = (Math.sqrt(distY+Math.pow(x-(0.5-relHeadSize/2),2))+distC)/maxDist;
            let distR = (Math.sqrt(distY+Math.pow(x-(0.5+relHeadSize/2),2))+distC)/maxDist;

            let denormal = 0.00000001;
            let delL = headDelay/relHeadSize * distL + denormal;
            let delR = headDelay/relHeadSize * distR + denormal;
            let attenL = 1/Math.pow(2, 1/relHeadSize * distL);
            let attenR = 1/Math.pow(2, 1/relHeadSize * distR);

            return [delL, delR, attenL, attenR];
        },

        setEchoState: function (x, y) {
            [this.echoState.leftDelay, this.echoState.rightDelay, this.echoState.leftIntensity, this.echoState.rightIntensity] = this.calcEcho(x, y);

            csound.SetChannel('x', this.target.x = x);
            csound.SetChannel('y', this.target.y = y);
            csound.SetChannel('leftDelay', this.echoState.leftDelay);
            csound.SetChannel('rightDelay', this.echoState.rightDelay);
            csound.SetChannel('leftIntensity', this.echoState.leftIntensity);
            csound.SetChannel('rightIntensity', this.echoState.rightIntensity);
        },

        pause: function (bool) {
            if (typeof(bool) === 'undefined') {
                bool = true;
            }

            if (bool) {
                this.target.phaseOffset += this.target.animator.phase() % 1;
                this.target.animator.stop();
            } else {
                this.target.animator.play();
            }

            this.paused = bool;
        },

        darkenRoom: function (bool) {
            this.lighting.timer = dtm.music().amp(0).for(1.5);

            if (bool) {
                this.lighting.timer.phase(p => {
                    let hex = Math.round(255*(1-p.get(0)));
                    this.lighting.image.tint = hex*65536+hex*256+hex;
                    this.lighting.image.alpha = this.lighting.alpha.phase(p).get(0);
                }).play();
            } else {
                this.lighting.timer.phase(p => {
                    let hex = Math.round(255*p.get(0));
                    this.lighting.image.tint = hex*65536+hex*256+hex;
                    this.lighting.image.alpha = this.lighting.alpha.phase(p.subfrom(1)).get(0);
                }).play();
            }
        },

        countUp: function () {

        },

        randomWalk: function () {
            const len = 100;
            let xt = dtm.random(dtm.randi(1,10,20).get(0));
            let yt = dtm.random(dtm.randi(1,10,20).get(0));
            xt.append(xt(0));
            yt.append(yt(0));
            xt.cos(len);
            yt.cos(len);

            this.target.animator = dtm.music().amp(0).for(20).rep().phase(p => {
                p.add(this.target.phaseOffset);
                let x = xt.phase(p).get(0);
                let y = yt.phase(p).get(0);
                this.target.image.position.set(x * this.canvasDim.width, (1-y) * this.canvasDim.height);
                this.setEchoState(x, y);
            }).play();
        },

        moveTarget: function (ID) {
            if (typeof(ID) === 'undefined') {
                ID = 0;
            }

            let xt = movements[ID].x;
            let yt = movements[ID].y;
            let curve = movements[ID].curve;
            let duration = movements[ID].duration;
            let deviation = movements[ID].deviation;

            if (deviation) {
                xt.line(100).add(dtm.random(100,-deviation,deviation)).line(1000);
                yt.line(100).add(dtm.random(100,-deviation,deviation)).line(1000);
                // xt.step(100).add(dtm.random(100,-app.posDev,app.posDev)).line(1000);
                // yt.step(100).add(dtm.random(100,-app.posDev,app.posDev)).line(1000);
            }

            this.target.animator = dtm.music().amp(0).play().phase(p => {
                p.add(this.target.phaseOffset);
                let x = xt.phase(p).get(0);
                let y = yt.phase(p).get(0);
                this.target.image.position.set(x * this.canvasDim.width, (1-y) * this.canvasDim.height);

                this.setEchoState(x, y);
            }).rep();

            if (duration) {
                this.target.animator.every(duration);
            }

            if (curve) {
                this.target.animator.curve(curve);
            }
        }
    },
    mounted: function () {
        this.setupCanvas();

        const level = new Nexus.Number('#level', {
            size: [40, 20],
            value: 0,
            min: 0,
            max: movements.length-1,
            step: 1
        });

        level.on('change', v => {
            if (this.game.level !== v) {
                this.game.level = v;

                if (!this.paused) {
                    this.target.animator.stop();
                    if (v === 0) {
                        this.randomWalk();
                    } else {
                        this.moveTarget(v);
                    }
                }
            }
        });

        const pauseButton = new Nexus.Toggle('#play-pause', {
            size: [40, 20],
            state: false
        });

        pauseButton.on('change', v => {
            this.pause(v);

            if (v) {
                autoChirpButton.state = false;
            }
        });

        const autoChirpButton = new Nexus.Toggle('#auto-chirp', {
            size: [40, 20],
            state: false
        });

        autoChirpButton.on('change', v => {
            if (v) {
                this.autoChirp.timer = dtm.music().amp(0).play().every(this.autoChirp.interval).rep().each(_ => {
                    this.chirp();
                });
            } else {
                if (this.autoChirp.timer) {
                    this.autoChirp.timer.stop();
                    this.autoChirp.timer = null;
                }
            }
        });

        const nightButton = new Nexus.Toggle('#night-mode', {
            size: [40, 20],
            state: false
        });

        nightButton.on('change', v => {
            this.darkenRoom(v);
        });

        codapInterface.init({
            name: 'Echolocation Game',
            title: 'Echolocation Game',
            version: '001',
            dimensions: {
                width: this.pluginDim.width,
                height: this.pluginDim.height
            }
        }).then(this.setupCodapTable);
    }
});