/**
 * @iProKit/Service
 * Copyright (c) 2019-2025 Rutvik Katuri / iProTechs
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Signal is used for multi-stage communication.
 * It is represented as a case-sensitive string.
 *
 * Example: `NEXT%ONE=A&TWO=B`
 *
 * A Signal consists of an event name and tags:
 *  - Event: `NEXT`
 *  - Tags: `ONE=A&TWO=B`
 */
export default class Signal {
	/**
	 * Event name of the signal.
	 */
	public readonly event: string;

	/**
	 * Tags of the signal.
	 */
	public readonly tags: Tags;

	/**
	 * Creates an instance of `Signal`.
	 *
	 * @param event name of the signal.
	 * @param tags optional tags of the signal.
	 */
	constructor(event: string, tags?: Tags) {
		this.event = event;
		this.tags = tags ?? {};
	}

	//////////////////////////////
	//////// Gets/Sets
	//////////////////////////////
	/**
	 * Gets a tag value.
	 *
	 * @param key tag key.
	 */
	public get(key: string) {
		return this.tags[key];
	}

	/**
	 * Returns `true` if the tag exists, `false` otherwise.
	 *
	 * @param key tag key.
	 */
	public has(key: string) {
		return key in this.tags;
	}

	/**
	 * Sets a tag.
	 *
	 * @param key tag key.
	 * @param value tag value.
	 */
	public set(key: string, value: string) {
		this.tags[key] = value;
		return this;
	}

	/**
	 * Removes a tag.
	 *
	 * @param key tag key.
	 */
	public delete(key: string) {
		delete this.tags[key];
		return this;
	}

	/**
	 * Returns an array of tag keys.
	 */
	public keys() {
		return Object.keys(this.tags);
	}

	/**
	 * Returns an array of tag values.
	 */
	public values() {
		return Object.values(this.tags);
	}

	/**
	 * Returns an array of key-value pairs of tags.
	 */
	public entries() {
		return Object.entries(this.tags);
	}

	/**
	 * Returns the number of tags.
	 */
	public get size() {
		return this.keys().length;
	}

	//////////////////////////////
	//////// To/From Helpers
	//////////////////////////////
	/**
	 * Returns the stringified version of the `Signal`.
	 */
	public stringify() {
		// Combine tags as a string.
		const _tags = this.entries()
			.map(([key, value]) => key + Signal.TAG_DELIMITER + value)
			.join(Signal.TAGS_DELIMITER);
		const tags = _tags ? Signal.EVENT_DELIMITER + _tags : '';

		// Return the combined event and tags as a string.
		return this.event + tags;
	}

	/**
	 * Returns the objectified version of a `Signal`.
	 *
	 * @param signal stringified version of a `Signal`.
	 */
	public static objectify(signal: string) {
		// Deconstruct event and tags from the string.
		const [event, _tags] = signal.split(Signal.EVENT_DELIMITER);
		const tags = _tags ? Object.fromEntries(_tags.split(Signal.TAGS_DELIMITER).map((tag) => tag.split(Signal.TAG_DELIMITER) as [string, string])) : {};

		// Return a new Signal as an object.
		return new Signal(event, tags);
	}

	//////////////////////////////
	//////// Delimiter Definitions
	//////////////////////////////
	/**
	 * Delimiter for the event, denoted by `%`.
	 *
	 * @example `event%tags`
	 */
	public static readonly EVENT_DELIMITER: string = '%';

	/**
	 * Delimiter for tags, denoted by `&`.
	 *
	 * @example `tag1&tag2`
	 */
	public static readonly TAGS_DELIMITER: string = '&';

	/**
	 * Delimiter for a key-value pair, denoted by `=`.
	 *
	 * @example `key=value`
	 */
	public static readonly TAG_DELIMITER: string = '=';
}

//////////////////////////////
//////// Tags
//////////////////////////////
/**
 * Tags associated with a `Signal`.
 */
export interface Tags {
	[key: string]: string | undefined;
}
