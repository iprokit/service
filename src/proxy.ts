//Import Libs.
import { EventEmitter } from 'events';
import http, { RequestOptions } from 'http';
import { Request, Response, NextFunction, RequestHandler } from 'express';

//Import Local.
import Helper from './helper';
import HttpStatusCodes from './http.statusCodes';

/**
 * Proxy is responsible for registering and managing proxy forwarders by mount and unmount.
 */
export default class Proxy {
    /**
     * Index signature for `ProxyForwarder`.
     */
    [proxyHandlerName: string]: ProxyForwarder | any;

    /**
     * The proxy handlers registered.
     */
    public readonly proxyHandlers: Array<ProxyHandler>;

    /**
     * Creates an instance of Proxy.
     */
    constructor() {
        this.proxyHandlers = new Array();
    }

    //////////////////////////////
    //////Mount/Unmount
    //////////////////////////////
    /**
     * Registers a new proxy handler and mounts its forwarder with `proxyHandlerName`.
     * 
     * @param proxyHandlerName the name of the proxy handler.
     */
    public mount(proxyHandlerName: string) {
        let proxyHandler = this.proxyHandlers.find(proxyHandler => proxyHandler.name === proxyHandlerName);
        if (!proxyHandler) {
            proxyHandler = new ProxyHandler(proxyHandlerName);

            //Add proxy forwarder as a dynamic function.
            Object.defineProperty(this, proxyHandler.name, {
                value: proxyHandler.forward,
                enumerable: true,
                configurable: true
            });
            this.proxyHandlers.push(proxyHandler);
        }
        return proxyHandler;
    }

    /**
     * Unregisters the proxy handler and unmounts its forwarder with `proxyHandlerName`.
     * 
     * @param proxyHandlerName the name of the proxy handler.
     */
    public unmount(proxyHandlerName: string) {
        let proxyHandlerIndex = this.proxyHandlers.findIndex(proxyHandler => proxyHandler.name === proxyHandlerName);
        if (proxyHandlerIndex >= 0) {
            //Remove proxy forwarder as a dynamic function.
            delete this[this.proxyHandlers[proxyHandlerIndex].name];
            this.proxyHandlers.splice(proxyHandlerIndex, 1);
        }
        return this;
    }
}

//////////////////////////////
//////ProxyHandler
//////////////////////////////
/**
 * ProxyHandler is responsible for forwarding HTTP request/response.
 */
export class ProxyHandler extends EventEmitter {
    /**
     * The name of the proxy handler.
     */
    public readonly name: string;

    /**
     * The remote host.
     */
    private _host: string;

    /**
     * The remote port.
     */
    private _port: number;

    /**
     * Set to true if the proxy handler is linked, false if unlinked.
     */
    private _linked: boolean;

    /**
     * Creates an instance of ProxyHandler.
     * 
     * @param name the name of the proxy handler.
     */
    constructor(name: string) {
        super();

        //Initialize Options.
        this.name = name;

        //Initialize Variables.
        this._linked = false;

        //Initialize Functions.
        Helper.bind(this.forward, this);
    }

    //////////////////////////////
    //////Gets/Sets
    //////////////////////////////
    /**
     * The remote host.
     */
    public get host() {
        return this._host;
    }

    /**
     * The remote port.
     */
    public get port() {
        return this._port;
    }

    /**
     * True if the proxy handler is linked, false if unlinked.
     */
    public get linked() {
        return this._linked;
    }

    //////////////////////////////
    //////Forward
    //////////////////////////////
    /**
     * A middlewear function to forward the request/response.
     * 
     * @param path the forwarding path.
     */
    public forward(path?: string): RequestHandler {
        return (request: Request, response: Response, next: NextFunction) => {
            if (!this._linked) {
                response.status(HttpStatusCodes.SERVICE_UNAVAILABLE).send('Proxy Service Unavailable');
                return;
            }

            //Generate proxy headers.
            Helper.generateProxyHeaders(request, request);

            //Initialize request options.
            const requestOptions: RequestOptions = {
                host: this._host,
                port: this._port,
                path: path ?? request.path,
                method: request.method,
                headers: request.headers
            }

            const source = { path: request.originalUrl }
            const target = { host: requestOptions.host, port: requestOptions.port, path: requestOptions.path }
            this.emit('forward', source, target);

            const proxyRequest = http.request(requestOptions, (proxyResponse) => {
                response.writeHead(proxyResponse.statusCode, proxyResponse.headers);
                proxyResponse.pipe(response, { end: true });
            });

            proxyRequest.on('error', (error) => {
                response.status(HttpStatusCodes.SERVICE_UNAVAILABLE).send(error.message);
            });

            request.pipe(proxyRequest, { end: true });
        }
    }

    //////////////////////////////
    //////Link Management
    //////////////////////////////
    /**
     * Link to the target HTTP server.
     * 
     * @param port the remote port.
     * @param host the remote host.
     */
    public link(port: number, host: string) {
        this._host = host;
        this._port = port;
        this._linked = true;
        this.emit('link');
        return this;
    }

    /**
     * Unlink from the target HTTP server.
     */
    public unlink() {
        this._linked = false;
        this.emit('unlink');
        return this;
    }
}

//////////////////////////////
//////ProxyForwarder
//////////////////////////////
/**
 * ProxyForwarder is a middlewear function to forward the request/response.
 */
export interface ProxyForwarder {
    (path?: string): RequestHandler;
}