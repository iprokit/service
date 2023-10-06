//Import Libs.
import { EventEmitter } from 'events';
import http, { IncomingMessage } from 'http';

//Import Local.
import { Incoming, ScpClient } from '../lib';

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

export function on<T>(emitter: EventEmitter, eventName: string, eventCount: number) {
    return new Promise<Array<T>>((resolve, reject) => {
        const events = new Array();
        const listener = (...args: Array<any>) => {
            events.push(args);
            if (events.length === eventCount) {
                emitter.removeListener(eventName, listener);
                resolve(events);
            }
        };
        emitter.on(eventName, listener);
    });
}