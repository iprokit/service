//Import Libs.
import http, { IncomingMessage } from 'http';

//Import Local.
import { HttpMethod, Params, Incoming, ScpClient, Service } from '../lib';

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

export function clientRequest(host: string, port: number, method: HttpMethod, path: string, body: string) {
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

export function clientOnBroadcast(client: ScpClient, operation: string) {
    return new Promise<{ data: string, params: Params }>((resolve, reject) => {
        client.onBroadcast(operation, (data: string, params: Params) => {
            resolve({ data, params });
        });
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

export function serviceOnBroadcast(service: Service, identifier: string, operation: string) {
    return new Promise<{ data: string, params: Params }>((resolve, reject) => {
        service.onBroadcast(identifier, operation, (data: string, params: Params) => {
            resolve({ data, params });
        });
    });
}

export function serviceMessage(service: Service, identifier: string, operation: string, data: string) {
    return new Promise<{ incoming: Incoming, data: string }>((resolve, reject) => {
        const outgoing = service.message(identifier, operation, async (incoming) => {
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