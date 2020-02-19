/////////////////////////
///////Publisher
/////////////////////////
export class Publisher {
    constructor() { }

    public get name() {
        return this.constructor.name;
    }
}

/////////////////////////
///////Subscriber
/////////////////////////
export class Subscriber {
    public name: string;

    constructor(name: string) {
        this.name = name;
    }
}

/////////////////////////
///////Mesh
/////////////////////////
export class Mesh {
    defineNodeAndGetAlias(url: string) {
        throw new Error("Method not implemented.");
    }

    getAlias(identifier: string) {
        throw new Error("Method not implemented.");
    }

    defineNode(url: string, identifier: string) {
        throw new Error("Method not implemented.");
    }

    disconnect(): any {
        throw new Error("Method not implemented.");
    }
    
    connect(): any {
        throw new Error("Method not implemented.");
    }
}