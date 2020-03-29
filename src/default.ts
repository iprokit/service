/**
 * The default variables for the `Service`.
 */
export default class Default {
    /**
     * The environment of the service.
     * 
     * @constant `production`
     */
    public static readonly ENVIRONMENT: string = 'production';

    /**
     * The API Server port of the service.
     * 
     * @constant 3000
     */
    public static readonly API_PORT: number = 3000;

    /**
     * The STSCP Server port of the service.
     * 
     * @constant 6000
     */
    public static readonly STSCP_PORT: number = 6000;

    /**
     * The time to wait before the service is forcefully stopped when `service.stop()`is called.
     * 
     * @constant 1000 * 5
     */
    public static readonly FORCE_STOP_TIME: number = 1000 * 5;
}