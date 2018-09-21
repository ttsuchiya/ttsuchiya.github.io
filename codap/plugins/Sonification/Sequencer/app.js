/**
 * Created by Takahiko Tsuchiya on 8/21/18.
 */

const helper = new CodapHelper(codapInterface);

const app = new Vue({
    el: '#app',
    data: {
        dim: {
            width: 180,
            height: 200
        },

        helper: null,
        data: null,
        contextList: [],
        collectionList: [],
        selectedContext: null,
        selectedCollection: null,

        sequencer: {
            ticker: null,
            speed: 1,
            offset: 0,
            active: false
        },

        controls: {
            speedSlider: null,
            phaseSlider: null
        }
    },
    methods: {
        // checkNoticeIdentity: function (notice) {
        //     let res = true;
        //     if (this.prevNotice) {
        //         res = JSON.stringify(notice) !== JSON.stringify(this.prevNotice);
        //     }
        //
        //     this.prevNotice = notice;
        //     return res; // True if the notification is not a duplicate.
        // },

         getAllData: function () {
            this.data = {};

            this.getContextList().then(_ => {
                this.getCollectionList().then(_ => {
                    this.getAllCases().then(_ => {
                        this.fillLists();
                        this.selectLastCollection();
                    });
                });
            });
        },

        fillLists: function () {
            this.contextList = Object.keys(this.data);
            if (this.contextList.length !== 0) {
                this.collectionList = Object.keys(this.data[this.contextList[0]]);
            }
        },

        onContextSelected: function () {
            this.collectionList = Object.keys(this.data[this.selectedContext]);
        },

        selectFirstCollection: function () {
            this.selectedContext = this.contextList[0];
            this.selectedCollection = this.collectionList[0];
        },

        selectLastCollection: function () {
            this.selectedContext = this.contextList[0];
            this.selectedCollection = this.collectionList[this.collectionList.length-1];
        },

        getContextList: function () {
            return codapInterface.sendRequest({
                action: 'get',
                resource: 'dataContextList'
            }).then(result => {
                result.values.forEach(context => {
                    this.data[context.name] = {};
                });
            });
        },

        getCollectionList: function () {
            return Promise.all(Object.keys(this.data).map(context => {
                return codapInterface.sendRequest({
                    action: 'get',
                    resource: `dataContext[${context}].collectionList`
                }).then(result => {
                    result.values.forEach(collection => {
                        this.data[context][collection.name] = {};
                    });
                });
            }));
        },

        getAllCases: function () {
            return Promise.all(Object.keys(this.data).map((context) => {
                return Object.keys(this.data[context]).map(collection => {
                    return codapInterface.sendRequest({
                        action: 'get',
                        resource: `dataContext[${context}].collection[${collection}].allCases`
                    }).then(result => {
                        this.data[context][collection] = result.values.cases.map(c => c.case);
                    });
                });
            }).reduce((a,b) => a.concat(b), []));
        },

        start: function () {
            let offset = this.sequencer.offset;

            this.sendSelect();

            this.sequencer.ticker = dtm.music().play().every(1/this.sequencer.speed).rep().amp(0).each((m,i) => {
                let len = this.data[this.selectedContext][this.selectedCollection].length;
                this.controls.phaseSlider.value = ((i+offset)%len)/(len-1);
            });
        },

        stop: function () {
            if (this.sequencer.ticker) {
                this.sequencer.ticker.stop();
                this.sequencer.ticker = null;
            }
        },

        rewind: function () {
            this.controls.phaseSlider.value = 0;
        },

        sendSelect: function () {
            let values = [this.data[this.selectedContext][this.selectedCollection][this.sequencer.offset].id];

            codapInterface.sendRequest({
                action: 'create',
                resource: `dataContext[${this.selectedContext}].selectionList`,
                values: values
            });
        }
    },
    mounted: function () {
        codapInterface.init({
            name: 'Case Sequencer',
            title: 'Case Sequencer',
            version: '1.0',
            dimensions: {
                width: this.dim.width,
                height: this.dim.height + 25
            }
        }).then(this.getAllData);

        codapInterface.on('notify', '*', notice => {
            if (!helper.checkNoticeIdentity(notice)) {
                return null; // Don't do anything for duplicate notices.
            }

            if (notice.resource === 'documentChangeNotice') {
                this.getAllData();

                // this.helper.getAllData();
            } else if (notice.resource.includes('dataContextChangeNotice')) {
                if (notice.values.operation !== 'selectCases') {
                    this.getAllData();
                }
            }
        });

        this.controls.speedSlider = new Nexus.Slider('#speed-slider', {
            mode: 'absolute',
            min: 0,
            max: 1,
            step: 0,
            value: 0
        });

        this.controls.speedSlider.on('change', v => {
            this.sequencer.speed = v * 19 + 1;

            if (this.sequencer.ticker) {
                this.sequencer.ticker.every(1 / this.sequencer.speed);
            }
        });

        this.controls.phaseSlider = new Nexus.Slider('#phase-slider', {
            mode: 'absolute',
            min: 0,
            max: 1,
            step: 0,
            value: 0
        });

        this.controls.phaseSlider.on('change', v => {
            let offset = Math.round((this.data[this.selectedContext][this.selectedCollection].length-1) * v);
            if (this.sequencer.offset !== offset) {
                this.sequencer.offset = offset;

                this.sendSelect();
            }
        });
    }
});