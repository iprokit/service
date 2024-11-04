// Import @iprolab Libs.
import SCP, { Parameters as ScpParameters } from '@iprolab/scp';

//////////////////////////////
//////// RFI
//////////////////////////////
export class RFI extends SCP.RFI {
    public declare readonly mode: Mode;
    public declare readonly parameters: Parameters;

    constructor(mode: Mode, operation: string, parameters?: Parameters) {
        super(mode, operation, parameters);
    }
}

export type Mode = 'SUBSCRIBE' | 'OMNI' | 'BROADCAST';

export interface Parameters extends ScpParameters {
    'CID'?: string;
    'SID'?: string;
    'FORMAT'?: 'OBJECT';
    'CONDUCTOR'?: 'TRUE';
    'STATUS'?: 'OK' | 'ERROR';
}

//////////////////////////////
//////// Incoming/Outgoing
//////////////////////////////
export interface Incoming extends InstanceType<typeof SCP.Incoming> {
    rfi: RFI;
    mode: Mode;
    parameters: Parameters;
    get<K extends keyof Parameters>(key: K): Parameters[K];
    has(key: keyof Parameters): boolean;
}

export interface Outgoing extends InstanceType<typeof SCP.Outgoing> {
    rfi: RFI;
    mode: Mode;
    parameters: Parameters;
    get<K extends keyof Parameters>(key: K): Parameters[K];
    has(key: keyof Parameters): boolean;
    set<K extends keyof Parameters>(key: K, value: Parameters[K]): this;
    delete(key: keyof Parameters): this;
}