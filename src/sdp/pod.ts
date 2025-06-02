/**
 * @iProKit/Service
 * Copyright (c) 2019-2025 Rutvik Katuri / iProTechs
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Pod is a communication unit used during multicasting
 * and represents a network entity.
 * It is case-sensitive and formatted as a string.
 *
 * Example: `ID*A0001$ONE=1&TWO=2`
 *
 * A Pod consists of an identifier, session, and attributes:
 *  - Identifier: `ID` (Unique identifier)
 *  - Session: `A0001` (Session token)
 *  - Attributes: `ONE=1&TWO=2`
 */
export default class Pod {
	/**
	 * Unique identifier of the pod.
	 */
	public readonly identifier: string;

	/**
	 * Session token of the pod.
	 */
	public session: string;

	/**
	 * Attributes of the pod.
	 */
	public readonly attributes: Attributes;

	/**
	 * Creates an instance of `Pod`.
	 *
	 * @param identifier unique identifier of the pod.
	 * @param session optional session token of the pod.
	 * @param attributes optional attributes of the pod.
	 */
	constructor(identifier: string, session: string, attributes?: Attributes) {
		this.identifier = identifier;
		this.session = session;
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
		const attributes = _attributes ? Pod.SESSION_DELIMITER + _attributes : '';

		// Return combined identifier, session, and attributes as a string.
		return this.identifier + Pod.IDENTIFIER_DELIMITER + this.session + attributes;
	}

	/**
	 * Returns the objectified version of a `Pod`.
	 *
	 * @param pod stringified version of a `Pod`.
	 */
	public static objectify(pod: string) {
		// Deconstruct identifier, session, and attributes from the string.
		const [identifier, _pod] = pod.split(Pod.IDENTIFIER_DELIMITER);
		const [session, _attributes] = _pod.split(Pod.SESSION_DELIMITER);
		const attributes = _attributes ? Object.fromEntries(_attributes.split(Pod.ATTRIBUTES_DELIMITER).map((attribute) => attribute.split(Pod.ATTRIBUTE_DELIMITER) as [string, string])) : {};

		// Return new Pod as an object.
		return new Pod(identifier, session, attributes);
	}

	//////////////////////////////
	//////// Delimiter Definitions
	//////////////////////////////
	/**
	 * Delimiter for identifier, denoted by `*`.
	 *
	 * @example `identifier*session`
	 */
	public static readonly IDENTIFIER_DELIMITER = '*';

	/**
	 * Delimiter for session, denoted by `$`.
	 *
	 * @example `session$attributes`
	 */
	public static readonly SESSION_DELIMITER = '$';

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
