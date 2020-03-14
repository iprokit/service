/**
 * @description will be deprecated in ProMicro v.2.0.1
 */
export default class Publisher {
    /**
     * Creates an instance of a `Publisher`.
     */
    constructor() { }

    //////////////////////////////
    //////Gets/Sets
    //////////////////////////////
    /**
     * The name of the publisher.
     */
    public get name() {
        return this.constructor.name;
    }
}