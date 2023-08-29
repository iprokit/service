//Import Libs.
import http, { IncomingMessage } from 'http';

//Import Local.
import { Incoming, ScpClient } from '../lib';

export function createString(size: number) {
    let characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let body = '';
    for (let i = 0; i < size; i++) {
        body += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return body;
}

export function createIdentifier() {
    return createString(10);
}

export function createMap() {
    return `${createString(10)}.${createString(10)}`;
}

export function createBody(size: number) {
    return createString(size);
}

export function clientRequest(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', host: string, port: number, path: string, body: string) {
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

export function clientMessage(client: ScpClient, map: string, body: string) {
    return new Promise<{ incoming: Incoming, body: string }>((resolve, reject) => {
        const outgoing = client.message(map, async (incoming) => {
            try {
                let body = '';
                for await (const chunk of incoming) {
                    body += chunk;
                }
                resolve({ incoming, body });
            } catch (error) {
                reject(error);
            }
        });
        outgoing.end(body);
    });
}