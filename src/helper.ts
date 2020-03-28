//Import modules
import { RequestOptions } from 'https';
import ip from 'ip';
import { Request } from 'express';

/**
 * The static helper class.
 */
export default class Helper {
    //////////////////////////////
    //////Network
    //////////////////////////////
    /**
     * @returns the docker container address.
     */
    public static getContainerIP() {
        return ip.address();
    }

    /**
     * @returns the docker host address.
     */
    public static getHostIP() {
        //TODO: https://iprotechs.atlassian.net/browse/PMICRO-6
        return '';
    }

    //////////////////////////////
    //////Proxy
    //////////////////////////////
    /**
     * Generate proxy headers from proxy objects.
     * This is used to pass proxy headers from gateway service to micro-service/general-service during proxy redirect.
     * 
     * @param sourceRequest the source service request.
     * @param targetRequest the target service request.
     */
    public static generateProxyHeaders(sourceRequest: Request, targetRequest: RequestOptions) {
        const proxyObject = Object.getPrototypeOf(sourceRequest).proxy;
        if (proxyObject) {
            //Convert Proxy dict to array and get each proxy.
            Object.entries(proxyObject).forEach(([name, proxy]) => {
                targetRequest.headers['proxy-' + name] = JSON.stringify(proxy);
            });
        }
    }

    /**
     * Generate proxy objects from proxy headers.
     * This is used to unpack proxy objects into the service.
     * 
     * @param request the request object to unpack the proxy objects.
     */
    public static generateProxyObjects(request: Request) {
        //Create Empty Proxy object.
        Object.getPrototypeOf(request).proxy = {};

        let proxyHeaders = request.headers;
        //Convert Proxy headers to array and get each proxy.
        Object.entries(proxyHeaders).find(([name, proxy]) => {
            if (name.startsWith('proxy-')) {
                const objectKey = name.split('-')[1];
                const objectValue = proxy;
                Object.getPrototypeOf(request).proxy[objectKey] = JSON.parse(objectValue as string);

                //Delete proxy headers.
                delete request.headers[name];
            }
        });
    }
}