// Import @iprolab Libs.
import SCP, { Parameters as ScpParameters, Tags as ScpTags } from '@iprolab/scp';

//////////////////////////////
//////// RFI
//////////////////////////////
export class RFI extends SCP.RFI {
    public declare readonly mode: ModeType;
    public declare readonly parameters: Parameters;

    constructor(mode: ModeType, operation: string, parameters?: Parameters) {
        super(mode, operation, parameters);
    }
}

export namespace Mode {
    /**
     * SCP SUBSCRIBE mode.
     */
    export const SUBSCRIBE = 'SUBSCRIBE' as const;

    /**
     * SCP OMNI mode.
     */
    export const OMNI = 'OMNI' as const;

    /**
     * SCP BROADCAST mode.
     */
    export const BROADCAST = 'BROADCAST' as const;
}

export type ModeType = typeof Mode[keyof typeof Mode];

export interface Parameters extends ScpParameters {
    'CID'?: string;
    'SID'?: string;
    'FORMAT'?: 'OBJECT';
    'STATUS'?: 'OK' | 'ERROR';
}

//////////////////////////////
//////// Signal
//////////////////////////////
export class Signal extends SCP.Signal {
    public declare readonly tags: Tags;

    constructor(event: string, tags?: Tags) {
        super(event, tags);
    }
}

export interface Tags extends ScpTags { }