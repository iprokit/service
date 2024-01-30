//Import Libs.
import { Server, IncomingMessage, ServerResponse } from 'http';
import URL from 'url';
import { ParsedUrlQuery } from 'querystring';

/**
 * This class is used to create a HTTP server.
 * A `HttpServer` is bound to an IP address and port number and listens for incoming HTTP client connections.
 *
 * @emits `listening` when the server has been bound after calling `server.listen()`.
 * @emits `error` when an error occurs.
 * @emits `drop` when the number of connections reaches the threshold of `server.maxConnections`.
 * @emits `close` when the server is fully closed.
 */
export default class HttpServer extends Server implements Router {
    /**
     * The routes registered on the server.
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

        //Apply `Router` properties 👻.
        this.applyRouterProperties(this);
    }

    //////////////////////////////
    //////Event Listeners
    //////////////////////////////
    /**
     * [Method?] is handled by `dispatch` function.
     */
    private onRequest(request: Request, response: Response) {
        //Set: Request.
        const { pathname, query } = URL.parse(request.url, true);
        request.path = pathname;
        request.query = query;

        //Below line will blow your mind! 🤯
        this.dispatch(0, 0, 0, this.routes, request, response, () => { });
    }

    //////////////////////////////
    //////Dispatch
    //////////////////////////////
    /**
     * Recursively loop through the routes to find and execute its handler.
     * 
     * @param routeIndex the index of the current route being processed.
     * @param stackIndex the index of the current stack being processed.
     * @param handlerIndex the index of the current handler being processed.
     * @param routes the routes to be processed.
     * @param request the incoming request.
     * @param response the outgoing response. 
     * @param unwind function called once the processed routes unwind.
     */
    private dispatch(routeIndex: number, stackIndex: number, handlerIndex: number, routes: Array<Route>, request: Request, response: Response, unwind: () => void) {
        //Need I say more.
        if (routeIndex >= routes.length) return unwind();

        const route = routes[routeIndex];

        //Shits about to go down! 😎
        if ('routes' in route) {
            const stack = route as Stack;
            const pathMatches = request.path.startsWith(stack.path);
            const stackMatchs = stackIndex < stack.routes.length;

            if (pathMatches && stackMatchs) {
                //Stack found, Save path and process the nested stacks.
                const unwindPath = request.path;
                request.path = request.path.substring(stack.path.length);

                //🎢
                const unwindFunction = () => {
                    request.path = unwindPath;
                    this.dispatch(routeIndex, stackIndex + 1, 0, routes, request, response, unwind);
                }
                this.dispatch(0, 0, 0, stack.routes[stackIndex], request, response, unwindFunction);
                return;
            }
        } else {
            const endpoint = route as Endpoint;
            const methodMatches = request.method === endpoint.method || 'ALL' === endpoint.method;
            const pathMatches = request.path.match(endpoint.regExp);
            const handlerMatches = handlerIndex < endpoint.handlers.length;

            if (methodMatches && pathMatches && handlerMatches) {
                //Endpoint found, Extract params and execute the handler.
                request.params = endpoint.paramKeys.reduce((params: Record<string, string>, param: string, index: number) => (params[param] = pathMatches[index + 1], params), {});

                //🎉
                const nextFunction = () => this.dispatch(routeIndex, stackIndex, handlerIndex + 1, routes, request, response, unwind);
                endpoint.handlers[handlerIndex](request, response, nextFunction);
                return;
            }
        }

        //Route not found, lets keep going though the loop.
        this.dispatch(routeIndex + 1, 0, 0, routes, request, response, unwind);
    }

    //////////////////////////////
    //////Interface: Router
    //////////////////////////////
    public get: (path: string, ...handlers: Array<RequestHandler>) => this;
    public post: (path: string, ...handlers: Array<RequestHandler>) => this;
    public put: (path: string, ...handlers: Array<RequestHandler>) => this;
    public patch: (path: string, ...handlers: Array<RequestHandler>) => this;
    public delete: (path: string, ...handlers: Array<RequestHandler>) => this;
    public all: (path: string, ...handlers: Array<RequestHandler>) => this;
    public mount: (path: string, ...routers: Array<Router>) => this;

    //////////////////////////////
    //////Factory: Router
    //////////////////////////////
    /**
     * Applies properties of the `Router` interface to the provided instance,
     * enabling the registration of routes.
     * 
     * @param instance the instance to which the `Router` properties are applied.
     */
    private applyRouterProperties<I extends Router>(instance: I) {
        /**
         * Factory for registering a `Endpoint`.
         */
        const endpoint = (method: HttpMethod) => {
            return (path: string, ...handlers: Array<RequestHandler>) => {
                const regExp = new RegExp(`^${path.replace(/:[^\s/]+/g, '([^/]+)').replace(/\*$/, '.*')}$`);
                const paramKeys = path.match(/:[^\s/]+/g)?.map(param => param.slice(1)) || [];
                instance.routes.push({ method, path, regExp, paramKeys, handlers });
                return instance;
            }
        }

        /**
         * Factory for registering a `Stack`.
         */
        const stack = () => {
            return (path: string, ...routers: Array<Router>) => {
                const routes = routers.map((router) => router.routes);
                instance.routes.push({ path, routes });
                return instance;
            }
        }

        //`Router` properties 😈.
        instance.get = endpoint('GET');
        instance.post = endpoint('POST');
        instance.put = endpoint('PUT');
        instance.patch = endpoint('PATCH');
        instance.delete = endpoint('DELETE');
        instance.all = endpoint('ALL');
        instance.mount = stack();
    }

    //////////////////////////////
    //////Route
    //////////////////////////////
    /**
     * Returns a `Router` to group routes that share related functionality.
     */
    public Route() {
        const router = { routes: new Array<Route>() } as Router;

        //Apply `Router` properties 👻.
        this.applyRouterProperties(router);
        return router;
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
     * The path portion of the URL.
     */
    path: string;

    /**
     * The parameters extracted from the URL.
     */
    params: Record<string, string>;

    /**
     * The query parameters.
     */
    query: ParsedUrlQuery;
}

/**
 * Represents an outgoing HTTP response.
 */
export interface Response extends ServerResponse { }

//////////////////////////////
/////Router
//////////////////////////////
/**
 * Interface for handling HTTP requests and registering routes.
 */
export interface Router {
    /**
     * The routes registered.
     */
    routes: Array<Route>;

    /**
     * Registers a route for handling GET requests.
     * 
     * @param path the path pattern.
     * @param handlers the request handler functions.
     */
    get: (path: string, ...handlers: Array<RequestHandler>) => this;

    /**
     * Registers a route for handling POST requests.
     * 
     * @param path the path pattern.
     * @param handlers the request handler functions.
     */
    post: (path: string, ...handlers: Array<RequestHandler>) => this;

    /**
     * Registers a route for handling PUT requests.
     * 
     * @param path the path pattern.
     * @param handlers the request handler functions.
     */
    put: (path: string, ...handlers: Array<RequestHandler>) => this;

    /**
     * Registers a route for handling PATCH requests.
     * 
     * @param path the path pattern.
     * @param handlers the request handler functions.
     */
    patch: (path: string, ...handlers: Array<RequestHandler>) => this;

    /**
     * Registers a route for handling DELETE requests.
     * 
     * @param path the path pattern.
     * @param handlers the request handler functions.
     */
    delete: (path: string, ...handlers: Array<RequestHandler>) => this;

    /**
     * Registers a route for handling ALL requests.
     * 
     * @param path the path pattern.
     * @param handlers the request handler functions.
     */
    all: (path: string, ...handlers: Array<RequestHandler>) => this;

    /**
     * Mounts multiple routers.
     * 
     * @param path the path pattern.
     * @param routers the routers to mount.
     */
    mount: (path: string, ...routers: Array<Router>) => this;
}

//////////////////////////////
/////Route
//////////////////////////////
/**
 * The union of an `Stack`/`Endpoint`.
 */
export type Route = Stack | Endpoint;

/**
 * Represents a group of routes that share related functionality.
 */
export interface Stack {
    /**
     * The path pattern of the stack.
     */
    path: string;

    /**
     * The routes registered in the stack.
     */
    routes: Array<Array<Route>>;
}

/**
 * Represents a endpoint.
 */
export interface Endpoint {
    /**
     * The HTTP method of the endpoint.
     */
    method: HttpMethod;

    /**
     * The path pattern of the endpoint.
     */
    path: string;

    /**
     * The compiled regular expression to match the path pattern of the endpoint.
     */
    regExp: RegExp;

    /**
     * The list of parameter names extracted from the path pattern of the endpoint.
     */
    paramKeys: Array<string>;

    /**
     * The request handler functions of the endpoint.
     */
    handlers: Array<RequestHandler>;
}

/**
 * The HTTP method.
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'ALL';

/**
 * The request handler.
 */
export type RequestHandler = (request: Request, response: Response, next: NextFunction) => void;

/**
 * The next function.
 */
export type NextFunction = () => void;