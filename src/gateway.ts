//Import modules
import { Request } from 'express';
import expressProxy from 'express-http-proxy';
import { RequestOptions } from 'https';

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
     * @param baseUrl the optional, base/root url. The default url is '/api'.
     * @param options the optional, `Gateway` options. The default name is 'gateway'.
     */
    public constructor(baseUrl?: string, options?: Options) {
        //Set null defaults.
        options = options || {};

        //Initialize service variables.
        baseUrl = baseUrl || '/api';
        options.name = options.name || 'gateway';

        //Calling super
        super(baseUrl, options);
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
        //Parse the url.
        const URL = this.parseUrl(url);

        /**
         * Internal function to massage the request object.
         * 
         * @param targetRequest the outgoing request object.
         * @param sourceRequest the incoming request object.
         */
        const proxyReqOptDecorator = (targetRequest: RequestOptions, sourceRequest: Request) => {
            //Log Event.
            this.logger.info(`${sourceRequest.originalUrl} -> http://${URL}${redirect || targetRequest.path}`, { component: 'PROXY' });

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
            return expressProxy(URL, { proxyReqOptDecorator, proxyReqPathResolver });
        } else {
            return expressProxy(URL, { proxyReqOptDecorator });
        }
    }

    //////////////////////////////
    //////Helpers
    //////////////////////////////
    /**
     * Helper to parse the url. Adds the port to the url if no port exists.
     * 
     * @param url the url to parse.
     * 
     * @default Defaults.API_PORT
     */
    public parseUrl(url: string) {
        //Split url into host and port.
        const _url = url.split(':');
        const _host = _url[0];
        const _port = Number(_url[1]) || Default.API_PORT;

        //New URL
        return _host + ':' + _port;
    }
}