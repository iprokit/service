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

		// Create a new frame buffer.
		const frameBuffer = Buffer.allocUnsafe(frame.length);

		/**
		 * Start head at 0.
		 * After each segment increment the number with the number of bytes written.
		 */
		let writeHead = 0;

		// Write HEAD Segments.
		frameBuffer.writeUInt16BE(frame.length, writeHead);
		writeHead += Frame.LENGTH_BYTES;

		frameBuffer.writeInt8(frame.type, writeHead);
		writeHead += Frame.TYPE_BYTES;

		// Write TAIL Segments if any.
		frame.payload && frameBuffer.write(frame.payload, writeHead);

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
			const lengthBuffer: Buffer = this.socket.read(Frame.LENGTH_BYTES);
			// Looks like the length buffer is empty. oops!!!
			if (!lengthBuffer) return;

			// Read HEAD Segment 1.
			const length: number = lengthBuffer.readUInt16BE();

			/**
			 * Validate if enough data is available on the wire.
			 * If not put the data back into the buffer with unshift to read in the next pass.
			 */
			const readHead = length - Frame.LENGTH_BYTES;
			if (this.socket.readableLength < readHead) {
				this.socket.unshift(lengthBuffer);
				return;
			}

			// Read HEAD Segment 2.
			const type: Type = this.socket.read(Frame.TYPE_BYTES).readInt8();

			// Read TAIL Segments if any.
			let payload: string | undefined;
			if (length > Frame.HEAD_BYTES) {
				const payloadLength = length - Frame.HEAD_BYTES;
				payload = this.socket.read(payloadLength).toString();
			}

			// Create a new instance of the frame.
			const frame = new Frame(length, type, payload);

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
				if (frame.isRFI()) {
					this.#rfi = RFI.objectify(frame.payload!);
					this.emit('rfi');
					return;
				}
				continue;
			}

			if (frame.isEnd()) {
				// Signal `end` event.
				this.push(null);
				return;
			}

			// Let's see what we've got?
			let chunk!: string | Signal;
			if (frame.isSignal()) {
				chunk = Signal.objectify(frame.payload!);
			} else if (frame.isData()) {
				chunk = frame.payload !== undefined ? frame.payload : '';
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
	public _write(chunk: string | Signal, encoding: BufferEncoding, callback: (error?: Error | null) => void) {
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
				this.writePayload(chunk, callback);
			});
		} else {
			this.writePayload(chunk, callback);
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
		const rfiFrame = Frame.createRFI(rfi.stringify());
		this.writeFrame(rfiFrame, callback);
	}

	/**
	 * Writes payload(data/signal) into the underlying SCP stream.
	 *
	 * @param payload payload to write.
	 * @param callback callback called when the write operation is complete.
	 */
	private writePayload(payload: string | Signal, callback: (error?: Error | null) => void) {
		if (typeof payload === 'string') {
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
	private writeData(data: string, startHead: number, endHead: number, callback: (error?: Error | null) => void) {
		const dataFrame = Frame.createData(data.slice(startHead, endHead));
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
		const signalFrame = Frame.createSignal(signal.stringify());
		this.writeFrame(signalFrame, callback);
	}

	/**
	 * Writes end into the underlying SCP stream.
	 *
	 * @param callback callback called when the write operation is complete.
	 */
	private writeEnd(callback: (error?: Error | null) => void) {
		const endFrame = Frame.createEnd();
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
