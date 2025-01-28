// Import Libs.
import http from 'http';
import URL from 'url';
import { ParsedUrlQuery } from 'querystring';

// Import Local.
import { Method, RequestHeaders, ResponseHeaders } from './definitions';

/**
 * `Server` binds to an IP address and port number, listening for incoming HTTP client connections.
 * Manages registered routes to handle various HTTP methods and dispatches requests to the appropriate route handlers.
 */
export default class Server extends http.Server implements IServer {
	/**
	 * Unique identifier of the server.
	 */
	public readonly identifier: string;

	/**
	 * Routes registered on the server.
	 */
	public readonly routes: Array<Route>;

	/**
	 * Creates an instance of HTTP `Server`.
	 *
	 * @param identifier unique identifier of the server.
	 */
	constructor(identifier: string) {
		super();

		// Initialize options.
		this.identifier = identifier;

		// Initialize variables.
		this.routes = new Array();

		// Bind listeners.
		this.onRequest = this.onRequest.bind(this);

		// Add listeners.
		this.addListener('request', this.onRequest);

		// Apply `Router` properties. 👻
		Router.applyProperties(this);
	}

	//////////////////////////////
	//////// Event Listeners
	//////////////////////////////
	/**
	 * [Method?] is handled by `dispatch` function.
	 */
	private onRequest(request: ServerRequest, response: ServerResponse) {
		// Set: Response.
		response.setHeader('X-Server-Identifier', this.identifier);

		// Set: Request.
		const { pathname, query } = URL.parse(request.url!, true);
		request.path = pathname!;
		request.query = query;

		// Below line will blow your mind! 🤯
		this.dispatch(0, 0, 0, this.routes, request, response, () => {});
	}

	//////////////////////////////
	//////// Dispatch
	//////////////////////////////
	/**
	 * Recursively loop through the routes to find and execute its handler.
	 *
	 * @param routeIndex index of the current route being processed.
	 * @param stackIndex index of the current stack being processed.
	 * @param handlerIndex index of the current handler being processed.
	 * @param routes routes to be processed.
	 * @param request incoming request.
	 * @param response outgoing response.
	 * @param unwind function called once the processed routes unwind.
	 */
	private dispatch(routeIndex: number, stackIndex: number, handlerIndex: number, routes: Array<Route>, request: ServerRequest, response: ServerResponse, unwind: () => void) {
		// Need I say more.
		if (routeIndex >= routes.length) return unwind();

		const route = routes[routeIndex];

		// Shits about to go down! 😎
		if ('routes' in route) {
			// Treat as `Stack`.
			const pathMatches = request.path.match(route.regExp);
			const stackMatches = stackIndex < route.routes.length;

			if (pathMatches && stackMatches) {
				// Stack found, Save path and process the nested stacks.
				const unwindPath = request.path;
				const nestedPath = request.path.substring(route.path.length);
				request.path = nestedPath.startsWith('/') ? nestedPath : `/${nestedPath}`;

				// 🎢
				const unwindFunction = () => {
					request.path = unwindPath;
					this.dispatch(routeIndex, stackIndex + 1, 0, routes, request, response, unwind);
				};
				this.dispatch(0, 0, 0, route.routes[stackIndex], request, response, unwindFunction);
				return;
			}
		} else {
			// Treat as `Endpoint`.
			const methodMatches = request.method === route.method || 'ALL' === route.method;
			const pathMatches = request.path.match(route.regExp);
			const handlerMatches = handlerIndex < route.handlers.length;

			if (methodMatches && pathMatches && handlerMatches) {
				// Endpoint found, Extract params and execute the handler.
				request.params = route.paramKeys.reduce((params: Record<string, string>, param: string, index: number) => ((params[param] = pathMatches[index + 1]), params), {});
				request.endpoint = route;

				// 🎉
				const nextFunction = () => this.dispatch(routeIndex, stackIndex, handlerIndex + 1, routes, request, response, unwind);
				route.handlers[handlerIndex](request, response, nextFunction);
				return;
			}
		}

		// Route not found, lets keep going though the loop.
		this.dispatch(routeIndex + 1, 0, 0, routes, request, response, unwind);
	}

	//////////////////////////////
	//////// IRouter
	//////////////////////////////
	declare public get: (path: string, ...handlers: Array<RequestHandler>) => this;
	declare public post: (path: string, ...handlers: Array<RequestHandler>) => this;
	declare public put: (path: string, ...handlers: Array<RequestHandler>) => this;
	declare public patch: (path: string, ...handlers: Array<RequestHandler>) => this;
	declare public delete: (path: string, ...handlers: Array<RequestHandler>) => this;
	declare public all: (path: string, ...handlers: Array<RequestHandler>) => this;
	declare public mount: (path: string, ...routers: Array<IRouter>) => this;
}

//////////////////////////////
//////// IServer
//////////////////////////////
/**
 * Interface for the HTTP `Server`.
 */
export interface IServer extends IRouter {}

//////////////////////////////
//////// Router
//////////////////////////////
/**
 * Registers routes that handle HTTP requests.
 * Once mounted, HTTP requests are dispatched to the appropriate registered routes.
 */
export class Router implements IRouter {
	/**
	 * Routes registered.
	 */
	public readonly routes: Array<Route>;

	/**
	 * Creates an instance of `Router`.
	 */
	constructor() {
		// Initialize Variables.
		this.routes = new Array();

		// Apply `Router` properties. 👻
		Router.applyProperties(this);
	}

	//////////////////////////////
	//////// IRouter
	//////////////////////////////
	declare public get: (path: string, ...handlers: Array<RequestHandler>) => this;
	declare public post: (path: string, ...handlers: Array<RequestHandler>) => this;
	declare public put: (path: string, ...handlers: Array<RequestHandler>) => this;
	declare public patch: (path: string, ...handlers: Array<RequestHandler>) => this;
	declare public delete: (path: string, ...handlers: Array<RequestHandler>) => this;
	declare public all: (path: string, ...handlers: Array<RequestHandler>) => this;
	declare public mount: (path: string, ...routers: Array<IRouter>) => this;

	//////////////////////////////
	//////// Apply
	//////////////////////////////
	/**
	 * Applies properties of `IRouter` interface to the provided instance,
	 * enabling registration of routes.
	 *
	 * @param instance instance to which the `IRouter` properties are applied.
	 */
	public static applyProperties<I extends IRouter>(instance: I) {
		instance.get = this.registerEndpoint(instance, 'GET');
		instance.post = this.registerEndpoint(instance, 'POST');
		instance.put = this.registerEndpoint(instance, 'PUT');
		instance.patch = this.registerEndpoint(instance, 'PATCH');
		instance.delete = this.registerEndpoint(instance, 'DELETE');
		instance.all = this.registerEndpoint(instance, 'ALL');
		instance.mount = this.registerStack(instance);
	}

	//////////////////////////////
	//////// Register
	//////////////////////////////
	/**
	 * Registers an individual HTTP endpoint for a specific HTTP method.
	 *
	 * @param instance router instance where the endpoint will be registered.
	 * @param method HTTP method for the endpoint.
	 */
	private static registerEndpoint<I extends IRouter>(instance: I, method: Method) {
		return (path: string, ...handlers: Array<RequestHandler>) => {
			const regExp = new RegExp(`^${this.transformRequiredParams(this.transformOptionalParams(this.transformWildcard(this.transformTrailingSlash(path))))}$`);
			const paramKeys = (path.match(/:([^\s/]+)/g) || []).map((param: string) => param.slice(1).replace('?', ''));
			instance.routes.push({ method, path, regExp, paramKeys, handlers });
			return instance;
		};
	}

	/**
	 * Registers a stack of routes.
	 *
	 * @param instance router instance where the stack will be registered.
	 */
	private static registerStack<I extends IRouter>(instance: I) {
		return (path: string, ...routers: Array<IRouter>) => {
			const regExp = new RegExp(`^${this.transformTrailingSlash(path)}`);
			const routes = routers.map((router) => router.routes);
			instance.routes.push({ path, regExp, routes });
			return instance;
		};
	}

	//////////////////////////////
	//////// Transform Path
	//////////////////////////////
	/**
	 * Transforms the path by removing the trailing slash, except for the root path.
	 *
	 * @param path path containing trailing slash.
	 */
	private static transformTrailingSlash(path: string) {
		return path.replace(/\/$/, '') || '/';
	}

	/**
	 * Transforms wildcard characters (*) in the path to regex-compatible format.
	 *
	 * @param path path containing wildcards.
	 */
	private static transformWildcard(path: string) {
		return path.replace(/\*/g, '.*');
	}

	/**
	 * Transforms optional parameters in the path to regex-compatible format.
	 *
	 * @param path path containing required parameters.
	 */
	private static transformRequiredParams(path: string) {
		return path.replace(/:([^\s/]+)/g, '([^/]+)');
	}

	/**
	 * Transforms required parameters in the path to regex-compatible format.
	 *
	 * @param path path containing optional parameters.
	 */
	private static transformOptionalParams(path: string) {
		return path.replace(/\/:([^\s/]+)\?/g, '(?:/([^/]*)?)?');
	}
}

//////////////////////////////
//////// IRouter
//////////////////////////////
/**
 * Interface for the `Router`.
 */
export interface IRouter {
	/**
	 * Routes registered.
	 */
	routes: Array<Route>;

	/**
	 * Registers a route for handling GET requests.
	 *
	 * @param path path pattern.
	 * @param handlers request handler functions.
	 */
	get: (path: string, ...handlers: Array<RequestHandler>) => this;

	/**
	 * Registers a route for handling POST requests.
	 *
	 * @param path path pattern.
	 * @param handlers request handler functions.
	 */
	post: (path: string, ...handlers: Array<RequestHandler>) => this;

	/**
	 * Registers a route for handling PUT requests.
	 *
	 * @param path path pattern.
	 * @param handlers request handler functions.
	 */
	put: (path: string, ...handlers: Array<RequestHandler>) => this;

	/**
	 * Registers a route for handling PATCH requests.
	 *
	 * @param path path pattern.
	 * @param handlers request handler functions.
	 */
	patch: (path: string, ...handlers: Array<RequestHandler>) => this;

	/**
	 * Registers a route for handling DELETE requests.
	 *
	 * @param path path pattern.
	 * @param handlers request handler functions.
	 */
	delete: (path: string, ...handlers: Array<RequestHandler>) => this;

	/**
	 * Registers a route for handling ALL requests.
	 *
	 * @param path path pattern.
	 * @param handlers request handler functions.
	 */
	all: (path: string, ...handlers: Array<RequestHandler>) => this;

	/**
	 * Mounts multiple routers.
	 *
	 * @param path path pattern.
	 * @param routers routers to mount.
	 */
	mount: (path: string, ...routers: Array<IRouter>) => this;
}

//////////////////////////////
//////// Route
//////////////////////////////
/**
 * Union of `Stack` and `Endpoint`.
 */
export type Route = Stack | Endpoint;

/**
 * Represents a group of routes.
 */
export interface Stack {
	/**
	 * Path pattern of the stack.
	 */
	path: string;

	/**
	 * Compiled regular expression to match path pattern of the stack.
	 */
	regExp: RegExp;

	/**
	 * Routes registered in the stack.
	 */
	routes: Array<Array<Route>>;
}

/**
 * Represents a endpoint.
 */
export interface Endpoint {
	/**
	 * HTTP method of the endpoint.
	 */
	method: Method;

	/**
	 * Path pattern of the endpoint.
	 */
	path: string;

	/**
	 * Compiled regular expression to match path pattern of the endpoint.
	 */
	regExp: RegExp;

	/**
	 * List of parameter names extracted from the endpoint's path pattern.
	 */
	paramKeys: Array<string>;

	/**
	 * Request handler functions of the endpoint.
	 */
	handlers: Array<RequestHandler>;
}

/**
 * Request handler.
 */
export type RequestHandler = (request: ServerRequest, response: ServerResponse, next: NextFunction) => void;

/**
 * Next function.
 */
export type NextFunction = () => void;

//////////////////////////////
//////// Request/Response
//////////////////////////////
/**
 * Represents an HTTP server request.
 */
export interface ServerRequest extends http.IncomingMessage {
	/**
	 * Request headers.
	 */
	headers: RequestHeaders;

	/**
	 * Path portion of the URL.
	 */
	path: string;

	/**
	 * Parameters extracted from the URL.
	 */
	params: Record<string, string>;

	/**
	 * Query parameters.
	 */
	query: ParsedUrlQuery;

	/**
	 * Matched endpoint.
	 */
	endpoint: Endpoint;
}

/**
 * Represents an HTTP server response.
 */
export interface ServerResponse extends http.ServerResponse {
	/**
	 * Response headers.
	 */
	headers: ResponseHeaders;
}
