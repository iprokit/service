//Import Libs.
import OS from 'os';
import Stream from 'stream';
import HTTP, { RequestOptions } from 'http';

//Import Local.
import { RequestHandler } from './http.server';
import { RemoteFunctionHandler } from './scp.server';
import ScpClient from './scp.client';

namespace Utilities {
    //////////////////////////////
    //////Local Address
    //////////////////////////////
    /**
     * Returns the first active IPv4 address reported by the Operating System.
     */
    export function localAddress() {
        const interfaces = OS.networkInterfaces();
        for (const name of Object.keys(interfaces)) {
            const activeInterface = interfaces[name].find(({ family, internal }) => family === 'IPv4' && !internal);
            if (activeInterface)
                return activeInterface.address;
        }
        return undefined; // DAH!!
    }

    //////////////////////////////
    //////HTTP: Proxy
    //////////////////////////////
    /**
     * Creates a request handler that acts as a proxy to forward incoming HTTP requests.
     * 
     * @param relay the relay to which incoming requests will be forwarded.
     */
    export function proxy(relay: HttpRelay): RequestHandler {
        return (request, response, next) => {
            const { method, url, headers, route } = request;
            const path = url.replace(new RegExp(`^${route.path.replace(/\/\*$/, '')}`), '');
            const options: RequestOptions = { host: relay.remoteAddress, port: relay.remotePort, method, path, headers }

            //Let's boogie 🕺💃 🎶.
            const proxyRequest = HTTP.request(options, (proxyResponse) => {
                response.on('error', (error: Error) => { /* LIFE HAPPENS!!! */ });
                response.writeHead(proxyResponse.statusCode, proxyResponse.headers);
                proxyResponse.pipe(response, { end: true });
            });
            request.on('error', (error: Error) => { /* LIFE HAPPENS!!! */ });
            request.pipe(proxyRequest, { end: true });
        }
    }

    //////////////////////////////
    //////SCP: Reply
    //////////////////////////////
    /**
     * Creates a remote function handler that processes incoming message and outgoing reply using the provided reply function.
     * 
     * @param replyFunction the reply function.
     */
    export function reply<Reply>(replyFunction: ReplyFunction<Reply>): RemoteFunctionHandler {
        return async (incoming, outgoing, proceed) => {
            //Looks like the message is not an object, Consumer needs to handle it!
            if (incoming.getParam('FORMAT') !== 'OBJECT') {
                proceed();
                return;
            }

            //Read: Incoming stream.
            let data = '';
            try {
                for await (const chunk of incoming) {
                    data += chunk;
                }
            } catch (error) { /* LIFE HAPPENS!!! */ }

            //Execute: Reply function.
            let reply = '';
            try {
                let returned = await replyFunction(...JSON.parse(data));
                reply = (returned !== undefined || null) ? JSON.stringify(returned) : JSON.stringify({});
                outgoing.setParam('STATUS', 'OK');
            } catch (error) {
                delete error.stack; /* Delete stack from error because we dont need it. */
                reply = JSON.stringify(error, Object.getOwnPropertyNames(error));
                outgoing.setParam('STATUS', 'ERROR');
            }

            //Write: Outgoing stream.
            Stream.finished(outgoing, (error) => { /* LIFE HAPPENS!!! */ });
            outgoing.end(reply);
        }
    }

    //////////////////////////////
    //////SCP: Message
    //////////////////////////////
    /**
     * Sends a message to the remote function and returns a promise that resolves to the received reply.
     * 
     * @param client the client to which the message is sent.
     * @param operation the operation of the remote function.
     * @param message the message to send.
     */
    export function message<Reply>(client: ScpClient, operation: string, ...message: Array<any>) {
        return new Promise<Reply>((resolve, reject) => {
            //Read: Incoming stream.
            const outgoing = client.message(operation, async (incoming) => {
                try {
                    let data = '';
                    for await (const chunk of incoming) {
                        data += chunk;
                    }

                    if (incoming.getParam('STATUS') === 'OK') {
                        resolve(JSON.parse(data));
                    }
                    if (incoming.getParam('STATUS') === 'ERROR') {
                        const error = new Error();
                        Object.assign(error, JSON.parse(data));
                        reject(error);
                    }
                } catch (error) {
                    reject(error);
                }
            });

            //Write: Outgoing stream.
            Stream.finished(outgoing, (error) => error && reject(error));
            outgoing.setParam('FORMAT', 'OBJECT');
            outgoing.end(JSON.stringify(message));
        });
    }
}
export default Utilities;

//////////////////////////////
//////Http Relay
//////////////////////////////
/**
 * This class implements a simple Http Relay.
 * A `HttpRelay` is responsible for managing connection configuration to the target server.
 */
export class HttpRelay {
    /**
     * Set the remote address of the relay.
     */
    private _remoteAddress: string;

    /**
     * Set the remote port of the relay.
     */
    private _remotePort: number;

    /**
     * Creates an instance of HTTP relay.
     */
    constructor() { }

    //////////////////////////////
    //////Gets/Sets
    //////////////////////////////
    /**
     * The remote address of the relay.
     */
    public get remoteAddress() {
        return this._remoteAddress;
    }

    /**
     * The remote port of the relay.
     */
    public get remotePort() {
        return this._remotePort;
    }

    //////////////////////////////
    //////Configure
    //////////////////////////////
    /**
     * Configure the connection to the target server.
     * 
     * @param port the remote port.
     * @param host the remote host.
     */
    public configure(port: number, host: string) {
        this._remotePort = port;
        this._remoteAddress = host;
        return this;
    }
}

/**
 * The HTTP method.
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

//////////////////////////////
//////Reply Function
//////////////////////////////
/**
 * The reply function.
 */
export type ReplyFunction<Reply> = (...message: Array<any>) => Promise<Reply> | Reply;