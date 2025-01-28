/**
 * `RFI` stands for Remote Function Identifier.
 * It is represented as a case-sensitive string.
 *
 * Example: `SYNC:Hero.get#ONE=A&TWO=B`
 *
 * An RFI consists of a mode, operation, and parameters:
 *  - Mode: `SYNC`
 *  - Operation: `Hero.get`
 *  - Parameters: `ONE=A&TWO=B`
 */
export default class RFI implements IRFI {
	public readonly mode: Mode;
	public readonly operation: string;
	public readonly parameters: Parameters;

	/**
	 * Creates an instance of `RFI`.
	 *
	 * @param mode mode of the remote function.
	 * @param operation operation of the remote function.
	 * @param parameters optional parameters of the remote function.
	 */
	constructor(mode: Mode, operation: string, parameters?: Parameters) {
		this.mode = mode;
		this.operation = operation;
		this.parameters = parameters ?? {};
	}

	//////////////////////////////
	//////// Gets/Sets
	//////////////////////////////
	/**
	 * Gets a parameter value.
	 *
	 * @param key parameter key.
	 */
	public get<K extends keyof Parameters>(key: K) {
		return this.parameters[key];
	}

	/**
	 * Returns `true` if the parameter exists, `false` otherwise.
	 *
	 * @param key parameter key.
	 */
	public has(key: keyof Parameters) {
		return key in this.parameters;
	}

	/**
	 * Sets a parameter.
	 *
	 * @param key parameter key.
	 * @param value parameter value.
	 */
	public set<K extends keyof Parameters>(key: K, value: Parameters[K]) {
		this.parameters[key] = value;
		return this;
	}

	/**
	 * Removes a parameter.
	 *
	 * @param key parameter key.
	 */
	public delete(key: keyof Parameters) {
		delete this.parameters[key];
		return this;
	}

	/**
	 * Returns an array of parameter keys.
	 */
	public keys() {
		return Object.keys(this.parameters);
	}

	/**
	 * Returns an array of parameter values.
	 */
	public values() {
		return Object.values(this.parameters);
	}

	/**
	 * Returns an array of key-value pairs of parameters.
	 */
	public entries() {
		return Object.entries(this.parameters);
	}

	/**
	 * Returns the number of parameters.
	 */
	public get size() {
		return this.keys().length;
	}

	//////////////////////////////
	//////// To/From Helpers
	//////////////////////////////
	/**
	 * Returns the stringified version of the `RFI`.
	 */
	public stringify() {
		// Combine parameters as a string.
		const _parameters = this.entries()
			.map(([key, value]) => key + RFI.PARAMETER_DELIMITER + value)
			.join(RFI.PARAMETERS_DELIMITER);
		const parameters = _parameters ? RFI.OPERATION_DELIMITER + _parameters : '';

		// Return the combined mode, operation, and parameters as a string.
		return this.mode + RFI.MODE_DELIMITER + this.operation + parameters;
	}

	/**
	 * Returns the objectified version of an `RFI`.
	 *
	 * @param rfi stringified version of an `RFI`.
	 */
	public static objectify(rfi: string) {
		// Deconstruct mode, operation, and parameters from the string.
		const [mode, _rfi] = rfi.split(RFI.MODE_DELIMITER) as [Mode, string];
		const [operation, _parameters] = _rfi.split(RFI.OPERATION_DELIMITER);
		const parameters = _parameters ? Object.fromEntries(_parameters.split(RFI.PARAMETERS_DELIMITER).map((parameter) => parameter.split(RFI.PARAMETER_DELIMITER) as [string, string])) : {};

		// Return a new RFI as an object.
		return new RFI(mode, operation, parameters);
	}

	//////////////////////////////
	//////// Delimiter Definitions
	//////////////////////////////
	/**
	 * Delimiter for mode, denoted by `:`.
	 *
	 * @example `mode:operation`
	 */
	public static readonly MODE_DELIMITER = ':';

	/**
	 * Delimiter for operation, denoted by `#`.
	 *
	 * @example `operation#parameters`
	 */
	public static readonly OPERATION_DELIMITER = '#';

	/**
	 * Delimiter for parameters, denoted by `&`.
	 *
	 * @example `param1&param2`
	 */
	public static readonly PARAMETERS_DELIMITER = '&';

	/**
	 * Delimiter for a key-value pair, denoted by `=`.
	 *
	 * @example `key=value`
	 */
	public static readonly PARAMETER_DELIMITER = '=';
}

//////////////////////////////
//////// IRFI
//////////////////////////////
/**
 * Interface for `RFI`.
 */
export interface IRFI {
	/**
	 * Mode of the remote function.
	 */
	mode: string;

	/**
	 * Operation of the remote function.
	 */
	operation: string;

	/**
	 * Parameters of the remote function.
	 */
	parameters?: Parameters;
}

//////////////////////////////
//////// Mode
//////////////////////////////
/**
 * Mode definitions for an `RFI`.
 */
export type Mode = 'SUBSCRIBE' | 'BROADCAST' | 'REPLY' | 'CONDUCTOR' | 'OMNI';

//////////////////////////////
//////// Parameters
//////////////////////////////
/**
 * Parameters associated with an `RFI`.
 */
export interface Parameters {
	[key: string]: string | undefined;

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
