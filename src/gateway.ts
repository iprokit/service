//Import modules
import expressProxy from 'express-http-proxy';
import { RequestOptions } from 'https';

//Local Imports
import GatewayUtility from './gateway.utility';
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
        return expressProxy(GatewayUtility.resolveHost(host, this.expressPort), {
            proxyReqOptDecorator: (targetRequest: RequestOptions, sourceRequest: any) => {
                //Generate Proxy headers from object.
                GatewayUtility.generateProxyHeaders(sourceRequest, targetRequest);
                return targetRequest;
            }
        });
    }

    public proxyRedirect(host: string, redirect: string){
        return expressProxy(GatewayUtility.resolveHost(host, this.expressPort), {
            proxyReqPathResolver: (request) => {
                //Redirect path.
                return redirect;
            },
            proxyReqOptDecorator: (targetRequest: RequestOptions, sourceRequest: any) => {
                //Generate Proxy headers from object.
                GatewayUtility.generateProxyHeaders(sourceRequest, targetRequest);
                return targetRequest;
            }
        });
    }
}