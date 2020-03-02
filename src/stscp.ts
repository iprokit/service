//Import @iprotechs Modules
import { Node as StscpNode } from "@iprotechs/stscp";

//////////////////////////////
//////Publisher
//////////////////////////////
export class Publisher {
    constructor() { }

    public get name() {
        return this.constructor.name;
    }
}

//////////////////////////////
//////Mesh
//////////////////////////////
/**
 * A sudo representation of a cluster of servers.
 * Mesh holds multiple `Node` which are connected to the server by the ClientManager object.
 * 
 * @see `Node`
 */
export class StscpMesh {
    /**
     * Index signature for nodes.
     */
    [nodeName: string]: StscpNode;
}