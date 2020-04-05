/**
 * The default variables for the `Service`.
 */
export default class Default {
    /**
     * The default environment of the service.
     * 
     * @default `production`
     */
    public static readonly ENVIRONMENT: string = 'production';

    /**
     * The default API server port of the service.
     * 
     * @default 3000
     */
    public static readonly API_PORT: number = 3000;

    /**
     * The default STSCP server port of the service.
     * 
     * @default 6000
     */
    public static readonly STSCP_PORT: number = 6000;

    /**
     * The default time to wait before the service is forcefully stopped when `service.stop()`is called.
     * 
     * @default 1000 * 5
     */
    public static readonly FORCE_STOP_TIME: number = 1000 * 5;
}