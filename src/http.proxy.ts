//Import Libs.
import Stream from 'stream';
import HTTP, { RequestOptions, ClientRequest, IncomingMessage } from 'http';

//Import Local.
import { RequestHandler, Request, Response } from './http.server';

/**
 * This class implements a simple HTTP Proxy.
 * A `Proxy` is responsible for managing connection persistence to the target server.
 */
export default class Proxy implements IProxy {
    /**
     * The remote host.
     */
    private _host: string | undefined;

    /**
     * The remote port.
     */
    private _port: number | undefined;

    /**
     * Returns true when the proxy is configured, false otherwise.
     */
    private _configured: boolean;

    /**
     * Creates an instance of HTTP proxy.
     */
    constructor() {
        //Initialize Variables.
        this._configured = false;
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
     * Returns true when the proxy is configured, false otherwise.
     */
    public get configured() {
        return this._configured;
    }

    //////////////////////////////
    //////Interface: IProxy
    //////////////////////////////
    public forward(options?: ForwardOptions): RequestHandler {
        return (request, response, next) => {
            options = options ?? {};
            const { host, port } = this;
            const { method, url: path, headers } = request;
            const requestOptions: RequestOptions = { host, port, method, path, headers }

            //Let's boogie 🕺💃 🎶.
            if (options.onOptions) options.onOptions(requestOptions, request, response);
            const proxyRequest = HTTP.request(requestOptions, (proxyResponse) => {
                if (options!.onResponse) options!.onResponse(proxyResponse, request, response);
                response.writeHead(proxyResponse.statusCode as number, proxyResponse.headers);
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
    //////Configuration Management
    //////////////////////////////
    /**
     * Configures the proxy.
     * 
     * @param port the remote port.
     * @param host the remote host.
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
/////IProxy
//////////////////////////////
/**
 * Interface of HTTP `Proxy`.
 */
export interface IProxy {
    /**
     * Creates a request handler that forwards incoming requests to the target server.
     * 
     * @param options the optional options for forwarding requests.
     */
    forward: (options?: ForwardOptions) => RequestHandler;
}

//////////////////////////////
//////Forward Options
//////////////////////////////
export interface ForwardOptions {
    /**
     * Callback function to modify the request options before the request is sent.
     * 
     * @param options the request options.
     * @param request the incoming request.
     * @param response the outgoing response.
     */
    onOptions?: (options: RequestOptions, request: Request, response: Response) => void;

    /**
     * Callback function to modify the proxy request before it is sent to the target server.
     * 
     * @param proxyRequest the proxy request.
     * @param request the incoming request.
     * @param response the outgoing response.
     */
    onRequest?: (proxyRequest: ClientRequest, request: Request, response: Response) => void;

    /**
     * Callback function to modify the proxy response before it is sent back to the client.
     * 
     * @param proxyResponse the proxy response.
     * @param request the incoming request.
     * @param response the outgoing response.
     */
    onResponse?: (proxyResponse: IncomingMessage, request: Request, response: Response) => void;

    /**
     * Callback function to handle errors during the proxy request or response.
     * 
     * @param error the error object.
     * @param response the outgoing response.
     */
    onError?: (error: Error, response: Response) => void;
}