/**
 * @description will be deprecated in ProMicro v.2.0.1
 * TODO: https://iprotechs.atlassian.net/browse/PMICRO-13
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