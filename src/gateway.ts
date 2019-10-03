//Import modules
import expressProxy from 'express-http-proxy';

//Local Imports
import MicroService, { AutoInjectControllerOptions, CommOptions } from "./microservice";
import { DBInitOptions } from "./db.manager";

//Types: MicroServiceInitOptions
export type GatewayInitOptions = {
    version?: string,
    db?: DBInitOptions,
    autoInjectControllers?: AutoInjectControllerOptions,
    comm?: CommOptions
}

export default class Gateway extends MicroService {
    //Options
    private readonly expressPort: Number = global.service.expressPort;

    //Default Constructor
    public constructor(options?: GatewayInitOptions) {
        super({
            name: 'gateway',
            version: options.version,
            url: '/api',
            db: options.db,
            autoInjectControllers: options.autoInjectControllers,
            comm: options.comm
        });
    }

    /////////////////////////
    ///////Proxy Functions
    /////////////////////////
    public proxy(host: string){
        return expressProxy(this.resolveHost(host));
    }

    public proxyRedirect(host: string, redirect: string){
        return expressProxy(this.resolveHost(host), {
            proxyReqPathResolver: (request) => {
                return redirect;
            }
        });
    }

    /////////////////////////
    ///////Other Functions
    /////////////////////////
    private resolveHost(host: string){
        //Split url into host and port.
        const _url = host.split(':');
        const _host = _url[0];
        const _port = Number(_url[1]) || this.expressPort;

        //New URL
        return _host + ':' + _port;
    }
}