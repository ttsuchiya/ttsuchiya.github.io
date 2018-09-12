const helper = new CodapHelper(codapInterface);

const app = new Vue({
    el: '#app',
    data: {
        dim: {
            width: 300,
            height: 180
        },

        data: null,
        contexts: null,
        collections: null,
        attributes: null,
        focusedContext: null,
        focusedCollection: null,
        prevSelectedIDs: [],

        pitchAttribute: null,
        pitchAttrRange: null,
        pitchAttrIsDate: false,
        pitchAttrIsDescending: false,

        timeAttribute: null,
        timeAttrRange: null,
        timeAttrIsDate: false,
        timeAttrIsDescending: false,

        csdFiles: [
            'SinusoidalGrains.csd',
            'ContDrums.csd',
            'FMGranular.csd'
        ],
        selectedCsd: null,
        csoundReady: false,
        playing: false,
        playbackSpeed: 0.5,
        pitchArray: [],
        timeArray: [],
    },
    methods: {
        resetPitchTimeMaps: function () {
            this.pitchAttribute = this.timeAttribute = null;
            this.pitchAttrRange = this.timeAttrRange = null;
        },
        onContextFocused: function () {
            // this.collections = helper.getCollectionsForContext(this.focusedContext);

            // this.attributes = null;
            this.attributes = helper.getAttributesForContext(this.focusedContext);

            // this.resetPitchTimeMaps();
        },
        onCollectionFocused: function () {
            this.attributes = helper.getAttributesForCollection(this.focusedContext, this.focusedCollection);
            // this.resetPitchTimeMaps();
        },
        onPitchAttributeSelected: function () {
            this.pitchAttrRange = this.calcRange(this.pitchAttribute, this.pitchAttrIsDate, this.pitchAttrIsDescending);

            if (this.playing) {
                this.reselectCases();
            }
        },
        onTimeAttributeSelected: function () {
            this.timeAttrRange = this.calcRange(this.timeAttribute, this.timeAttrIsDate, this.timeAttrIsDescending);

            if (this.playing) {
                this.reselectCases();
            }
        },
        onPitchAttrIsDateChanged: function () {

        },

        onTimeAttrIsDateChanged: function () {

        },

        reselectCases: function () {
            helper.getSelectedItems(this.focusedContext).then(this.onCasesSelected);
        },
        onCsdFileSelected: function () {

        },
        focusOnFirstCollection: function () {
            this.contexts = helper.getContexts();
            this.focusedContext = this.contexts[0];
            this.onContextFocused();
            this.focusedCollection = this.collections[0];
            this.onCollectionFocused();

            // if (this.attributes) {
            //     this.pitchAttribute = this.timeAttribute = this.attributes[0];
            //     this.onPitchAttributeSelected();
            //     this.onTimeAttributeSelected();
            // }
        },
        focusOnLastCollection: function () {
            if (this.contexts = helper.getContexts()) {
                this.focusedContext = this.contexts[0];
                this.onContextFocused();
                this.focusedCollection = this.collections[this.collections.length-1];
                this.onCollectionFocused();
            }
        },
        focusOnFirstContext: function () {
            if (this.contexts = helper.getContexts()) {
                this.focusedContext = this.contexts[0];
                this.onContextFocused();
            }
        },
        onGetData: function () {
            // this.focusOnLastCollection();
            // this.onPitchAttributeSelected();
            // this.onTimeAttributeSelected();

            // this.focusOnFirstContext();
            this.contexts = helper.getContexts();
        },
        calcRange: function (attribute, isDateTime, inverted) {
            // let attrValues = helper.getAttributeValues(this.focusedContext, this.focusedCollection, attribute);
            let attrValues = helper.getAttrValuesForContext(this.focusedContext, attribute);

            if (attrValues) {
                if (isDateTime) {
                    attrValues = attrValues.map(Date.parse).filter(v => !Number.isNaN(v));
                } else {
                    attrValues = attrValues.map(parseFloat).filter(v => !Number.isNaN(v));
                }

                if (attrValues.length !== 0) {
                    return {
                        len: attrValues.length,
                        min: inverted ? Math.max(...attrValues) : Math.min(...attrValues),
                        max: inverted ? Math.min(...attrValues) : Math.max(...attrValues)
                    }
                } else {
                    return null;
                }
            }
        },

        // Cases or items
        onCasesSelected: function (cases) {
            if (this.pitchAttrRange) {
                let range = this.pitchAttrRange.max - this.pitchAttrRange.min;
                // this.pitchArray = (range === 0) ? cases.map(() => 0.5) : cases.map(d => (d.values[this.pitchAttribute]-this.pitchAttrRange.min)/range);

                if (range === 0) {
                    this.pitchArray = cases.map(c => {
                        return { id: c.id, val: 0.5 };
                    });
                } else {
                    this.pitchArray = cases.map(c => {
                        let value = this.pitchAttrIsDate ? Date.parse(c.values[this.pitchAttribute]) : c.values[this.pitchAttribute];
                        return {
                            id: c.id,
                            val: (value-this.pitchAttrRange.min)/range
                        };
                    });
                }
            }

            if (this.timeAttrRange) {
                let range = this.timeAttrRange.max - this.timeAttrRange.min;
                // this.timeArray = (range === 0) ? cases.map(() => 0.5) : cases.map(d => (d.values[this.timeAttribute]-this.timeAttrRange.min)/range * ((this.timeAttrRange.len-1)/this.timeAttrRange.len));

                if (range === 0) {
                    this.timeArray = cases.map(c => {
                        return { id: c.id, val: 0 };
                    });
                } else {
                    this.timeArray = cases.map(c => {
                        let value = this.timeAttrIsDate ? Date.parse(c.values[this.timeAttribute]) : c.values[this.timeAttribute];
                        return {
                            id: c.id,
                            val: (value-this.timeAttrRange.min)/range * ((this.timeAttrRange.len-1)/this.timeAttrRange.len)
                        }
                    });
                }
            }

            if (this.playing) {
                this.stopNotes(this.prevSelectedIDs);
                this.triggerNotes();
            }

            this.prevSelectedIDs = cases.map(c => c.id);
        },
        stopNotes: function (ids) {
            ids.forEach(id => csound.Event(`i -1.${id} 0 1`));
        },
        triggerNotes: function () {
            this.timeArray.forEach((d,i) => {
                let pitch = this.pitchArray.length === this.timeArray.length ? this.pitchArray[i] : 0.5;
                csound.Event(`i 1.${d.id} 0 -1 ${d.val} ${pitch.val} ${1-this.timeArray.length/this.timeAttrRange.len*.5}`);
            });
        },
        play: function () {
            if (!this.csoundReady) {
                return null;
            }

            csound.PlayCsd(this.selectedCsd).then(() => {
                this.playing = true;
                csound.SetChannel('playbackSpeed', this.playbackSpeed);

                if (this.timeArray.length !== 0) {
                    this.triggerNotes();
                }
            });
        },
        stop: function () {
            if (!this.csoundReady) {
                return null;
            }

            csound.Stop();
            this.playing = false;
        }
    },
    mounted: function () {
        helper.init('Micro Rhythm', this.dim).then(this.onGetData);

        codapInterface.on('notify', '*', notice => {
            if (!helper.checkNoticeIdentity(notice)) {
                return null;
            }

            if (notice.resource === 'documentChangeNotice') {
                helper.queryAllData().then(this.onGetData);
            } else if (notice.resource.includes('dataContextChangeNotice')) {
                if (notice.values.operation === 'selectCases') {
                    if (notice.resource.includes(`[${this.focusedContext}]`)) {
                        // helper.getSelectedCases(this.focusedContext, this.collections[0]).then(console.log);
                        helper.getSelectedItems(this.focusedContext).then(this.onCasesSelected);
                    }
                } else {
                    helper.queryAllData().then(this.onGetData);
                }
            }
        });

        let playToggle = new Nexus.Toggle('#play-toggle', {
            size: [40, 20],
            state: true
        });

        playToggle.on('change', v => {
            if (v) {
                this.play();
            } else {
                this.stop();
            }
        });

        let speedSlider = new Nexus.Slider('#speed-slider', {
            size: [200, 20],
            mode: 'absolute',
            value: this.playbackSpeed
        });

        speedSlider.on('change', v => {
            this.playbackSpeed = v;

            if (this.csoundReady) {
                csound.SetChannel('playbackSpeed', v);
            }
        });

        this.selectedCsd = this.csdFiles[0];

    }
});

function moduleDidLoad() {
    app.csoundReady = true;
    app.play();
}