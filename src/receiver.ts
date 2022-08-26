/**
 * A generic `Receiver` is an instance of all the remote reply functions grouped by `className`;
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
        return this.constructor.name.replace('Receiver', '');
    }
}