//Import modules
import expressProxy from 'express-http-proxy';
import { RequestOptions } from 'https';

//Local Imports
import Utility from './utility';
import MicroService, { Options as MicroServiceOptions, Defaults } from "./microservice";

export default class Gateway extends MicroService {
    //Default Constructor
    public constructor(baseUrl?: string, options?: MicroServiceOptions) {
        //Set null defaults.
        options = options || {};

        //Init service variables.
        baseUrl = baseUrl || '/api';
        options.name = options.name || 'gateway';

        //Calling super
        super(baseUrl, options);
    }

    /////////////////////////
    ///////Proxy Functions
    /////////////////////////
    public proxy(url: string){
        return expressProxy(this.resolveUrl(url), {
            proxyReqOptDecorator: (targetRequest: RequestOptions, sourceRequest: any) => {
                //Generate Proxy headers from object.
                Utility.generateProxyHeaders(sourceRequest, targetRequest);
                return targetRequest;
            }
        });
    }

    public proxyRedirect(url: string, redirect: string){
        return expressProxy(this.resolveUrl(url), {
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
    public resolveUrl(url: string){
        //Split url into host and port.
        const _url = url.split(':');
        const _host = _url[0];
        const _port = Number(_url[1]) || Defaults.WWW_PORT;

        //New URL
        return _host + ':' + _port;
    }
}