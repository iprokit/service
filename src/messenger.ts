/**
 * A generic `Messenger` acts as an interface between two services to process all incoming data as `Action`'s.
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