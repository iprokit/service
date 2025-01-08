// Import @iprolab Libs.
import scp, { Parameters as ScpParameters } from '@iprolab/scp';

//////////////////////////////
//////// RFI
//////////////////////////////
export class RFI extends scp.RFI {
	declare public readonly mode: Mode;
	declare public readonly parameters: Parameters;

	constructor(mode: Mode, operation: string, parameters?: Parameters) {
		super(mode, operation, parameters);
	}
}

export type Mode = 'SUBSCRIBE' | 'BROADCAST' | 'REPLY' | 'CONDUCTOR' | 'OMNI';

export interface Parameters extends ScpParameters {
	/**
	 * Unique identifier of the client.
	 */
	CID?: string;

	/**
	 * Unique identifier of the server.
	 */
	SID?: string;

	/**
	 * Status of the function execution.
	 */
	STATUS?: 'OK' | 'ERROR';
}

//////////////////////////////
//////// Incoming/Outgoing
//////////////////////////////
export interface Incoming extends InstanceType<typeof scp.Incoming> {
	rfi: RFI;
	mode: Mode;
	parameters: Parameters;
	get<K extends keyof Parameters>(key: K): Parameters[K];
	has(key: keyof Parameters): boolean;
}

export interface Outgoing extends InstanceType<typeof scp.Outgoing> {
	rfi: RFI;
	mode: Mode;
	parameters: Parameters;
	get<K extends keyof Parameters>(key: K): Parameters[K];
	has(key: keyof Parameters): boolean;
	set<K extends keyof Parameters>(key: K, value: Parameters[K]): this;
	delete(key: keyof Parameters): this;
}
