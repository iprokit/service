//Import Libs.
import Stream from 'stream';
import HTTP, { RequestOptions } from 'http';

//Import Local.
import { RequestHandler } from './http.server';
import HttpStatusCode from './http.statusCode';

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
            const { method, url, headers, endpoint } = request;
            const path = url.replace(new RegExp(`^${endpoint.path.replace(/\/\*$/, '')}`), '');
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