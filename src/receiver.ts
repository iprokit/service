/**
 * A generic `Receiver` acts as an interface between two services to process all incoming data as `Action`'s.
 */
export default class Receiver {
    /**
     * Creates an instance of a `Receiver`.
     */
    constructor() { }

    //////////////////////////////
    //////Gets/Sets
    //////////////////////////////
    /**
     * The name of the receiver.
     */
    public get name() {
        return this.constructor.name;
    }
}