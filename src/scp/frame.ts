/**
 * SCP frames implement a stream-based frame delivery system.
 *
 * A frame consists of 3 segments: Length, Type, and Payload.
 * - HEAD:
 *  - Length: Byte length of the frame, using 2 unsigned 16-bit bytes.
 *  - Type: Frame type, using 1 int 8-bit byte.
 * - TAIL:
 *  - Payload: Optional frame payload, using P raw bytes.
 */
export default class Frame {
	/**
	 * Type of the frame.
	 */
	public readonly type: Type;

	/**
	 * Payload of the frame.
	 */
	public readonly payload?: Buffer;

	/**
	 * Creates an instance of `Frame`.
	 *
	 * @param type type of the frame.
	 * @param payload optional payload of the frame.
	 */
	constructor(type: Type, payload?: Buffer) {
		this.type = type;
		this.payload = payload;
	}

	//////////////////////////////
	//////// Gets/Sets
	//////////////////////////////
	/**
	 * Byte length of the frame.
	 */
	public get length() {
		return Frame.HEAD_BYTES + (this.payload?.length ?? 0);
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
