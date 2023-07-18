//Import Libs.
import { pipeline } from 'stream';
import http, { RequestOptions } from 'http';

//Import Local.
import { Request, Response, RequestHandler } from './http.server';
import HttpStatusCode from './http.statusCode';
import { NextFunction } from './common';

//////////////////////////////
//////Proxy
//////////////////////////////
export function proxy(options: ProxyOptions): RequestHandler {
    return (request: Request, response: Response, next: NextFunction) => {
        const path = request.url.replace(new RegExp(`^${request.route.replace(/\/\*$/, '')}`), '');
        const requestOptions: RequestOptions = {
            method: request.method,
            host: options.host,
            port: options.port,
            path: path,
            headers: request.headers
        }

        const proxyRequest = http.request(requestOptions, (proxyResponse) => {
            response.writeHead(proxyResponse.statusCode, proxyResponse.headers);
            pipeline(proxyResponse, response, (error: Error) => {
                if (error) return;
            });
        });
        pipeline(request, proxyRequest, (error: Error) => {
            if (error) response.writeHead(HttpStatusCode.SERVICE_UNAVAILABLE).end('Service unavailable');
        });
    }
}

export interface ProxyOptions {
    host: string;
    port: number;
}