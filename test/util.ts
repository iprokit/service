//Import Libs.
import { Readable } from 'stream';
import http, { IncomingMessage } from 'http';

//Import Local.
import { HttpMethod, Incoming, IScpClient } from '../lib';

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

export function clientRequest(host: string, port: number, method: HttpMethod, path: string, body: string) {
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

export function clientOnBroadcast<C extends IScpClient, Args>(client: C, operation: string, count: number) {
    return new Promise<Array<Array<Args>>>((resolve, reject) => {
        let received = -1;
        const argsResolved = new Array<Args>();
        client.onBroadcast(operation, (...args) => {
            received++;
            argsResolved.push(...args);
            if (received + 1 === count) {
                resolve(argsResolved as Array<any>);
            }
        });
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