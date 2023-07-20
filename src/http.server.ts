//Import Libs.
import { Server, IncomingMessage, ServerResponse } from 'http';
import { parse } from 'url';
import { ParsedUrlQuery } from 'querystring';

//Import Local.
import { NextFunction } from './common';

/**
 * This class is used to create a HTTP server.
 * A `Server` is bound to an IP address and port number and listens for incoming HTTP client connections.
 */
export default class HttpServer extends Server {
    /**
     * The routes on the server.
     */
    public readonly routes: Array<Route>;

    /**
     * Creates an instance of HTTP server.
     */
    constructor() {
        super();

        //Initialize Variables.
        this.routes = new Array();

        //Bind listeners.
        this.onRequest = this.onRequest.bind(this);

        //Add listeners.
        this.addListener('request', this.onRequest);
    }

    //////////////////////////////
    //////Event Listeners
    //////////////////////////////
    /**
     * [Method?] is handled by `dispatch` function.
     */
    private onRequest(request: Request, response: Response) {
        //Set: Request.
        const { pathname, query } = parse(request.url, true);
        request.path = pathname;
        request.query = query;

        //Below line will blow your mind! 🤯
        this.dispatch(0, request, response);
    }

    //////////////////////////////
    //////HTTP Methods
    //////////////////////////////
    /**
     * Registers a route for handling GET requests.
     * 
     * @param path the route path.
     * @param handler the request handler function.
     */
    public get(path: string, handler: RequestHandler) {
        this.routes.push({ method: 'GET', path, handler });
    }

    /**
     * Registers a route for handling POST requests.
     * 
     * @param path the route path.
     * @param handler the request handler function.
     */
    public post(path: string, handler: RequestHandler) {
        this.routes.push({ method: 'POST', path, handler });
    }

    /**
     * Registers a route for handling PUT requests.
     * 
     * @param path the route path.
     * @param handler the request handler function.
     */
    public put(path: string, handler: RequestHandler) {
        this.routes.push({ method: 'PUT', path, handler });
    }

    /**
     * Registers a route for handling PATCH requests.
     * 
     * @param path the route path.
     * @param handler the request handler function.
     */
    public patch(path: string, handler: RequestHandler) {
        this.routes.push({ method: 'PATCH', path, handler });
    }

    /**
     * Registers a route for handling DELETE requests.
     * 
     * @param path the route path.
     * @param handler the request handler function.
     */
    public delete(path: string, handler: RequestHandler) {
        this.routes.push({ method: 'DELETE', path, handler });
    }

    /**
     * Registers a route for handling all HTTP methods.
     * 
     * @param path the route path.
     * @param handler the request handler function.
     */
    public all(path: string, handler: RequestHandler) {
        this.routes.push({ method: 'ALL', path, handler });
    }

    //////////////////////////////
    //////Dispatch
    //////////////////////////////
    /**
     * Recursively loop through the routes to find and execute its handler.
     * 
     * @param index the iteration of the loop.
     * @param request the incoming request.
     * @param response the server response.
     */
    private dispatch(index: number, request: Request, response: Response) {
        const route = this.routes[index++];

        //Need I say more.
        if (!route) return;

        //Shits about to go down! 😎
        const method = (route.method === request.method || route.method === 'ALL') ? true : false;
        const path = request.path.match(`^${route.path.replace(/:[^\s/]+/g, '([^/]+)').replace(/\*$/, '.*')}$`);

        if (method && path) {
            //Route found, lets extract params and execute the handler.
            const paramKeys = route.path.match(/:[^\s/]+/g)?.map((param) => param.slice(1)) || [];
            request.params = paramKeys.reduce((params: { [key: string]: string }, param: string, index: number) => (params[param] = path[index + 1], params), {});
            request.route = route;

            const next: NextFunction = () => this.dispatch(index, request, response);
            route.handler(request, response, next);
        } else {
            //Route not found, lets keep going though the loop.
            this.dispatch(index, request, response);
        }
    }
}

//////////////////////////////
/////Request/Response
//////////////////////////////
/**
 * Represents an incoming HTTP request.
 */
export interface Request extends IncomingMessage {
    /**
     * The matched route.
     */
    route: Route;

    /**
     * The path portion of the URL.
     */
    path: string;

    /**
     * Route parameters extracted from the URL.
     */
    params: { [key: string]: string };

    /**
     * The query parameters.
     */
    query: ParsedUrlQuery;
}

/**
 * Represents a server response to an HTTP request.
 */
export interface Response extends ServerResponse { }

//////////////////////////////
/////Route
//////////////////////////////
/**
 * Represents a route.
 */
export interface Route {
    /**
     * The HTTP method associated with the route.
     */
    method: HttpMethod;

    /**
     * The path pattern of the route.
     */
    path: string;

    /**
     * The request handler function for the route.
     */
    handler: RequestHandler;
}

/**
 * The HTTP method.
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'ALL';

/**
 * The request handler.
 */
export type RequestHandler = (request: Request, response: Response, next: NextFunction) => void;