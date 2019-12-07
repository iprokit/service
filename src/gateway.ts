//Import modules
import expressProxy from 'express-http-proxy';
import { RequestOptions } from 'https';

//Local Imports
import Utility from './utility';
import MicroService from "./microservice";

//Types: MicroServiceInitOptions
export type GatewayInitOptions = {
    version?: string,
}

export default class Gateway extends MicroService {
    //Default Constructor
    public constructor(options?: GatewayInitOptions) {
        super({
            name: 'gateway',
            version: options.version,
            url: '/api'
        });
    }

    /////////////////////////
    ///////Proxy Functions
    /////////////////////////
    public proxy(host: string){
        return expressProxy(this.resolveHost(host), {
            proxyReqOptDecorator: (targetRequest: RequestOptions, sourceRequest: any) => {
                //Generate Proxy headers from object.
                Utility.generateProxyHeaders(sourceRequest, targetRequest);
                return targetRequest;
            }
        });
    }

    public proxyRedirect(host: string, redirect: string){
        return expressProxy(this.resolveHost(host), {
            proxyReqPathResolver: (request) => {
                //Redirect path.
                return redirect;
            },
            proxyReqOptDecorator: (targetRequest: RequestOptions, sourceRequest: any) => {
                //Generate Proxy headers from object.
                Utility.generateProxyHeaders(sourceRequest, targetRequest);
                return targetRequest;
            }
        });
    }

    /////////////////////////
    ///////Other Functions
    /////////////////////////
    public resolveHost(host: string){
        //Split url into host and port.
        const _url = host.split(':');
        const _host = _url[0];
        const _port = Number(_url[1]) || global.service.expressPort;

        //New URL
        return _host + ':' + _port;
    }
}