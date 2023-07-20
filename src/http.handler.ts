//Import Libs.
import http, { RequestOptions } from 'http';

//Import Local.
import { Request, Response, RequestHandler } from './http.server';
import { NextFunction } from './common';

//////////////////////////////
//////Proxy
//////////////////////////////
/**
 * Creates a request handler that acts as a proxy to forward incoming HTTP requests to a specified host and port.
 * 
 * @param port the remote port.
 * @param host the remote host.
 */
export function proxy(port: number, host: string): RequestHandler {
    return (request: Request, response: Response, next: NextFunction) => {
        const path = request.url.replace(new RegExp(`^${request.route.path.replace(/\/\*$/, '')}`), '');
        const requestOptions: RequestOptions = {
            method: request.method,
            host: host,
            port: port,
            path: path,
            headers: request.headers
        }

        const proxyRequest = http.request(requestOptions, (proxyResponse) => {
            response.on('error', (error: Error) => { /* LIFE HAPPENS!!! */ });
            response.writeHead(proxyResponse.statusCode, proxyResponse.headers);
            proxyResponse.pipe(response, { end: true });
        });
        request.on('error', (error: Error) => { /* LIFE HAPPENS!!! */ });
        request.pipe(proxyRequest, { end: true });
    }
}