/**
 * 
 */
export default class Messenger {
    /**
     * Creates an instance of a `Messenger`.
     */
    constructor() { }

    //////////////////////////////
    //////Gets/Sets
    //////////////////////////////
    /**
     * The name of the messenger.
     */
    public get name() {
        return this.constructor.name;
    }
}