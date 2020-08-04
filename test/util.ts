//Import Libs.
import http, { RequestOptions, IncomingMessage } from 'http';

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

export function httpRequest(host: string, port: number, method: string, path: string, body: any, json: boolean, callback: (response: HttpResponse, error?: Error) => void) {
    body = (json === true) ? JSON.stringify(body) : body;
    const requestOptions: RequestOptions = {
        host: host,
        port: port,
        path: path,
        method: method,
        headers: {
            'Accept': '*/*',
            'Content-Length': Buffer.byteLength(body),
        }
    }

    const request = http.request(requestOptions, (incomingMessage: HttpResponse) => {
        let chunks: string = '';
        incomingMessage.on('error', (error) => {
            callback(undefined, error);
        });
        incomingMessage.on('data', (chunk) => {
            chunks += chunk;
        });
        incomingMessage.on('end', () => {
            incomingMessage.body = (json === true) ? JSON.parse(chunks.toString()) : chunks.toString();
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