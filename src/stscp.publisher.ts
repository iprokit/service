export default class Publisher {
    constructor() { }

    public get name() {
        return this.constructor.name;
    }
}