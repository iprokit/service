// Import Libs.
import { once } from 'events';
import { Readable, promises as Stream } from 'stream';
import http, { IncomingMessage } from 'http';

// Import Local.
import { Method } from '../lib/http';
import { IClient, IOMode } from '../lib/scp';

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

export async function read<R extends Readable | AsyncIterable<string>>(readable: R) {
	let chunks = '';
	for await (const chunk of readable) {
		chunks += chunk;
	}
	return chunks;
}

export function clientRequest(host: string, port: number, method: Method, path: string, body: string) {
	return new Promise<{ response: IncomingMessage; body: string }>((resolve, reject) => {
		const headers = { 'Content-Length': Buffer.byteLength(body) };
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

export async function clientIO<C extends IClient>(client: C, mode: IOMode, operation: string, data: string) {
	const { incoming, outgoing } = client.IO(mode, operation);
	outgoing.end(data);
	await Stream.finished(outgoing);
	await once(incoming, 'rfi');
	return { incoming, data: await read(incoming) };
}
