/**
 * SCP frames implement a stream-based frame delivery system.
 *
 * A frame consists of 3 segments: Length, Type, and Payload.
 * - HEAD:
 *  - Length: Byte length of the frame, using 2 unsigned 16-bit bytes.
 *  - Type: Frame type, using 1 int 8-bit byte.
 * - TAIL:
 *  - Payload: Optional frame payload, using P string bytes.
 */
export default class Frame {
	/**
	 * Byte length of the frame.
	 */
	public readonly length: number;

	/**
	 * Type of the frame.
	 */
	public readonly type: Type;

	/**
	 * Payload of the frame.
	 */
	public readonly payload?: string;

	/**
	 * Creates an instance of `Frame`.
	 *
	 * @param length byte length of the frame.
	 * @param type type of the frame.
	 * @param payload optional payload of the frame.
	 */
	constructor(length: number, type: Type, payload?: string) {
		this.length = length;
		this.type = type;
		this.payload = payload;
	}

	//////////////////////////////
	//////// Creation Helpers
	//////////////////////////////
	/**
	 * Creates an RFI `Frame`.
	 *
	 * @param rfi RFI of the frame.
	 */
	public static createRFI(rfi: string) {
		let length = Frame.HEAD_BYTES + Buffer.byteLength(rfi);
		return new Frame(length, Frame.RFI, rfi);
	}

	/**
	 * Creates a data `Frame`.
	 *
	 * @param data optional data of the frame.
	 */
	public static createData(data?: string) {
		let length = Frame.HEAD_BYTES;
		if (data) {
			length += Buffer.byteLength(data);
		}
		return new Frame(length, Frame.DATA, data);
	}

	/**
	 * Creates a signal `Frame`.
	 *
	 * @param signal signal of the frame.
	 */
	public static createSignal(signal: string) {
		let length = Frame.HEAD_BYTES + Buffer.byteLength(signal);
		return new Frame(length, Frame.SIGNAL, signal);
	}

	/**
	 * Creates an end `Frame`.
	 */
	public static createEnd() {
		let length = Frame.HEAD_BYTES;
		return new Frame(length, Frame.END);
	}

	//////////////////////////////
	//////// Validations
	//////////////////////////////
	/**
	 * Returns `true` if this is an RFI frame, `false` otherwise.
	 */
	public isRFI() {
		return this.type === Frame.RFI ? true : false;
	}

	/**
	 * Returns `true` if this is a data frame, `false` otherwise.
	 */
	public isData() {
		return this.type === Frame.DATA ? true : false;
	}

	/**
	 * Returns `true` if this is a signal frame, `false` otherwise.
	 */
	public isSignal() {
		return this.type === Frame.SIGNAL ? true : false;
	}

	/**
	 * Returns `true` if this is an end frame, `false` otherwise.
	 */
	public isEnd() {
		return this.type === Frame.END ? true : false;
	}

	//////////////////////////////
	//////// Type Definitions
	//////////////////////////////
	/**
	 * Indicates RFI frame.
	 */
	public static readonly RFI = 1;

	/**
	 * Indicates data frame.
	 */
	public static readonly DATA = 2;

	/**
	 * Indicates signal frame.
	 */
	public static readonly SIGNAL = 3;

	/**
	 * Indicates end frame.
	 */
	public static readonly END = 4;

	//////////////////////////////
	//////// Segment Definitions
	//////////////////////////////
	/**
	 * Total frame size in bytes.
	 */
	public static readonly FRAME_BYTES = 16384;

	/**
	 * Size of length segment in bytes.
	 */
	public static readonly LENGTH_BYTES = 2;

	/**
	 * Size of type segment in bytes.
	 */
	public static readonly TYPE_BYTES = 1;

	/**
	 * Total head size in bytes.
	 */
	public static readonly HEAD_BYTES = Frame.LENGTH_BYTES + Frame.TYPE_BYTES;

	/**
	 * Size of payload segment in bytes.
	 */
	public static readonly PAYLOAD_BYTES = Frame.FRAME_BYTES - Frame.HEAD_BYTES;
}

//////////////////////////////
//////// Type
//////////////////////////////
/**
 * Type definitions for a `Frame`.
 */
export type Type = Pick<typeof Frame, 'RFI' | 'DATA' | 'SIGNAL' | 'END'>[keyof Pick<typeof Frame, 'RFI' | 'DATA' | 'SIGNAL' | 'END'>];
