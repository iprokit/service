//Import modules
import { Request } from 'express';
import expressProxy from 'express-http-proxy';
import { RequestOptions } from 'https';
import { URL } from 'url';

//Local Imports
import Default from './default';
import Helper from './helper';
import Service, { Options } from './service';

/**
 * `Gateway` acts has a middleman between the client and the endpoint service.
 * The main function of the gateway is to proxy requests from the client to the endpoint service.
 * Before the proxy, you can massage and handle the data with the router middlewear and pass the request to the endpoint service.
 * 
 * @extends Service
 */
export default class Gateway extends Service {
    /**
     * Creates an instance of a `Gateway`.
     * 
     * @param options the optional constructor options.
     */
    public constructor(options?: Options) {
        //Initialize Options.
        options = options || {};

        //Initialize gateway variables.
        options.name = options.name || 'gateway';
        options.baseUrl = options.baseUrl || '/api';

        //Call super for Service.
        super(options);
    }

    //////////////////////////////
    //////Proxy
    //////////////////////////////
    /**
     * Middlewear function.
     * Proxies the request to the target service.
     * 
     * @param url the target service url.
     * @param redirect the optional, path of the enpoint in that target service.
     */
    public proxy(url: string, redirect?: string) {
        //Define URL.
        const _url = new URL(`http://${url}`);
        _url.port = _url.port === '' ? Default.API_PORT.toString() : _url.port;

        /**
         * Internal function to massage the request object.
         * 
         * @param targetRequest the outgoing request object.
         * @param sourceRequest the incoming request object.
         */
        const proxyReqOptDecorator = (targetRequest: RequestOptions, sourceRequest: Request) => {
            //Log Event.
            this.logger.info(`${sourceRequest.originalUrl} -> http://${_url}${redirect || targetRequest.path}`, { component: 'PROXY' });

            //Generate Proxy headers from object.
            Helper.generateProxyHeaders(sourceRequest, targetRequest);
            return targetRequest;
        };

        /**
         * Internal function to massage the request url.
         * 
         * @param request the outgoing request object.
         */
        const proxyReqPathResolver = (request: Request) => {
            //Redirect path.
            return redirect;
        };

        if (redirect) {
            return expressProxy(_url.host, { proxyReqOptDecorator, proxyReqPathResolver });
        } else {
            return expressProxy(_url.host, { proxyReqOptDecorator });
        }
    }
}