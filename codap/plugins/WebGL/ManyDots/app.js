/**
 * Created by Takahiko Tsuchiya on 8/13/18.
 */

// Note: Don't include them in vue's data fields... Somehow they are iterated all the time and consumes a lot of CPU!
const canvas = {
    stage: null,
    texture: null,
    dots: [],
    attrText: null,
    selectionBox: {
        graphics: null,
        down: null,
        up: null,
        normalized: null,
        selectedDots: []
    },
    ticker: null
};

const app = new Vue({
    el: '#app',
    data: {
        dim: {
            width: 800,
            height: 800
        },
        data: {
            contextList: null,
            context: null,
            collectionList: null,
            collection: null,
            attrList: null,
            allCases: null,
            normalizedCases: null,
            selectedIDs: [],
            attrX: 0,
            attrY: 1,
            attrZ: 2
        },
    },
    methods: {
        checkNoticeIdentity: function (notice) {
            let res = true;
            if (this.prevNotice) {
                res = JSON.stringify(notice) !== JSON.stringify(this.prevNotice);
            }

            this.prevNotice = notice;
            return res; // True if the notification is not a duplicate.
        },

        getDataContextList: function () {
            return codapInterface.sendRequest({
                action: 'get',
                resource: 'dataContextList'
            }).then(function (result) {
                this.data.contextList = result.values.map(function (dataCtx) {
                    return dataCtx.name;
                });
            }.bind(this));
        },

        getCollectionList: function () {
            return codapInterface.sendRequest({
                action: 'get',
                resource: 'dataContext[' + this.data.context + '].collectionList'
            }).then(function (result) {
                this.data.collectionList = result.values.map(function (collection) {
                    return collection.name;
                });
            }.bind(this));
        },

        getAttrList: function () {
            return codapInterface.sendRequest({
                action: 'get',
                resource: 'dataContext[' + this.data.context + '].collection[' + this.data.collection + '].attributeList'
            }).then(function (result) {
                this.data.attrList = result.values.map(function (attr) {
                    return attr.name;
                });
            }.bind(this));
        },

        getAllCases: function () {
            return codapInterface.sendRequest({
                action: 'get',
                resource: 'dataContext[' + this.data.context + '].collection[' + this.data.collection + '].allCases'
            }).then(function (result) {
                this.data.allCases = result.values.cases;
                this.data.caseIDs = this.data.allCases.map(function (c) {
                    return c.case.id;
                });
                this.trimCasesWithMissingValues();
                this.normalizeAllCases();
                this.addDots();
                this.plot(this.data.attrX, this.data.attrY, this.data.attrZ);
            }.bind(this));
        },

        getAttrSet: function (key) {
            if (isNaN(parseInt(key))) {
                return this.data.allCases.map((case_) => {
                    return case_.case.values[key];
                });
            } else {
                return this.data.allCases.map((case_) => {
                    return case_.case.values[this.data.attrList[key]];
                });
            }
        },

        getSelections: function () {
            return codapInterface.sendRequest({
                action: 'get',
                resource: 'dataContext[' + this.data.context + '].selectionList'
            }).then(function (result) {
                this.data.selectedIDs = result.values.map(function (c) {
                    return c.caseID;
                });
            }.bind(this));
        },

        trimCasesWithMissingValues: function () {
            this.data.allCases = this.data.allCases.filter(c => {
                return Object.values(c.case.values).every(v => v !== '');
            });
        },

        normalizeAllCases: function () {
            this.data.normalizedCases = JSON.parse(JSON.stringify(this.data.allCases));
            this.data.attrList.forEach(attr => {
                let col = this.getAttrSet(attr);
                if (col.every(v => !isNaN(parseFloat(v)))) {
                    let min = Math.min(...col);
                    let max = Math.max(...col);
                    col.forEach((v,i) => {
                        this.data.normalizedCases[i].case.values[attr] = (v-min) / (max-min);
                    });
                }
            });
        },

        addDots: function () {
            this.data.normalizedCases.forEach(c => {
                let dot = new PIXI.Sprite(canvas.texture);
                dot.anchor.set(0.5);
                dot.case = c;
                // dot.interactive = true;
                // dot.buttonMode = true;
                // dot.on('pointerdown', function () {
                //     // this.scale.set(1);
                //     canvas.selectionBox.selectedDots.forEach(app.resetTint);
                // }.bind(dot));
                // dot.on('pointerover', function () {
                //     // this.tint = 0x00FFFF;
                //     this.scale.set(1.75);
                // }.bind(dot));
                // dot.on('pointerout', function () {
                //     // app.resetTint(this);
                //     this.scale.set(1);
                // }.bind(dot));
                // dot.on('pointerup', function () {
                //     codapInterface.sendRequest({
                //         "action": "create",
                //         "resource": `dataContext[${app.data.context}].selectionList`,
                //         "values": [this.case.case.id]
                //     });
                //
                //     canvas.selectionBox.selectedDots.push(this);
                //     app.highlight(this);
                // });

                canvas.stage.addChild(dot);
                canvas.dots.push(dot);
            });
            canvas.stage.addChild(canvas.attrText);
        },

        resetTint: function (dot) {
            let level = dot.case.case.values[app.data.attrList[app.data.attrZ]];
            // dot.alpha = 1; // TODO: not working
            let red = Math.round(255 * 0.1);
            let green = Math.round(200 * level) + 55;
            let blue = Math.round(255 * 0.1);
            dot.tint = red * 65536 + green * 256 + blue;
        },

        highlight: function (dot) {
            // dot.alpha = 0.9; // TODO: not working
            dot.tint = 0xFF0000;
            dot.parent.addChild(dot);
        },

        plot: function (attrX, attrY, attrZ) {
            let coords = this.data.normalizedCases.map((c,i) => {
                let x = c.case.values[this.data.attrList[attrX]];
                let y = c.case.values[this.data.attrList[attrY]];
                let dot = canvas.dots[i];

                if (canvas.selectionBox.selectedDots.indexOf(dot) !== -1) {
                    this.highlight(dot);
                } else {
                    this.resetTint(dot);
                }

                return [x, y];
            });

            this.transition(coords);
        },

        transition: function (coords) {
            let res = 60;
            let counter = 1;
            let oldCoords = canvas.dots.map(dot => {
                return [dot.position.x, dot.position.y];
            });

            let update = function () {
                canvas.dots.forEach((dot, i) => {
                    let oldX = oldCoords[i][0];
                    let oldY = oldCoords[i][1];
                    let newX = coords[i][0] * this.dim.width;
                    let newY = (1-coords[i][1]) * this.dim.height;

                    if (counter <= res) {
                        let x = oldX + (newX-oldX)*counter/res;
                        let y = oldY + (newY-oldY)*counter/res;
                        dot.position.set(x, y);
                    }
                });

                if (counter++ === res) {
                    canvas.ticker.remove(update);
                }
            }.bind(this);

            canvas.ticker.add(update);
        },

        setAttrText: function () {
            canvas.attrText.text = `x: ${this.data.attrList[this.data.attrX]}, y: ${this.data.attrList[this.data.attrY]}, c: ${this.data.attrList[this.data.attrZ]}`;
        }
    },
    mounted: function () {
        const renderer = PIXI.autoDetectRenderer(this.dim.width, this.dim.height, {
            view: this.$refs.canvas,
            backgroundColor: 0xFFFFFF
        });

        canvas.stage = new PIXI.Container();

        const interactionManager = new PIXI.interaction.InteractionManager(renderer);

        interactionManager.on('pointerdown', e => {
            canvas.selectionBox.down = {
                x: e.data.global.x,
                y: e.data.global.y
            };
            canvas.selectionBox.normalized = {
                ox: e.data.global.x / this.dim.width,
                oy: 1 - e.data.global.y / this.dim.height
            };

            canvas.selectionBox.selectedDots.forEach(this.resetTint);
        });
        interactionManager.on('pointermove', e => {
            if (canvas.selectionBox.down) {
                let ox = canvas.selectionBox.down.x;
                let oy = canvas.selectionBox.down.y;
                let dx = e.data.global.x;
                let dy = e.data.global.y;
                canvas.selectionBox.graphics.clear();
                canvas.selectionBox.graphics.beginFill(0x0000FF, 0.3);
                canvas.selectionBox.graphics.drawRect(ox, oy, dx-ox, dy-oy);
                canvas.selectionBox.graphics.endFill();

                canvas.selectionBox.normalized.dx = dx / this.dim.width;
                canvas.selectionBox.normalized.dy = 1 - dy / this.dim.height;
            }
        });
        interactionManager.on('pointerup', e => {
            if (canvas.selectionBox.down) {
                canvas.selectionBox.graphics.clear();
                canvas.selectionBox.up = e.data.global;
                canvas.selectionBox.down = null;

                let lx, mx, ly, my;
                if (canvas.selectionBox.normalized.ox < canvas.selectionBox.normalized.dx) {
                    lx = canvas.selectionBox.normalized.ox;
                    mx = canvas.selectionBox.normalized.dx;
                } else {
                    lx = canvas.selectionBox.normalized.dx;
                    mx = canvas.selectionBox.normalized.ox;
                }

                if (canvas.selectionBox.normalized.oy < canvas.selectionBox.normalized.dy) {
                    ly = canvas.selectionBox.normalized.oy;
                    my = canvas.selectionBox.normalized.dy;
                } else {
                    ly = canvas.selectionBox.normalized.dy;
                    my = canvas.selectionBox.normalized.oy;
                }

                canvas.selectionBox.selectedDots = canvas.dots.filter(d => {
                    let x = d.case.case.values[this.data.attrList[this.data.attrX]];
                    let y = d.case.case.values[this.data.attrList[this.data.attrY]];
                    return x >= lx && x <= mx && y >= ly && y <= my;
                });

                canvas.selectionBox.selectedDots.forEach(this.highlight);

                let selectedIDs = canvas.selectionBox.selectedDots.map(d => d.case.case.id);

                codapInterface.sendRequest({
                    "action": "create",
                    "resource": `dataContext[${app.data.context}].selectionList`,
                    "values": selectedIDs
                });
            }
        });


        let g = new PIXI.Graphics();
        g.beginFill(0xFFFFFF, .6);
        g.drawCircle(0, 0, 3);
        g.endFill();
        canvas.texture = renderer.generateTexture(g);

        canvas.attrText = new PIXI.Text('', {
            fontSize: '20px',
            fill: 'black',
            align: 'left'
        });
        canvas.attrText.position.set(this.dim.width * 0.01, this.dim.height * 0.01);

        canvas.selectionBox.graphics = new PIXI.Graphics();
        canvas.stage.addChild(canvas.selectionBox.graphics);

        canvas.ticker = PIXI.ticker.shared;
        canvas.ticker.autoStart = true;
        canvas.ticker.start();

        function draw(time) {
            canvas.ticker.update(time);
            renderer.render(canvas.stage);
            requestAnimationFrame(draw);
        }
        requestAnimationFrame(draw);

        const attrX = new Nexus.Number('#attrX', {
            size: [40, 20],
            value: this.data.attrX,
            min: 0,
            max: 20,
            step: 1
        });

        attrX.on('change', v => {
            if (v !== this.data.attrX) {
                this.data.attrX = v;
                this.plot(this.data.attrX, this.data.attrY, this.data.attrZ);
                this.setAttrText();
            }
        });

        const attrY = new Nexus.Number('#attrY', {
            size: [40, 20],
            value: this.data.attrY,
            min: 0,
            max: 20,
            step: 1
        });

        attrY.on('change', v => {
            if (v !== this.data.attrY) {
                this.data.attrY = v;
                this.plot(this.data.attrX, this.data.attrY, this.data.attrZ);
                this.setAttrText();
            }
        });

        const attrZ = new Nexus.Number('#attrZ', {
            size: [40, 20],
            value: this.data.attrZ,
            min: 0,
            max: 20,
            step: 1
        });

        attrZ.on('change', v => {
            if (v !== this.data.attrZ) {
                this.data.attrZ = v;
                this.plot(this.data.attrX, this.data.attrY, this.data.attrZ);
                this.setAttrText();
            }
        });

        codapInterface.init({
            name: 'Plot Many Dots',
            title: 'Plot Many Dots',
            version: '1.0',
            dimensions: {
                width: this.dim.width,
                height: this.dim.height + 25
            }
        }).then(_ => {
            this.getDataContextList().then(() => {
                if (this.data.contextList.length !== 0) {
                    // Using the most recent data set.
                    // TODO: Not general
                    this.data.context = this.data.contextList[this.data.contextList.length-1];
                    this.getCollectionList().then(() => {
                        if (this.data.collectionList.length !== 0) {
                            this.data.collection = this.data.collectionList[0];
                            this.getAttrList();
                            this.getAllCases();
                        }
                    });
                }
            });
        });

        codapInterface.on('notify', '*', notice => {
            if (!app.checkNoticeIdentity(notice)) {
                return null; // Don't do anything for duplicate notices.
            }

            console.log(notice);

            if (notice.resource === 'documentChangeNotice') {
                this.getDataContextList().then(() => {
                    if (this.data.contextList.length !== 0) {
                        // Using the most recent data set.
                        // TODO: Not general
                        this.data.context = this.data.contextList[this.data.contextList.length-1];
                        this.getCollectionList().then(() => {
                            if (this.data.collectionList.length !== 0) {
                                this.data.collection = this.data.collectionList[0];
                                this.getAttrList();
                                this.getAllCases();
                            }
                        });
                    }
                });
            } else if (notice.resource.includes('dataContextChangeNotice')) {
                // TODO: Be context sensitive?
                if (notice.values.operation === 'selectCases') {
                    this.getSelections().then(_ => {
                        canvas.selectionBox.selectedDots.forEach(this.resetTint);

                        canvas.selectionBox.selectedDots = canvas.dots.filter(d => {
                            return this.data.selectedIDs.indexOf(d.case.case.id) !== -1;
                        });
                        canvas.selectionBox.selectedDots.forEach(this.highlight);
                    });
                } else if (notice.values.operation === 'moveAttribute') {
                    this.getAttrList();
                } else if (['moveCases', 'createCases', 'deleteCases', 'updateCases'].indexOf(notice.values.operation) !== -1) {
                    this.getAllCases();
                    this.getAttrList();
                } else if (notice.values.operation === 'createCollection' || notice.values.operation === 'deleteCollection') {
                    this.getCollectionList();
                }
            }
        });
    }
});