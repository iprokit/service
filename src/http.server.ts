//Import Libs.
import HTTP, { Server as HttpServer } from 'http';
import URL from 'url';
import { ParsedUrlQuery } from 'querystring';

//Import Local.
import { Method } from './http';

/**
 * This class is used to create a HTTP server.
 * A `Server` is bound to an IP address and port number and listens for incoming HTTP client connections.
 *
 * @emits `listening` when the server has been bound after calling `server.listen()`.
 * @emits `error` when an error occurs.
 * @emits `drop` when the number of connections reaches the threshold of `server.maxConnections`.
 * @emits `close` when the server is fully closed.
 */
export default class Server extends HttpServer implements IServer {
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
        Router.applyProperties(this);
    }

    //////////////////////////////
    //////Event Listeners
    //////////////////////////////
    /**
     * [Method?] is handled by `dispatch` function.
     */
    private onRequest(request: Request, response: Response) {
        //Set: Request.
        const { pathname, query } = URL.parse(request.url as string, true);
        request.path = pathname as string;
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
            //Treat as `Stack`.
            const pathMatches = request.path.match(route.regExp);
            const stackMatchs = stackIndex < route.routes.length;

            if (pathMatches && stackMatchs) {
                //Stack found, Save path and process the nested stacks.
                const unwindPath = request.path;
                const nestedPath = request.path.substring(route.path.length);
                request.path = nestedPath.startsWith('/') ? nestedPath : `/${nestedPath}`;

                //🎢
                const unwindFunction = () => {
                    request.path = unwindPath;
                    this.dispatch(routeIndex, stackIndex + 1, 0, routes, request, response, unwind);
                }
                this.dispatch(0, 0, 0, route.routes[stackIndex], request, response, unwindFunction);
                return;
            }
        } else {
            //Treat as `Endpoint`.
            const methodMatches = request.method === route.method || Method.ALL === route.method;
            const pathMatches = request.path.match(route.regExp);
            const handlerMatches = handlerIndex < route.handlers.length;

            if (methodMatches && pathMatches && handlerMatches) {
                //Endpoint found, Extract params and execute the handler.
                request.params = route.paramKeys.reduce((params: Record<string, string>, param: string, index: number) => (params[param] = pathMatches[index + 1], params), {});
                request.endpoint = route;

                //🎉
                const nextFunction = () => this.dispatch(routeIndex, stackIndex, handlerIndex + 1, routes, request, response, unwind);
                route.handlers[handlerIndex](request, response, nextFunction);
                return;
            }
        }

        //Route not found, lets keep going though the loop.
        this.dispatch(routeIndex + 1, 0, 0, routes, request, response, unwind);
    }

    //////////////////////////////
    //////Interface: IRouter
    //////////////////////////////
    public declare get: (path: string, ...handlers: Array<RequestHandler>) => this;
    public declare post: (path: string, ...handlers: Array<RequestHandler>) => this;
    public declare put: (path: string, ...handlers: Array<RequestHandler>) => this;
    public declare patch: (path: string, ...handlers: Array<RequestHandler>) => this;
    public declare delete: (path: string, ...handlers: Array<RequestHandler>) => this;
    public declare all: (path: string, ...handlers: Array<RequestHandler>) => this;
    public declare mount: (path: string, ...routers: Array<IRouter>) => this;
}

//////////////////////////////
/////IServer
//////////////////////////////
/**
 * Interface of HTTP `Server`.
 */
export interface IServer extends IRouter { }

//////////////////////////////
/////Router
//////////////////////////////
/**
 * This class is used to register routes that handle HTTP requests.
 * Once mounted, HTTP requests are dispatched to the appropriate registered routes.
 */
export class Router implements IRouter {
    /**
     * The routes registered.
     */
    public readonly routes: Array<Route>;

    /**
     * Creates an instance of router.
     */
    constructor() {
        //Initialize Variables.
        this.routes = new Array();

        //Apply `Router` properties 👻.
        Router.applyProperties(this);
    }

    //////////////////////////////
    //////Interface: IRouter
    //////////////////////////////
    public declare get: (path: string, ...handlers: Array<RequestHandler>) => this;
    public declare post: (path: string, ...handlers: Array<RequestHandler>) => this;
    public declare put: (path: string, ...handlers: Array<RequestHandler>) => this;
    public declare patch: (path: string, ...handlers: Array<RequestHandler>) => this;
    public declare delete: (path: string, ...handlers: Array<RequestHandler>) => this;
    public declare all: (path: string, ...handlers: Array<RequestHandler>) => this;
    public declare mount: (path: string, ...routers: Array<IRouter>) => this;

    //////////////////////////////
    //////Factory
    //////////////////////////////
    /**
     * Applies properties of the `IRouter` interface to the provided instance,
     * enabling the registration of routes.
     * 
     * @param instance the instance to which the `IRouter` properties are applied.
     */
    public static applyProperties<I extends IRouter>(instance: I) {
        //Factory for handling path transformations.
        const handleTrailingSlash = (path: string) => path.replace(/\/$/, '') || '/';
        const handleWildcard = (path: string) => path.replace(/\*/g, '.*');
        const handleOptionalParams = (path: string) => path.replace(/\/:([^\s/]+)\?/g, '(?:/([^/]*)?)?');
        const handleRequiredParams = (path: string) => path.replace(/:([^\s/]+)/g, '([^/]+)');

        //Factory for registering a `Endpoint`.
        const endpoint = (method: MethodType) => {
            return (path: string, ...handlers: Array<RequestHandler>) => {
                const regExp = new RegExp(`^${handleRequiredParams(handleOptionalParams(handleWildcard(handleTrailingSlash(path))))}$`);
                const paramKeys = (path.match(/:([^\s/]+)/g) || []).map((param: string) => param.slice(1).replace('?', ''));
                instance.routes.push({ method, path, regExp, paramKeys, handlers });
                return instance;
            }
        }

        //Factory for registering a `Stack`.
        const stack = () => {
            return (path: string, ...routers: Array<IRouter>) => {
                const regExp = new RegExp(`^${handleTrailingSlash(path)}`);
                const routes = routers.map((router) => router.routes);
                instance.routes.push({ path, regExp, routes });
                return instance;
            }
        }

        //`IRouter` properties 😈.
        instance.get = endpoint(Method.GET);
        instance.post = endpoint(Method.POST);
        instance.put = endpoint(Method.PUT);
        instance.patch = endpoint(Method.PATCH);
        instance.delete = endpoint(Method.DELETE);
        instance.all = endpoint(Method.ALL);
        instance.mount = stack();
    }
}

//////////////////////////////
/////IRouter
//////////////////////////////
/**
 * Interface of `Router`.
 */
export interface IRouter {
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
    mount: (path: string, ...routers: Array<IRouter>) => this;
}

//////////////////////////////
/////Route
//////////////////////////////
/**
 * The union of an `Stack`/`Endpoint`.
 */
export type Route = Stack | Endpoint;

/**
 * Represents a group of routes.
 */
export interface Stack {
    /**
     * The path pattern of the stack.
     */
    path: string;

    /**
     * The compiled regular expression to match the path pattern of the stack.
     */
    regExp: RegExp;

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
    method: MethodType;

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
 * The Type definitions of the HTTP method.
 */
export type MethodType = typeof Method[keyof typeof Method];

/**
 * The request handler.
 */
export type RequestHandler = (request: Request, response: Response, next: NextFunction) => void;

/**
 * The next function.
 */
export type NextFunction = () => void;

//////////////////////////////
/////Request/Response
//////////////////////////////
/**
 * Represents an incoming HTTP request.
 */
export interface Request extends HTTP.IncomingMessage {
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

    /**
     * The matched endpoint.
     */
    endpoint: Endpoint;
}

/**
 * Represents an outgoing HTTP response.
 */
export interface Response extends HTTP.ServerResponse { }