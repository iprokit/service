import { RequestOptions } from 'https';

export default class GatewayUtility{
    public static resolveHost(host: string, defaultPort: Number){
        //Split url into host and port.
        const _url = host.split(':');
        const _host = _url[0];
        const _port = Number(_url[1]) || defaultPort;

        //New URL
        return _host + ':' + _port;
    }

    public static generateProxyHeaders(sourceRequest: any, targetRequest: RequestOptions){
        const proxyObject = sourceRequest.proxy;
        if(proxyObject){
            for(let key in proxyObject){
                const headerName = 'proxy-' + key;
                const headerObject = proxyObject[key];
                targetRequest.headers[headerName] = JSON.stringify(headerObject);
            }
        }
    }

    public static generateProxyObjects(request: any){
        //Create Empty Proxy object.
        request.proxy = {};

        let proxyHeaders = request.headers;
        for(let key in proxyHeaders){
            if(key.includes('proxy-')){
                const objectKey = key.split('-')[1];
                const objectValue = proxyHeaders[key];
                request.proxy[objectKey] = JSON.parse(objectValue);

                //Delete proxy headers.
                delete request.headers[key];
            }
        }
    }
}