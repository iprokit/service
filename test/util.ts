//Import Libs.
import http, { IncomingMessage } from 'http';

//Import Local.
import { HttpServer, HttpMethod, Incoming, ScpClient } from '../lib';

export function createString(size: number) {
    let characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let string = '';
    for (let i = 0; i < size; i++) {
        string += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return string;
}

export function createIdentifier() {
    return createString(10);
}

export function simulateRequest(server: HttpServer, method: HttpMethod, url: string) {
    const request = { url, method }
    const response = {}
    server.emit('request', request, response);
}

export function clientRequest(method: HttpMethod, host: string, port: number, path: string, body: string) {
    return new Promise<{ response: IncomingMessage, body: string }>((resolve, reject) => {
        const request = http.request({ host, port, method, path }, async (response) => {
            try {
                let body = '';
                for await (const chunk of response) {
                    body += chunk;
                }
                resolve({ response, body });
            } catch (error) {
                reject(error);
            }
        });
        request.end(body);
    });
}

export function clientMessage(client: ScpClient, operation: string, data: string) {
    return new Promise<{ incoming: Incoming, data: string }>((resolve, reject) => {
        const outgoing = client.message(operation, async (incoming) => {
            try {
                let data = '';
                for await (const chunk of incoming) {
                    data += chunk;
                }
                resolve({ incoming, data });
            } catch (error) {
                reject(error);
            }
        });
        outgoing.end(data);
    });
}