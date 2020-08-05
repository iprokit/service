//Import Libs.
import http, { IncomingMessage, RequestOptions } from 'http';

//Import Local.
import Service from '../lib/service';

export function silentLog(service: Service) {
    service.logger.transports.forEach((transport) => (transport.silent = true));
}

export function setTimeoutAsync(ms: number) {
    return new Promise((resolve, reject) => {
        setTimeout(resolve, ms);
    });
}

export function httpRequest(options: HttpOptions, callback: (response: HttpResponse, error?: Error) => void) {
    const body = (options.json) ? JSON.stringify(options.body) : options.body;
    options.headers = options.headers || {};
    options.headers['Accept'] = '*/*';
    options.headers['Content-Length'] = Buffer.byteLength(body);

    const request = http.request(options, (incomingMessage: HttpResponse) => {
        let chunks: string = '';
        incomingMessage.on('error', (error) => {
            callback(undefined, error);
        });
        incomingMessage.on('data', (chunk) => {
            chunks += chunk;
        });
        incomingMessage.on('end', () => {
            incomingMessage.body = (options.json) ? JSON.parse(chunks.toString()) : chunks.toString();
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

export interface HttpOptions extends RequestOptions {
    json: boolean;
    body: any;
}