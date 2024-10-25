//Import Libs.
import { Readable } from 'stream';
import http, { IncomingMessage } from 'http';

//Import Local.
import { HttpMethodType, Incoming, IScpClient } from '../lib';

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

export async function read<R extends Readable>(readable: R) {
    let chunks = '';
    for await (const chunk of readable) {
        chunks += chunk;
    }
    return chunks;
}

export function clientRequest(host: string, port: number, method: HttpMethodType, path: string, body: string) {
    return new Promise<{ response: IncomingMessage, body: string }>((resolve, reject) => {
        const headers = { 'Content-Length': Buffer.byteLength(body) }
        const request = http.request({ host, port, method, path, headers }, async (response) => {
            try {
                const body = await read(response);
                resolve({ response, body });
            } catch (error) {
                reject(error);
            }
        });
        request.end(body);
    });
}

export function clientOmni<C extends IScpClient>(client: C, operation: string, data: string) {
    return new Promise<{ incoming: Incoming, data: string }>((resolve, reject) => {
        const outgoing = client.omni(operation, async (incoming) => {
            try {
                const data = await read(incoming);
                resolve({ incoming, data });
            } catch (error) {
                reject(error);
            }
        });
        outgoing.end(data);
    });
}