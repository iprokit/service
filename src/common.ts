//Import Libs.
import { networkInterfaces } from 'os';
import { randomBytes } from 'crypto';

/**
 * Returns the first active IPv4 address reported by the Operating System.
 */
export function localAddress() {
    const interfaces = networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        const activeInterface = interfaces[name].find(activeInterface => activeInterface.family === 'IPv4' && !activeInterface.internal);
        if (activeInterface)
            return activeInterface.address;
    }
    return undefined; // No active IPv4 address found.
}

/**
 * Generates a new ID.
 * 
 * @returns the generated ID.
 */
export function generateID() {
    const bytes = randomBytes(10).toString('hex');
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
export function generateRFID() {
    return new Date().getTime().toString(26) + '-' + Math.random().toString(36).slice(2) + '-' + randomBytes(10).toString('hex');
}

/**
 * The next function.
 */
export type NextFunction = () => void;