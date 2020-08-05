//Import Libs.
import http, { IncomingMessage, OutgoingHttpHeaders } from 'http';

//Import Local.
import Service from '../lib/service';

export function silentLog(service: Service) {
    service.logger.transports.forEach((transport) => (transport.silent = true));
}

export function setTimeoutAsync(ms: number) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve();
        }, ms);
    });
}

export function httpRequest(options: HttpOptions, callback: (response: HttpResponse, error?: Error) => void) {
    const host = options.host;
    const port = options.port;
    const path = options.path;
    const method = options.method;
    const json = options.json;
    const headers = options.headers || {};
    const body = (json === true) ? JSON.stringify(options.body) : options.body;

    headers['Accept'] = '*/*';
    headers['Content-Length'] = Buffer.byteLength(body);

    const request = http.request({ host: host, port: port, path: path, method: method, headers: headers }, (incomingMessage: HttpResponse) => {
        let chunks: string = '';
        incomingMessage.on('error', (error) => {
            callback(undefined, error);
        });
        incomingMessage.on('data', (chunk) => {
            chunks += chunk;
        });
        incomingMessage.on('end', () => {
            incomingMessage.body = (json) ? JSON.parse(chunks.toString()) : chunks.toString();
            callback(incomingMessage);
        });
    });
    request.on('error', (error) => {
        callback(undefined, error);
    });
    request.write(body);
    request.end();
}

export interface HttpResponse extends IncomingMessage {
    body?: any;
}

export interface HttpOptions {
    host: string;
    port: number;
    method: string;
    path: string;
    body: any;
    json: boolean;
    headers?: OutgoingHttpHeaders;
}