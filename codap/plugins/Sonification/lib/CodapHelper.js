class CodapHelper {
    constructor(codapInterface) {
        this.codapInterface = codapInterface;
        this.prevNotice = null;
        this.data = null;
        this.structure = null;
        this.lists = {
            context: null,
            collection: null,
            attribute: null,
        };
        this.focused = {
            context: null,
            collection: null
        };
        this.items = null;
        this.itemAttributes = null;
        this.itemAttrInfo = null;
    }

    init(name, dimensions, version='1.0') {
        return this.codapInterface.init({
            name: name,
            title: name,
            version: version,
            dimensions: {
                width: dimensions.width,
                height: dimensions.height + 25
            }
        }).then(() => {
            // Allow attributes to move.
            return codapInterface.sendRequest({
                action: "update",
                resource: "interactiveFrame",
                values: {
                    preventDataContextReorg: false
                }
            }).then(() => this.queryAllData())
        });
    }

    checkNoticeIdentity(notice) {
        let res = true;
        if (this.prevNotice) {
            res = JSON.stringify(notice) !== JSON.stringify(this.prevNotice);
        }

        this.prevNotice = notice;
        return res; // True if the notification is not a duplicate.
    }

    queryAllData() {
        this.data = {};

        return new Promise((resolve) => {
            this.queryContextList().then(() => {
                this.queryCollectionList().then(() => {
                    this.queryAllCases().then(() => {
                        this.fillStructure();
                        this.queryAllItems().then(resolve);
                    });
                });
            });
        });
    }

    queryContextList() {
        return this.codapInterface.sendRequest({
            action: 'get',
            resource: 'dataContextList'
        }).then(result => {
            result.values.forEach(context => {
                this.data[context.name] = {};
            });
        });
    }

    queryCollectionList() {
        return Promise.all(Object.keys(this.data).map(context => {
            return this.codapInterface.sendRequest({
                action: 'get',
                resource: `dataContext[${context}].collectionList`
            }).then(result => {
                result.values.forEach(collection => {
                    this.data[context][collection.name] = {};
                });
            });
        }));
    }

    queryAllCases() {
        return Promise.all(Object.keys(this.data).map(context => {
            return Object.keys(this.data[context]).map(collection => {
                return this.codapInterface.sendRequest({
                    action: 'get',
                    resource: `dataContext[${context}].collection[${collection}].allCases`
                }).then(result => {
                    this.data[context][collection] = result.values.cases.map(c => c.case);
                });
            }).reduce((a,b) => a.concat(b), []);
        }).reduce((a,b) => a.concat(b), []));
    }

    queryAllItems() {
        this.items = {};

        return Promise.all(Object.keys(this.data).map(context => {
            this.items[context] = [];

            return Object.values(this.data[context]).map(cases => {
                return cases.map((c,i) => {
                    return this.codapInterface.sendRequest({
                        action: 'get',
                        resource: `dataContext[${context}].itemByCaseID[${c.id}]`
                    }).then(result => {
                        if (result.success) {
                            this.items[context][i] = {
                                values: result.values.values,
                                id: c.id, // Case ID
                                itemID: result.values.id
                            };
                        } else {
                            // Fallback for when hierarchical formula breaks the itemByCaseID API.
                            let collections = this.getCollectionsForContext(context);
                            let itemParts = collections.map(collection => {
                                // For a parent case, use its values together with children cases to reconstruct the item.
                                return this.data[context][collection].find(pc => pc.id === c.id || pc.children.includes(c.id));
                            }).filter(pc => typeof(pc) !== 'undefined').map(pc => pc.values);

                            let item = Object.assign({}, ...itemParts);

                            this.items[context][i] = {
                                values: item,
                                id: c.id,
                                itemID: null // Item ID not available!
                            }
                        }
                    });
                });
            }).reduce((a,b) => a.concat(b), []);
        }).reduce((a,b) => a.concat(b), [])).then(() => {
            this.itemAttributes = {};

            Object.keys(this.items).forEach(context => {
                if (this.items[context].length) {
                    this.itemAttributes[context] = Object.keys(this.items[context][0].values);
                }
            });

            // this.itemAttrInfo = {};
            // Object.keys(this.itemAttributes).forEach(context => {
            //     this.itemAttrInfo[context] = {};
            //
            //     this.item
            // })
        });
    }

    fillStructure() {
        let contexts = Object.keys(this.data);

        if (contexts.length !== 0) {
            this.structure = {};

            contexts.forEach(context => {
                this.structure[context] = {};

                let collections = Object.keys(this.data[context]);

                if (collections.length !== 0) {
                    collections.forEach(collection => {
                        let cases = this.data[context][collection];

                        if (cases.length !== 0) {
                            this.structure[context][collection] = Object.keys(cases[0].values);
                        }
                    });
                }
            });
        }
    }

    getContexts() {
        return this.structure ? Object.keys(this.structure) : null;
    }

    getCollectionsForContext(context) {
        return this.structure ? Object.keys(this.structure[context]) : null;
    }

    getAttributesForCollection(context, collection) {
        return this.structure ? this.structure[context][collection] : null;
    }

    getSelectedCases(context, collection) {
        return this.codapInterface.sendRequest({
            action: 'get',
            resource: `dataContext[${context}].selectionList`
        }).then(result => {
            let caseIDs = result.values.filter(v => v.collectionName === collection).map(v => v.caseID);

            return caseIDs.map(id => this.data[context][collection].find(c => c.id === id));
        });
    }

    getAttributeValues(context, collection, attribute) {
        return (this.data && Object.keys(this.data).length) ? this.data[context][collection].map(c => c.values[attribute]) : null;
    }

    getAttributesForContext(context) {
        return this.itemAttributes ? this.itemAttributes[context] : null;
    }

    getItemsForContext(context) {
        return null;
    }

    getAttrValuesForContext(context, attribute) {
        return (this.items && Object.keys(this.items).length) ? this.items[context].map(c => c.values[attribute]) : null;
    }

    getSelectedItems(context) {
        return this.codapInterface.sendRequest({
            action: 'get',
            resource: `dataContext[${context}].selectionList`
        }).then(result => {
            let caseIDs = result.values.map(v => v.caseID);
            let res =  caseIDs.map(id => this.items[context].find(item => item && item.id === id)).filter(item => typeof(item) !== 'undefined'); // item.id is actually the case ID.

            return res;
        });
    }

    // fillLists() {
    //     let contexts = Object.keys(this.data);
    //
    //     if (contexts.length !== 0) {
    //         this.lists.context = contexts;
    //         this.lists.collection = Object.keys(this.data[contexts[0]]);
    //     }
    // }
    //
    // getAttributeList(context, collection) {
    //     return this.codapInterface.sendRequest({
    //         action: 'get',
    //         resource: `dataContext[${context}].collection[${collection}].attributeList`
    //     }).then(result => {
    //         console.log(result);
    //     });
    // }
    //
    // focusOnFirstCollection() {
    //     if (this.lists.context && this.lists.collection) {
    //         this.focused.context = this.lists.context[0];
    //         this.focused.collection = this.lists.collection[0];
    //     }
    // }
    //
    // get allLists() {
    //     return [this.lists.context, this.lists.collection, this.lists.attribute];
    // }
    //
    // get contexts() {
    //     return this.lists.context;
    // }
    //
    // get collections() {
    //     return this.lists.collection;
    // }
    //
    // get attributes() {
    //     return this.lists.attribute;
    // }
}