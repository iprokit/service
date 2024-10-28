//////////////////////////////
//////// Mode
//////////////////////////////
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