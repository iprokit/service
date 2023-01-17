//Import Libs.
import crypto from 'crypto';

/**
 * The static helper class.
 */
export default class Helper {
    //////////////////////////////
    //////Generate
    //////////////////////////////
    /**
     * Generates a new ID.
     * 
     * @returns the generated ID.
     */
    public static generateID() {
        const bytes = crypto.randomBytes(10).toString('hex');
        const slider = (max: number) => {
            return Math.floor(Math.random() * Math.floor(max));
        }

        const _r = slider(bytes.length / 2);
        const length = 5;
        return bytes.slice(_r, _r + length);
    }

    /**
     * Generates a new RFID.
     * 
     * @returns the generated RFID.
     */
    public static generateRFID() {
        return new Date().getTime().toString(26) + '-' + Math.random().toString(36).slice(2) + '-' + crypto.randomBytes(10).toString('hex');
    }
}