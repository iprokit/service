//Import Modules
import http, { RequestOptions } from 'http';
import { Request, Response, NextFunction, RequestHandler } from 'express';
import { Logger } from 'winston';

//Local Imports
import Helper from './helper';
import HttpStatusCodes from './http.statusCodes';

/**
 * `ProxyClient` is an implementation of reverse proxie.
 * A `ProxyClient` is responsible for managing link to the target server.
 */
export default class ProxyClient {
    /**
     * The remote host.
     */
    private _host: string;

    /**
     * The remote port.
     */
    private _port: number;

    /**
     * Set to true if the proxy client is linked, false if unlinked.
     */
    private _linked: boolean;

    /**
     * The logger instance.
     */
    public readonly logger: Logger;

    /**
     * Creates an instance of `ProxyClient`.
     * 
     * @param logger the logger instance.
     */
    constructor(logger: Logger) {
        //Initialize variables.
        this.logger = logger;

        //Initialize link.
        this._linked = false;

        //Bind Proxy.
        Helper.bind(this.proxyHandler, this);
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
     * True if the proxy client is linked, false if unlinked.
     */
    public get linked() {
        return this._linked;
    }

    //////////////////////////////
    //////Proxy
    //////////////////////////////
    /**
     * A middlewear function to proxy request and response.
     * 
     * @param requestPath the request path.
     */
    public proxyHandler(requestPath?: string): RequestHandler {
        return (request: Request, response: Response, next: NextFunction) => {
            //Validate Link.
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
                path: requestPath ?? request.path,
                method: request.method,
                headers: request.headers
            }

            //Initialize variables.
            const sourceUrl = `${request.originalUrl}`;
            const targetUrl = `http://${requestOptions.host}:${requestOptions.port}${requestOptions.path}`;

            this.logger.info(`${sourceUrl} -> ${targetUrl}`);

            const proxyRequest = http.request(requestOptions, (proxyResponse) => {
                response.writeHead(proxyResponse.statusCode, proxyResponse.headers);

                //Pass the proxy response to response.
                proxyResponse.pipe(response, { end: true });
            });

            proxyRequest.on('error', (error) => {
                response.status(HttpStatusCodes.SERVICE_UNAVAILABLE).send(error.message);
            });

            //If the request is JSON write JSON; else pipe the data.
            if (request.headers['content-type'] === 'application/json') {
                proxyRequest.end(JSON.stringify(request.body));
            } else {
                request.pipe(proxyRequest, { end: true });
            }
        }
    }

    //////////////////////////////
    //////Link Management
    //////////////////////////////
    /**
     * Link to the proxy server.
     * 
     * @param host the proxy address.
     * @param port the proxy HTTP port.
     * @param callback optional callback. Will be called once linked.
     */
    public link(host: string, port: number, callback?: () => void) {
        //Initialize variables.
        this._host = host;
        this._port = port;

        //Set link variable.
        this._linked = true;

        callback && callback();
        return this;
    }

    /**
     * Unlink from the proxy server.
     * 
     * @param callback optional callback. Will be called once unlinked.
     */
    public unlink(callback?: () => void) {
        //Set link variable.
        this._linked = false;
        
        callback && callback();
        return this;
    }
}