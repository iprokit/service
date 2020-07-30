/**
 * The default variables for the `Service`.
 */
export default class Default {
    /**
     * The default version of the service.
     * 
     * @default `1.0.0`
     */
    public static readonly VERSION: string = '1.0.0';

    /**
     * The default environment of the service.
     * 
     * @default `production`
     */
    public static readonly ENVIRONMENT: string = 'production';

    /**
     * The default HTTP server port of the service.
     * 
     * @default 3000
     */
    public static readonly HTTP_PORT: number = 3000;

    /**
     * The default SCP server port of the service.
     * 
     * @default 6000
     */
    public static readonly SCP_PORT: number = 6000;

    /**
     * The default discovery port of the service.
     * 
     * @default 5000
     */
    public static readonly DISCOVERY_PORT: number = 5000;

    /**
     * The default IP address of discovery, i.e the multicast address.
     * 
     * @default `224.0.0.1`
     */
    public static readonly DISCOVERY_IP: string = '224.0.0.1';

    /**
     * The default time to wait before the service is forcefully stopped when `service.stop()`is called.
     * 
     * @default 1000 * 5
     */
    public static readonly FORCE_STOP_TIME: number = 1000 * 5;

    /**
     * The default path to log files of the service.
     * 
     * @default '/logs'
     */
    public static readonly LOG_PATH: string = '/logs';
}