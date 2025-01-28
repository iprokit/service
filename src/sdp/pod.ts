/**
 * Pod is a communication unit used during multicasting
 * and represents a network entity.
 * It is case-sensitive and formatted as a string.
 *
 * Example: `ID*true$ONE=1&TWO=2`
 *
 * A Pod consists of an identifier, availability, and attributes:
 *  - Identifier: `ID` (Unique identifier)
 *  - Available: `true`/`false`
 *  - Attributes: `ONE=1&TWO=1`
 */
export default class Pod {
	/**
	 * Unique identifier of the pod.
	 */
	public readonly identifier: string;

	/**
	 * `true` if the pod is available, `false` otherwise.
	 */
	public available: boolean;

	/**
	 * Attributes of the pod.
	 */
	public attributes: Attributes;

	/**
	 * Creates an instance of `Pod`.
	 *
	 * @param identifier unique identifier of the pod.
	 * @param available set to `true` if the pod is available, `false` otherwise.
	 * @param attributes optional attributes of the pod.
	 */
	constructor(identifier: string, available: boolean, attributes?: Attributes) {
		this.identifier = identifier;
		this.available = available;
		this.attributes = attributes ?? {};
	}

	//////////////////////////////
	//////// Gets/Sets
	//////////////////////////////
	/**
	 * Gets an attribute value.
	 *
	 * @param key attribute key.
	 */
	public get(key: string) {
		return this.attributes[key];
	}

	/**
	 * Returns `true` if the attribute exists, `false` otherwise.
	 *
	 * @param key attribute key.
	 */
	public has(key: string) {
		return key in this.attributes;
	}

	/**
	 * Sets an attribute.
	 *
	 * @param key attribute key.
	 * @param value attribute value.
	 */
	public set(key: string, value: string) {
		this.attributes[key] = value;
		return this;
	}

	/**
	 * Removes an attribute.
	 *
	 * @param key attribute key.
	 */
	public delete(key: string) {
		delete this.attributes[key];
		return this;
	}

	/**
	 * Returns an array of attribute keys.
	 */
	public keys() {
		return Object.keys(this.attributes);
	}

	/**
	 * Returns an array of attribute values.
	 */
	public values() {
		return Object.values(this.attributes);
	}

	/**
	 * Returns an array of key-value pairs of attributes.
	 */
	public entries() {
		return Object.entries(this.attributes);
	}

	/**
	 * Returns the number of attributes.
	 */
	public get size() {
		return this.keys().length;
	}

	//////////////////////////////
	//////// To/From Helpers
	//////////////////////////////
	/**
	 * Returns the stringified version of the `Pod`.
	 */
	public stringify() {
		// Combine attributes as a string.
		const _attributes = this.entries()
			.map(([key, value]) => key + Pod.ATTRIBUTE_DELIMITER + value)
			.join(Pod.ATTRIBUTES_DELIMITER);
		const attributes = _attributes ? Pod.AVAILABLE_DELIMITER + _attributes : '';

		// Return combined identifier, availability, and attributes as a string.
		return this.identifier + Pod.IDENTIFIER_DELIMITER + this.available + attributes;
	}

	/**
	 * Returns the objectified version of a `Pod`.
	 *
	 * @param pod stringified version of a `Pod`.
	 */
	public static objectify(pod: string) {
		// Deconstruct identifier, availability, and attributes from the string.
		const [identifier, _pod] = pod.split(Pod.IDENTIFIER_DELIMITER);
		const [_available, _attributes] = _pod.split(Pod.AVAILABLE_DELIMITER);
		const available = _available === 'true' ? true : false;
		const attributes = _attributes ? Object.fromEntries(_attributes.split(Pod.ATTRIBUTES_DELIMITER).map((attribute) => attribute.split(Pod.ATTRIBUTE_DELIMITER) as [string, string])) : {};

		// Return new Pod as an object.
		return new Pod(identifier, available, attributes);
	}

	//////////////////////////////
	//////// Delimiter Definitions
	//////////////////////////////
	/**
	 * Delimiter for identifier, denoted by `*`.
	 *
	 * @example `identifier*available`
	 */
	public static readonly IDENTIFIER_DELIMITER = '*';

	/**
	 * Delimiter for availability, denoted by `$`.
	 *
	 * @example `available$attributes`
	 */
	public static readonly AVAILABLE_DELIMITER = '$';

	/**
	 * Delimiter for attributes, denoted by `&`.
	 *
	 * @example `attribute1&attribute2`
	 */
	public static readonly ATTRIBUTES_DELIMITER = '&';

	/**
	 * Delimiter for a key-value pair, denoted by `=`.
	 *
	 * @example `key=value`
	 */
	public static readonly ATTRIBUTE_DELIMITER = '=';
}

//////////////////////////////
//////// Attributes
//////////////////////////////
/**
 * Attributes associated with a `Pod`.
 */
export interface Attributes {
	[key: string]: string | undefined;
}
