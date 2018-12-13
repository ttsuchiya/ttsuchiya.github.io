const plugin = new CodapPluginHelper(codapInterface);
const dragHandler = new CodapDragHandler();
const moveRecorder = new PluginMovesRecorder(plugin);

const orc = `
instr 1
ipitchTable = 1
iloudnessTable = 2

iportt = 0.1
kgain = 0.2 * portk(tablei:k(p4, iloudnessTable), iportt, 0)

; Note: table opcode does not renew with the table update
; kfreq init 100 * pow(2, p5 * 6)

; kmult = portk(pow(2, scale:k(tablei:k(p4, ipitchTable), 6, 0)), iportt)
; kfreq = 200 * kmult

aamp = madsr(1,p3,1,1) * kgain
kfreq = portk(cpsmidinn(scale:k(tablei:k(p4, ipitchTable), 100, 60)), iportt, 0)
asig = oscil(aamp, kfreq);
outs(asig, asig)
endin
`;

const app = new Vue({
    el: '#app',
    data: {
        dimensions: {
            width: 300,
            height: 250
        },
        csoundReady: false,

        // prevItems: null,
        // prevRange: null,

        voices: {},

        contexts: null,
        context: null,
        attributes: null,
        pitchAttrOne: null,
        pitchAttrTwo: null,
        loudnessAttrOne: null,
        loudnessAttrTwo: null,
        globals: [],

        morphSlider: null
    },
    methods: {
        setup() {
            plugin.init('Glissando', this.dimensions).then(this.onGetData);

            codapInterface.on('notify', '*', notice => {
                if (!plugin.checkNoticeIdentity(notice)) {
                    return null;
                }

                if (notice.resource === 'documentChangeNotice') {
                    plugin.queryAllData().then(this.onGetData);
                } else if (notice.resource.includes('dataContextChangeNotice')) {
                    let context = notice.resource.split('[').pop().split(']')[0];
                    let operation = notice.values.operation;

                    if (operation === 'selectCases') {
                        plugin.getSelectedItems(context).then(this.onItemsSelected);
                    } else {
                        plugin.queryAllData().then(this.onGetData);
                    }
                }
            });
        },
        setupDrag() {
            dragHandler.on('dragenter', (data, els) => {
                els.forEach(el => {
                    el.style.backgroundColor = 'rgba(255,255,0,0.5)';
                });
            });

            dragHandler.on('dragleave', (data, els) => {
                els.forEach(el => {
                    el.style.backgroundColor = 'transparent';
                });
            });

            dragHandler.on('drop', (data, els) => {
                if (this.contexts && this.contexts.includes(data.context.name) && this.context !== data.context.name) {
                    this.context = data.context.name;
                    this.onContextSelectedByUI();
                }

                els.forEach(el => {
                    if (this.attributes && this.attributes.includes(data.attribute.name)) {
                        switch (el.id) {
                            case 'pitchAttrOne':
                                this.pitchAttrOne = data.attribute.name;
                                this.onPitchAttrOneSelectedByUI();
                                break;
                            case 'pitchAttrTwo':
                                this.pitchAttrTwo = data.attribute.name;
                                this.onPitchAttrTwoSelectedByUI();
                                break;
                            case 'loudnessAttrOne':
                                this.loudnessAttrOne = data.attribute.name;
                                this.onLoudnessAttrOneSelectedByUI();
                                break;
                            case 'loudnessAttrTwo':
                                this.loudnessAttrTwo = data.attribute.name;
                                this.onLoudnessAttrTwoSelectedByUI();
                                break;
                        }
                    }
                });
            });

            dragHandler.on('dragstart', (data, els) => {
                els.forEach(el => {
                    el.style.outline = '3px solid rgba(0,255,255,0.5)';
                });
            });

            dragHandler.on('dragend', (data, els) => {
                els.forEach(el => {
                    el.style.backgroundColor = 'transparent';
                    el.style.outline = '3px solid transparent';
                });
            });
        },
        setupUI() {
            this.morphSlider = new Nexus.Slider('#morph-slider');

            this.morphSlider.on('change', v => {
                this.morphTables(v);
            });
        },
        onGetData() {
            this.contexts = plugin.getContexts();

            if (this.context) {
                this.attributes = plugin.getAttributesForContext(this.context);

                if (this.playing) {

                }
            }
        },
        onItemsSelected(items) {
            let morphIndex = this.morphSlider.value;
            let voiceIDs = items.map(item => item.itemID); // TODO: itemID can be null
            // let voiceIDs = items.map(item => item.id); // TODO: rename to caseID
            // let pitchArray = items.map(item => {
            //     let rangeA = plugin.attrValueRanges[this.context][this.pitchAttrOne];
            //     let rangeB = plugin.attrValueRanges[this.context][this.pitchAttrTwo];
            //
            //     let a = (item.values[this.pitchAttrOne]-rangeA.min) / (rangeA.max-rangeA.min);
            //     let b = (item.values[this.pitchAttrTwo]-rangeB.min) / (rangeB.max-rangeB.min);
            //     return a * (1-morphIndex) + b * morphIndex;
            // });
            // let loudnessArray = items.map(item => {
            //     let rangeA = plugin.attrValueRanges[this.context][this.loudnessAttrOne];
            //     let rangeB = plugin.attrValueRanges[this.context][this.loudnessAttrTwo];
            //
            //     let a = (item.values[this.loudnessAttrOne]-rangeA.min) / (rangeA.max-rangeA.min);
            //     let b = (item.values[this.loudnessAttrTwo]-rangeB.min) / (rangeB.max-rangeB.min);
            //     return a * (1-morphIndex) + b * morphIndex;
            // });

            this.halt().then(_ => {
                this.morphTables().then(_ => {
                    voiceIDs.forEach(id => {
                        csound.Event(`i1 0 100 ${id}`);
                    });
                });
            });
        },
        reselectItems() {

        },
        onContextSelectedByUI() {
            this.attributes = plugin.getAttributesForContext(this.context);
        },
        morphTables() {
            return Promise.all([this.morphPitchTable(), this.morphLoudnessTable()]);
        },
        morphPitchTable() {
            let items = this.context && plugin.items[this.context].map(item => item.values);

            let morphIndex = this.morphSlider.value;

            let pitchArray = items.map(item => {
                let rangeA = plugin.attrValueRanges[this.context][this.pitchAttrOne];
                let rangeB = plugin.attrValueRanges[this.context][this.pitchAttrTwo];

                let a = (rangeA.max === rangeA.min) ? 0.5 : (item[this.pitchAttrOne]-rangeA.min) / (rangeA.max-rangeA.min);
                let b = (rangeB.max === rangeB.min) ? 0.5 : (item[this.pitchAttrTwo]-rangeB.min) / (rangeB.max-rangeB.min);
                return a * (1-morphIndex) + b * morphIndex;
            });

            return csound.CreateTable(1, pitchArray);
        },
        morphLoudnessTable() {
            let items = this.context && plugin.items[this.context].map(item => item.values);

            let morphIndex = this.morphSlider.value;

            let loudnessArray = items.map(item => {
                let rangeA = plugin.attrValueRanges[this.context][this.loudnessAttrOne];
                let rangeB = plugin.attrValueRanges[this.context][this.loudnessAttrTwo];

                let a = (rangeA.max === rangeA.min) ? 0.5 : (item[this.loudnessAttrOne]-rangeA.min) / (rangeA.max-rangeA.min);
                let b = (rangeB.max === rangeB.min) ? 0.5 : (item[this.loudnessAttrTwo]-rangeB.min) / (rangeB.max-rangeB.min);
                return a * (1-morphIndex) + b * morphIndex;
            });

            return csound.CreateTable(2, loudnessArray);
        },
        onPitchAttrSelectedByUI() {},
        onPitchAttrOneSelectedByUI() {},
        onPitchAttrTwoSelectedByUI() {},
        onLoudnessAttrOneSelectedByUI() {},
        onLoudnessAttrTwoSelectedByUI() {},
        halt() {
            return new Promise(function (resolve) {
                csound.Stop();
                csound.Csound.compileOrc("nchnls=2\n0dbfs=1\n");
                csound.Start();
                csound.Play();
                csound.CompileOrc(orc);
                resolve();
            });
        }
    },
    mounted() {
        this.setup();
        this.setupDrag();
        this.setupUI();
    }
});

function moduleDidLoad() {
    // TODO: CreateTable does not work with PlayCsd...
    // csound.PlayCsd('glissando.csd').then(_ => {
    //     let val = new Float32Array(4);
    //     csound.CreateTable(1, val).then(console.log);
    //     csound.Event(`i1 0 100 0`);
    // });

    csound.Play();
    csound.CompileOrc(orc);

    window.createTableCallbacks = {};

    csound.Csound.setMessageCallback(message => {
        let message_trunc = message.replace(/\[m/g, '');
        console.log(message_trunc);

        Object.keys(window.createTableCallbacks).forEach(key => {
            window.createTableCallbacks[key](message);
        });
    });

    app.csoundReady = true;
}