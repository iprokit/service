//Import Modules
import { RequestHandler } from 'express';
import { Logger } from 'winston';

//Local Imports
import ProxyClient from './proxy.client';

/**
 * This class implements a simple proxy client manager.
 * A `ProxyClientManager` is responsible for managing multiple unique proxy clients.
 * 
 * It also manages each proxy clients `ProxyHandler`, exposing them into the `Proxy` instance.
 */
export default class ProxyClientManager {
    /**
     * `ProxyHandler`'s are populated into this `Proxy` during runtime.
     */
    public readonly proxy: Proxy;

    /**
     * Cells to proxy clients and its handler on the proxy.
     */
    public readonly cells: Array<Cell>;

    /**
     * The logger instance.
     */
    public readonly logger: Logger;

    /**
     * Creates an instance of `ProxyClientManager`.
     * 
     * @param options the optional constructor options.
     */
    constructor(options: Options) {
        //Initialize Options.
        options = options || {};

        //Initialize variables.
        this.proxy = options.proxy || new Proxy();
        this.logger = options.logger;

        //Initialize cells.
        this.cells = new Array();
    }

    //////////////////////////////
    //////Gets/Sets
    //////////////////////////////
    /**
     * List of all the proxy clients.
     */
    public get clients() {
        const clients: { [cellName: string]: ProxyClient } = {};

        this.cells.forEach(cell => {
            clients[cell.name] = cell.client;
        });

        return clients;
    }

    /**
     * Proxy clients linked status.
     */
    public get linked() {
        const clients: { [cellName: string]: boolean } = {};

        this.cells.forEach(cell => {
            clients[cell.name] = cell.client.linked;
        });

        return clients;
    }

    //////////////////////////////
    //////Create
    //////////////////////////////
    /**
     * Returns the new proxy client created.
     */
    public createClient() {
        //Create new client.
        const client = new ProxyClient(this.logger);

        //return the client.
        return client;
    }

    //////////////////////////////
    //////Add/Remove
    //////////////////////////////
    /**
     * Adds the proxy client on `name`.
     * 
     * @param name the name of the cell.
     * @param client the proxy client to add.
     */
    public add(name: string, client: ProxyClient) {
        //Validate unique and add cell.
        if (!this.cells.find(cell => cell.name === name)) {
            const cell = new Cell(name, client);

            //Add proxy handler into proxy as a dynamic function.
            Object.defineProperty(this.proxy, cell.name, { value: cell.client.proxyHandler, enumerable: true, configurable: true });

            //Add cell.
            this.cells.push(cell);
        }

        //Return this for chaining.
        return this;
    }

    /**
     * Removes the proxy client.
     * 
     * @param client the proxy client to remove.
     */
    public remove(client: ProxyClient) {
        //Get cellIndex.
        let cellIndex = this.cells.findIndex(cell => cell.client === client);

        //Validate cell found.
        if (cellIndex >= 0) {
            //Remove proxy handler from proxy as a dynamic function.
            delete this.proxy[this.cells[cellIndex].name];

            //Remove cell.
            this.cells.splice(cellIndex, 1);
        }

        //Return this for chaining.
        return this;
    }
}

//////////////////////////////
//////Constructor: Options
//////////////////////////////
/**
 * The optional constructor options for proxy manager.
 */
export type Options = {
    /**
     * The optional, proxy instance.
     */
    proxy?: Proxy;

    /**
     * The optional, logger instance.
     */
    logger?: Logger;
}

//////////////////////////////
//////Cell
//////////////////////////////
/**
 * `Cell` represents a pointer to the `ProxyClient` and its `ProxyHandler` on the `Proxy` instance.
 */
export class Cell {
    /**
     * The name of the proxy.
     */
    public readonly name: string;

    /**
     * The proxy client instance.
     */
    public readonly client: ProxyClient;

    /**
     * Creates an instance of `Cell`.
     * 
     * @param name the name of the proxy.
     * @param client the proxy client instance.
     */
    constructor(name: string, client: ProxyClient) {
        //Initialize variables.
        this.name = name;
        this.client = client;
    }
}

//////////////////////////////
//////Proxy
//////////////////////////////
/**
 * `Proxy` is a representation of proxy server's in the form of an object.
 * 
 * During runtime:
 * `ProxyHandler` functions are populated into `Proxy` with its cellName.
 * This is handled by the `ProxyClientManager`.
 */
export class Proxy {
    /**
     * Index signature for `ProxyHandler`.
     */
    [cellName: string]: ProxyHandler;
}

/**
 * `ProxyHandler` is a `express` based middleware function.
 */
export interface ProxyHandler {
    (redirectPath?: string): RequestHandler;
}