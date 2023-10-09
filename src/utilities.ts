//Import Libs.
import Stream from 'stream';
import HTTP, { RequestOptions } from 'http';

//Import Local.
import { RequestHandler } from './http.server';
import HttpStatusCode from './http.statusCode';
import { RemoteFunctionHandler } from './scp.server';
import ScpClient from './scp.client';

namespace Utilities {
    //////////////////////////////
    //////HTTP: Proxy
    //////////////////////////////
    /**
     * Creates a request handler that acts as a proxy to forward incoming HTTP requests.
     * 
     * @param options the proxy options.
     */
    export function proxy(options: ProxyOptions): RequestHandler {
        return (request, response, next) => {
            const { host, port } = options;
            const { method, url, headers, route } = request;
            const path = url.replace(new RegExp(`^${route.path.replace(/\/\*$/, '')}`), '');
            const requestOptions: RequestOptions = { host, port, method, path, headers }

            //Let's boogie 🕺💃 🎶.
            const proxyRequest = HTTP.request(requestOptions, (proxyResponse) => {
                response.writeHead(proxyResponse.statusCode, proxyResponse.headers);
                Stream.pipeline(proxyResponse, response, (error: Error) => {
                    if (error) {
                        response.writeHead(HttpStatusCode.INTERNAL_SERVER_ERROR);
                        response.end(error.message);
                    }
                });
            });
            proxyRequest.on('error', (error: Error) => {
                response.writeHead(HttpStatusCode.INTERNAL_SERVER_ERROR);
                response.end(error.message);
            });
            Stream.pipeline(request, proxyRequest, (error: Error) => {
                if (error) {
                    response.writeHead(HttpStatusCode.INTERNAL_SERVER_ERROR);
                    response.end(error.message);
                }
            });
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
            if (incoming.get('FORMAT') !== 'OBJECT') {
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
                outgoing.set('STATUS', 'OK');
            } catch (error) {
                delete error.stack; /* Delete stack from error because we dont need it. */
                reply = JSON.stringify(error, Object.getOwnPropertyNames(error));
                outgoing.set('STATUS', 'ERROR');
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

                    if (incoming.get('STATUS') === 'OK') {
                        resolve(JSON.parse(data));
                    }
                    if (incoming.get('STATUS') === 'ERROR') {
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
            outgoing.set('FORMAT', 'OBJECT');
            outgoing.end(JSON.stringify(message));
        });
    }
}
export default Utilities;

//////////////////////////////
//////Proxy Options
//////////////////////////////
export interface ProxyOptions {
    /**
     * The remote host of the proxy server.
     */
    host: string;

    /**
     * The remote port of the proxy server.
     */
    port: number;
}

//////////////////////////////
//////Reply Function
//////////////////////////////
/**
 * The reply function.
 */
export type ReplyFunction<Reply> = (...message: Array<any>) => Promise<Reply> | Reply;