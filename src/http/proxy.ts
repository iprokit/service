// Import Libs.
import Stream from 'stream';
import HTTP, { ClientRequest, IncomingMessage as ClientResponse, RequestOptions } from 'http';

// Import Local.
import { ServerRequest, ServerResponse, RequestHandler } from './server';

/**
 * Implements a simple HTTP Proxy.
 * Responsible for managing connection persistence to the target server.
 */
export default class Proxy implements IProxy {
    /**
     * Unique identifier of the proxy.
     */
    public readonly identifier: string;

    /**
     * Remote host.
     */
    private _host: string | undefined;

    /**
     * Remote port.
     */
    private _port: number | undefined;

    /**
     * `true` when the proxy is configured, `false` otherwise.
     */
    private _configured: boolean;

    /**
     * Creates an instance of HTTP `Proxy`.
     * 
     * @param identifier unique identifier of the proxy.
     */
    constructor(identifier: string) {
        // Initialize variables.
        this._configured = false;

        // Initialize options.
        this.identifier = identifier;
    }

    //////////////////////////////
    //////// Gets/Sets
    //////////////////////////////
    /**
     * Remote host.
     */
    public get host() {
        return this._host;
    }

    /**
     * Remote port.
     */
    public get port() {
        return this._port;
    }

    /**
     * `true` when the proxy is configured, `false` otherwise.
     */
    public get configured() {
        return this._configured;
    }

    //////////////////////////////
    //////// IProxy
    //////////////////////////////
    public forward(options?: ForwardOptions): RequestHandler {
        return (request, response, next) => {
            options = options ?? {};
            const { host, port } = this;
            const { method, url: path, headers } = request;
            headers['x-proxy-identifier'] = this.identifier;
            const requestOptions: RequestOptions = { host, port, method, path, headers }

            // Set: Response.
            response.setHeader('x-proxy-identifier', this.identifier); // 🏴‍☠️💀👻

            // Let's boogie 🕺💃 🎶.
            if (options.onOptions) options.onOptions(requestOptions, request, response);
            const proxyRequest = HTTP.request(requestOptions, (proxyResponse) => {
                if (options!.onResponse) options!.onResponse(proxyResponse, request, response);
                response.writeHead(proxyResponse.statusCode!, proxyResponse.headers);
                Stream.pipeline(proxyResponse, response, (error: Error | null) => {
                    if (error && options!.onError) options!.onError(error, response);
                });
            });
            if (options.onRequest) options.onRequest(proxyRequest, request, response);
            Stream.pipeline(request, proxyRequest, (error: Error | null) => {
                if (error && options!.onError) options!.onError(error, response);
            });
        }
    }

    //////////////////////////////
    //////// Configuration Management
    //////////////////////////////
    /**
     * Configures the proxy.
     * 
     * @param port remote port.
     * @param host remote host.
     */
    public configure(port: number, host: string) {
        this._port = port;
        this._host = host;
        this._configured = true;
        return this;
    }

    /**
     * Deconfigures the proxy.
     */
    public deconfigure() {
        this._port = undefined;
        this._host = undefined;
        this._configured = false;
        return this;
    }
}

//////////////////////////////
//////// IProxy
//////////////////////////////
/**
 * Interface for the HTTP `Proxy`.
 */
export interface IProxy {
    /**
     * Creates a request handler that forwards incoming requests to the target server.
     * 
     * @param options options for forwarding requests.
     */
    forward: (options?: ForwardOptions) => RequestHandler;
}

//////////////////////////////
//////// Forward Options
//////////////////////////////
export interface ForwardOptions {
    /**
     * Callback function to modify request options before sending the request.
     * 
     * @param options request options.
     * @param request incoming request.
     * @param response outgoing response.
     */
    onOptions?: (options: RequestOptions, request: ServerRequest, response: ServerResponse) => void;

    /**
     * Callback function to modify proxy request before it is sent to the target server.
     * 
     * @param proxyRequest proxy request.
     * @param request incoming request.
     * @param response outgoing response.
     */
    onRequest?: (proxyRequest: ClientRequest, request: ServerRequest, response: ServerResponse) => void;

    /**
     * Callback function to modify proxy response before it is sent back to the client.
     * 
     * @param proxyResponse proxy response.
     * @param request incoming request.
     * @param response outgoing response.
     */
    onResponse?: (proxyResponse: ClientResponse, request: ServerRequest, response: ServerResponse) => void;

    /**
     * Callback function to handle errors during the proxy request or response.
     * 
     * @param error error object.
     * @param response outgoing response.
     */
    onError?: (error: Error, response: ServerResponse) => void;
}