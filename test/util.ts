// Import Libs.
import { once } from 'events';
import { Readable, Writable, promises as Stream } from 'stream';
import http, { IncomingMessage } from 'http';

// Import Local.
import { Method } from '../lib/http';
import { Frame, RFI, Mode, Signal, Client } from '../lib/scp';

export function createString(size: number) {
	let characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	let string = '';
	for (let i = 0; i < size; i++) {
		string += characters.charAt(Math.floor(Math.random() * characters.length));
	}
	return string;
}

export function createFrame(size?: number) {
	return Frame.createData(createString(size ?? Frame.PAYLOAD_BYTES));
}

export function createRFI() {
	return new RFI(createString(5) as Mode, createString(10), { ID: createString(5) });
}

export function createData(size?: number) {
	return createString(size ?? Frame.PAYLOAD_BYTES);
}

export function createSignal() {
	return new Signal(createString(10).toUpperCase(), { ID: createString(5) });
}

export function createIdentifier() {
	return createString(10);
}

export async function readObjects<R extends Readable>(readable: R) {
	const chunksReceived = new Array();
	for await (const chunk of readable) {
		chunksReceived.push(chunk);
	}
	await Stream.finished(readable);
	return chunksReceived;
}

export async function writeObjects<W extends Writable, C>(writable: W, chunks: Array<C>, shouldFinish: boolean) {
	for await (const chunk of chunks) {
		if (!writable.write(chunk)) {
			await once(writable, 'drain');
		}
	}
	writable.end();
	shouldFinish && (await Stream.finished(writable));
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

export async function clientIO(client: Client, mode: Mode, operation: string, data: string) {
	const { incoming, outgoing } = await client.IO(mode, operation, { CID: client.identifier });
	outgoing.end(data);
	await Stream.finished(outgoing);
	await once(incoming, 'rfi');
	return { incoming, data: await read(incoming) };
}
