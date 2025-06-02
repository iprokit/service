/**
 * @iProKit/Service
 * Copyright (c) 2019-2025 Rutvik Katuri / iProTechs
 * SPDX-License-Identifier: Apache-2.0
 */

// Import Libs.
import { Duplex, Readable, Writable } from 'stream';
import { Socket as TcpSocket } from 'net';
import { TLSSocket } from 'tls';

// Import Local.
import Frame, { Type } from './frame';
import RFI, { IRFI, Mode, Parameters } from './rfi';
import Signal from './signal';

// Symbol Definitions.
const readingPaused = Symbol('ReadingPaused');
const rifSent = Symbol('RFISent');

/**
 * `Protocol` provides a high-level abstraction for the Service Communication Protocol (SCP).
 * It manages the encoding and decoding of SCP frames over a duplex stream by encapsulating a user-provided socket.
 */
export default class Protocol extends Duplex {
	/**
	 * Underlying socket.
	 */
	public readonly socket: TcpSocket | TLSSocket;

	/**
	 * `true` when read buffer is full and calls to `push` return `false`.
	 * Additionally new frames will not be read off the underlying socket until the consumer calls `read`.
	 */
	private [readingPaused]: boolean;

	/**
	 * Creates an instance of `Protocol`.
	 *
	 * @param socket underlying socket.
	 */
	constructor(socket: TcpSocket | TLSSocket) {
		super({ objectMode: true });

		// Initialize options.
		this.socket = socket;

		// Initialize variables.
		this[readingPaused] = false;

		// Bind listeners.
		this.onReadable = this.onReadable.bind(this);
		this.onEnd = this.onEnd.bind(this);

		// Add listeners.
		this.socket.addListener('readable', this.onReadable);
		this.socket.addListener('end', this.onEnd);
		this.socket.addListener('error', (error: Error) => this.emit('error', error));
	}

	//////////////////////////////
	//////// Duplex
	//////////////////////////////
	/**
	 * Implements the readable stream method `_read`.
	 *
	 * WARNING: Should not be called by the consumer.
	 */
	public _read() {
		this[readingPaused] = false;

		// Force trigger `onReadable` to read frame from the underlying socket.
		setImmediate(this.onReadable);
	}

	/**
	 * Implements the writable stream method `_write`.
	 *
	 * WARNING: Should not be called by the consumer.
	 */
	public _write(frame: Frame, encoding: BufferEncoding, callback: (error?: Error | null) => void) {
		// Ohoooo, Frame is too large.
		if (frame.length > Frame.FRAME_BYTES) {
			callback(new Error('FRAME_TOO_LARGE'));
			return;
		}

		// Write HEAD Segments.
		const head = Buffer.allocUnsafe(Frame.HEAD_BYTES);
		head.writeUInt16BE(frame.length, 0);
		head.writeInt8(frame.type, Frame.LENGTH_BYTES);

		// Write TAIL Segments.
		const tail = frame.payload ?? Buffer.alloc(0);

		// Create a new frame buffer.
		const frameBuffer = Buffer.concat([head, tail]);

		/**
		 * Used to cache the error and return when `callback` is ready.
		 */
		let errorCache: Error | null | undefined;

		// Write the frame buffer into the underlying socket.
		const write = this.socket.write(frameBuffer, (error?: Error | null) => (errorCache = error));
		if (write) {
			// Good to go, send the callback.
			callback(errorCache);
		} else {
			// Boy! This stream has too many back issues. It needs to see a doctor. HA.HA.HA...
			this.socket.once('drain', () => callback(errorCache));
		}
	}

	/**
	 * Implements the writable stream method `_final`.
	 * Used when `end()` is called to end the writable stream.
	 *
	 * WARNING: Should not be called by the consumer.
	 */
	public _final(callback: (error?: Error | null) => void) {
		this.socket.end(callback);
	}

	/**
	 * Implements the readable/writable stream method `_destroy`.
	 * Used when `destroy()` is called to destroy the stream.
	 *
	 * WARNING: Should not be called by the consumer.
	 */
	public _destroy(error: Error | null, callback: (error: Error | null) => void) {
		this.socket.destroy();
		callback(error);
	}

	//////////////////////////////
	//////// Read Operations
	//////////////////////////////
	/**
	 * Fired when `readable` event is triggered on the underlying socket.
	 * This is called every time there is a new frame to be read from the underlying socket.
	 */
	private onReadable() {
		while (!this[readingPaused]) {
			const head: Buffer = this.socket.read(Frame.HEAD_BYTES);
			// Looks like the HEAD is unavailable. oops!!!
			if (!head) return;

			// Read HEAD Segments.
			const length = head.readUInt16BE(0);
			const type = head.readInt8(Frame.LENGTH_BYTES) as Type;

			// Read TAIL Segments.
			let payload: Buffer | undefined;
			const payloadLength = length - Frame.HEAD_BYTES;
			if (payloadLength > 0) {
				if (this.socket.readableLength < payloadLength) {
					// Put the HEAD back into the buffer to read in the next pass since TAIL is not available on the wire.
					this.socket.unshift(head);
					return;
				}

				payload = this.socket.read(payloadLength);
			}

			// Create a new instance of the frame.
			const frame = new Frame(type, payload);

			// Signal frame to the `data` event.
			const push = this.push(frame);

			// Encountered backpressure, reading will be paused.
			if (!push) {
				this[readingPaused] = true;
				return;
			}
		}
	}

	/**
	 * Fired when end is received on the underlying socket.
	 * Ends the readable stream.
	 */
	private onEnd() {
		// Signal `end` event.
		this.push(null);
	}

	//////////////////////////////
	//////// Heartbeat
	//////////////////////////////
	/**
	 * Sends a heartbeat signal to keep the connection alive.
	 *
	 * @param callback callback called after the signal is sent.
	 */
	public heartbeat(callback: (error?: Error | null) => void) {
		let errorCache: Error | null | undefined;

		// Writes empty string into the underlying socket, acts as a heartbeat.
		const write = this.socket.write('', (error?: Error | null) => (errorCache = error));
		if (write) {
			callback(errorCache);
		} else {
			// Encountered backpressure. When the pressure is released send the callback.
			this.socket.once('drain', () => callback(errorCache));
		}
		return this;
	}
}

//////////////////////////////
//////// Incoming
//////////////////////////////
/**
 * `Readable` stream that decodes SCP frames into data.
 *
 * @emits `rfi` when RFI is received.
 */
export class Incoming extends Readable implements IRFI {
	/**
	 * Underlying SCP stream.
	 */
	public readonly scp: Protocol;

	/**
	 * RFI received on the stream.
	 */
	#rfi!: RFI;

	/**
	 * String encoding to apply when decoding `DATA` frames.
	 * If not set, raw Buffers will be returned.
	 */
	#encoding?: BufferEncoding;

	/**
	 * `true` when read buffer is full and calls to `push` return `false`.
	 * Additionally new frame will not be read off underlying SCP stream until the consumer calls `read`.
	 */
	private [readingPaused]: boolean;

	/**
	 * Creates an instance of `Incoming`.
	 *
	 * @param scp underlying SCP stream.
	 */
	constructor(scp: Protocol) {
		super({ objectMode: true });

		// Initialize options.
		this.scp = scp;

		// Initialize variables.
		this[readingPaused] = false;

		// Bind listeners.
		this.onReadable = this.onReadable.bind(this);
		this.onEnd = this.onEnd.bind(this);

		// Add listeners.
		this.scp.addListener('readable', this.onReadable);
		this.scp.addListener('end', this.onEnd);
	}

	//////////////////////////////
	//////// Gets/Sets
	//////////////////////////////
	/**
	 * RFI received on the stream.
	 */
	public get rfi() {
		return this.#rfi;
	}

	public get mode() {
		return this.#rfi.mode;
	}

	public get operation() {
		return this.#rfi.operation;
	}

	public get parameters() {
		return this.#rfi.parameters;
	}

	/**
	 * Gets a parameter value.
	 *
	 * @param key parameter key.
	 */
	public get<K extends keyof Parameters>(key: K) {
		return this.#rfi.get(key);
	}

	/**
	 * Returns `true` if the parameter exists, `false` otherwise.
	 *
	 * @param key parameter key.
	 */
	public has(key: keyof Parameters) {
		return this.#rfi.has(key);
	}

	/**
	 * Returns an array of parameter keys.
	 */
	public keys() {
		return this.#rfi.keys();
	}

	/**
	 * Returns an array of parameter values.
	 */
	public values() {
		return this.#rfi.values();
	}

	/**
	 * Returns an array of key-value pairs of parameters.
	 */
	public entries() {
		return this.#rfi.entries();
	}

	/**
	 * Returns the number of parameters.
	 */
	public get size() {
		return this.#rfi.size;
	}

	/**
	 * Sets the string encoding to apply when decoding `DATA` frames.
	 * If not set, raw Buffers will be returned.
	 *
	 * Note: This does not affect `SIGNAL` frames, which will continue to be emitted as `Signal` objects.
	 *
	 * @param encoding string encoding to apply.
	 */
	public setEncoding(encoding: BufferEncoding) {
		this.#encoding = encoding;
		return this;
	}

	//////////////////////////////
	//////// Readable
	//////////////////////////////
	/**
	 * Implements the readable stream method `_read`.
	 *
	 * WARNING: Should not be called by the consumer.
	 */
	public _read() {
		this[readingPaused] = false;

		// Force trigger `onReadable` to read frame from the underlying SCP stream.
		setImmediate(this.onReadable);
	}

	/**
	 * Implements the readable stream method `_destroy`.
	 * Used when `destroy()` is called to destroy the stream.
	 *
	 * WARNING: Should not be called by the consumer.
	 */
	public _destroy(error: Error | null, callback: (error: Error | null) => void) {
		this.scp.removeListener('readable', this.onReadable);
		this.scp.removeListener('end', this.onEnd);
		callback(error);
	}

	//////////////////////////////
	//////// Read Operations
	//////////////////////////////
	/**
	 * Fired when `readable` event is triggered on the underlying SCP stream.
	 * This is called every time there is a new frame to be read from the underlying SCP stream.
	 */
	private onReadable() {
		while (!this[readingPaused]) {
			const frame: Frame = this.scp.read();
			// Looks like the frame is not ready yet, it's probably finding itself.
			if (!frame) return;

			// This is self explanatory. REALLY!!!
			if (!this.#rfi) {
				if (frame.type === Frame.RFI) {
					this.#rfi = RFI.objectify(frame.payload!.toString());
					this.emit('rfi');
					return;
				}
				continue;
			}

			if (frame.type === Frame.END) {
				// Signal `end` event.
				this.push(null);
				return;
			}

			// Let's see what we've got?
			let chunk!: string | Buffer | Signal;
			if (frame.type === Frame.DATA) {
				if (this.#encoding) {
					chunk = frame.payload?.toString(this.#encoding) ?? '';
				} else {
					chunk = frame.payload ?? Buffer.alloc(0);
				}
			} else if (frame.type === Frame.SIGNAL) {
				chunk = Signal.objectify(frame.payload!.toString());
			}

			// Signal `data` event.
			const push = this.push(chunk);

			// Slow down! Stream needs a break.
			if (!push) {
				this[readingPaused] = true;
				return;
			}
		}
	}

	/**
	 * Fired when end is received on the underlying SCP stream.
	 * Ends the readable stream.
	 */
	private onEnd() {
		// Signal `end` event.
		this.push(null);
	}
}

//////////////////////////////
//////// Outgoing
//////////////////////////////
/**
 * `Writable` stream that encodes stream data into SCP frames.
 */
export class Outgoing extends Writable implements IRFI {
	/**
	 * Underlying SCP stream.
	 */
	public readonly scp: Protocol;

	/**
	 * RFI to send on the stream.
	 */
	#rfi!: RFI;

	/**
	 * `true` if the RFI has been sent, `false` otherwise.
	 */
	private [rifSent]: boolean;

	/**
	 * Creates an instance of `Outgoing`.
	 *
	 * @param scp underlying SCP stream.
	 */
	constructor(scp: Protocol) {
		super({ objectMode: true });

		// Initialize options.
		this.scp = scp;

		// Initialize variables.
		this[rifSent] = false;
	}

	//////////////////////////////
	//////// Gets/Sets
	//////////////////////////////
	/**
	 * RFI to send on the stream.
	 */
	public get rfi() {
		return this.#rfi;
	}

	public get mode() {
		return this.#rfi.mode;
	}

	public get operation() {
		return this.#rfi.operation;
	}

	public get parameters() {
		return this.#rfi.parameters;
	}

	/**
	 * Sets RFI to send on the stream.
	 *
	 * @param mode mode of the remote function.
	 * @param operation operation of the remote function.
	 * @param parameters optional parameters of the remote function.
	 */
	public setRFI(mode: Mode, operation: string, parameters?: Parameters) {
		this.#rfi = new RFI(mode, operation, parameters);
		return this;
	}

	/**
	 * Gets a parameter value.
	 *
	 * @param key parameter key.
	 */
	public get<K extends keyof Parameters>(key: K) {
		return this.#rfi.get(key);
	}

	/**
	 * Returns `true` if the parameter exists, `false` otherwise.
	 *
	 * @param key parameter key.
	 */
	public has(key: keyof Parameters) {
		return this.#rfi.has(key);
	}

	/**
	 * Sets a parameter.
	 *
	 * @param key parameter key.
	 * @param value parameter value.
	 */
	public set<K extends keyof Parameters>(key: K, value: Parameters[K]) {
		this.#rfi.set(key, value);
		return this;
	}

	/**
	 * Removes a parameter.
	 *
	 * @param key parameter key.
	 */
	public delete(key: keyof Parameters) {
		this.#rfi.delete(key);
		return this;
	}

	/**
	 * Returns an array of parameter keys.
	 */
	public keys() {
		return this.#rfi.keys();
	}

	/**
	 * Returns an array of parameter values.
	 */
	public values() {
		return this.#rfi.values();
	}

	/**
	 * Returns an array of key-value pairs of parameters.
	 */
	public entries() {
		return this.#rfi.entries();
	}

	/**
	 * Returns the number of parameters.
	 */
	public get size() {
		return this.#rfi.size;
	}

	//////////////////////////////
	//////// Writable
	//////////////////////////////
	/**
	 * Implements the writable stream method `_write`.
	 * Writes RFI frame on the first pass and payload frames subsequently.
	 *
	 * WARNING: Should not be called by the consumer.
	 */
	public _write(chunk: string | Buffer | Signal, encoding: BufferEncoding, callback: (error?: Error | null) => void) {
		if (!this[rifSent]) {
			if (!this.#rfi) {
				callback(new Error('RFI_NOT_SET'));
				return;
			}

			this.writeRFI(this.#rfi, (error?: Error | null) => {
				if (error) {
					callback(error);
					return;
				}

				this[rifSent] = true;
				this.writePayload(chunk, encoding, callback);
			});
		} else {
			this.writePayload(chunk, encoding, callback);
		}
	}

	/**
	 * Implements the writable stream method `_final`.
	 * If RFI is sent, writes end frame then signal end.
	 * Otherwise signal end directly.
	 *
	 * WARNING: Should not be called by the consumer.
	 */
	public _final(callback: (error?: Error | null) => void) {
		if (this[rifSent]) {
			this.writeEnd(callback);
		} else {
			callback();
		}
	}

	//////////////////////////////
	//////// Write Operations
	//////////////////////////////
	/**
	 * Writes RFI into the underlying SCP stream.
	 *
	 * @param rfi RFI to write.
	 * @param callback callback called when the write operation is complete.
	 */
	private writeRFI(rfi: RFI, callback: (error?: Error | null) => void) {
		const rfiFrame = new Frame(Frame.RFI, Buffer.from(rfi.stringify()));
		this.writeFrame(rfiFrame, callback);
	}

	/**
	 * Writes payload(data/signal) into the underlying SCP stream.
	 *
	 * @param payload payload to write.
	 * @param encoding string encoding to apply when encoding strings into Buffers. If not set, `utf8` will be used by default.
	 * @param callback callback called when the write operation is complete.
	 */
	private writePayload(payload: string | Buffer | Signal, encoding: BufferEncoding, callback: (error?: Error | null) => void) {
		if (typeof payload === 'string') {
			const payloadBuffer = Buffer.from(payload, encoding ?? 'utf8');
			this.writeData(payloadBuffer, 0, Frame.PAYLOAD_BYTES, callback);
		} else if (payload instanceof Buffer) {
			this.writeData(payload, 0, Frame.PAYLOAD_BYTES, callback);
		} else if (payload instanceof Signal) {
			this.writeSignal(payload, callback);
		}
	}

	/**
	 * Writes data into the underlying SCP stream.
	 *
	 * @param data data to write.
	 * @param startHead start head.
	 * @param endHead end head.
	 * @param callback callback called when the write operation is complete.
	 */
	private writeData(data: Buffer, startHead: number, endHead: number, callback: (error?: Error | null) => void) {
		const dataFrame = new Frame(Frame.DATA, data.subarray(startHead, endHead));
		this.writeFrame(dataFrame, (error?: Error | null) => {
			if (error) {
				callback(error);
				return;
			}

			if (endHead < data.length) {
				// Update head for the next write.
				startHead = endHead;
				endHead += Frame.PAYLOAD_BYTES;

				this.writeData(data, startHead, endHead, callback);
			} else {
				callback();
			}
		});
	}

	/**
	 * Writes signal into the underlying SCP stream.
	 *
	 * @param signal signal to write.
	 * @param callback callback called when the write operation is complete.
	 */
	private writeSignal(signal: Signal, callback: (error?: Error | null) => void) {
		const signalFrame = new Frame(Frame.SIGNAL, Buffer.from(signal.stringify()));
		this.writeFrame(signalFrame, callback);
	}

	/**
	 * Writes end into the underlying SCP stream.
	 *
	 * @param callback callback called when the write operation is complete.
	 */
	private writeEnd(callback: (error?: Error | null) => void) {
		const endFrame = new Frame(Frame.END);
		this.writeFrame(endFrame, callback);
	}

	//////////////////////////////
	//////// Write Frame
	//////////////////////////////
	/**
	 * Writes frame into the underlying SCP stream.
	 *
	 * @param frame frame to write.
	 * @param callback callback called when the write operation is complete.
	 */
	private writeFrame(frame: Frame, callback: (error?: Error | null) => void) {
		/**
		 * Cache the error and return when `callback` is ready.
		 */
		let errorCache: Error | null | undefined;

		// Write the frame into the underlying SCP stream.
		const write = this.scp.write(frame, (error?: Error | null) => (errorCache = error));
		if (write) {
			callback(errorCache);
		} else {
			// Encountered some backpressure, waiting for chiropractor to release the pressure.
			this.scp.once('drain', () => callback(errorCache));
		}
	}
}
