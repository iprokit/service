// Import Libs.
import mocha from 'mocha';
import assert from 'assert';
import { once } from 'events';

// Import Local.
import { Server, Router, IRouter, Stack, Endpoint, RequestHandler, Method, StatusCode } from '../lib/http';
import { createString, createIdentifier, clientRequest } from './util';

const host = '127.0.0.1';
const port = 3000;

mocha.describe('HTTP Test', () => {
	let server: Server;

	mocha.beforeEach(() => {
		server = new Server(createIdentifier());
	});

	mocha.describe('Register Test', () => {
		const handlers = Array<RequestHandler>(3).fill((request, response, next) => {});
		const validateEndpoint = (endpoint: Endpoint, method: Method, path: string, paramKeys: Array<string>, handlers: Array<RequestHandler>) => {
			assert.deepStrictEqual(endpoint.method, method);
			assert.deepStrictEqual(endpoint.path, path);
			assert.notDeepStrictEqual(endpoint.regExp, undefined);
			assert.deepStrictEqual(endpoint.paramKeys, paramKeys);
			assert.deepStrictEqual(endpoint.handlers, handlers);
		};

		mocha.it('should register GET route', () => {
			server.get('');
			server.get('/', handlers[0]);
			server.get('/*/:a1/b/:b1/c/:c1/*/:d1', ...handlers);
			validateEndpoint(server.routes[0] as Endpoint, 'GET', '', [], []);
			validateEndpoint(server.routes[1] as Endpoint, 'GET', '/', [], [handlers[0]]);
			validateEndpoint(server.routes[2] as Endpoint, 'GET', '/*/:a1/b/:b1/c/:c1/*/:d1', ['a1', 'b1', 'c1', 'd1'], handlers);
			assert.deepStrictEqual(server.routes.length, 3);
		});

		mocha.it('should register POST route', () => {
			server.post('');
			server.post('/', handlers[0]);
			server.post('/*/:a1/b/:b1/c/:c1/*/:d1', ...handlers);
			validateEndpoint(server.routes[0] as Endpoint, 'POST', '', [], []);
			validateEndpoint(server.routes[1] as Endpoint, 'POST', '/', [], [handlers[0]]);
			validateEndpoint(server.routes[2] as Endpoint, 'POST', '/*/:a1/b/:b1/c/:c1/*/:d1', ['a1', 'b1', 'c1', 'd1'], handlers);
			assert.deepStrictEqual(server.routes.length, 3);
		});

		mocha.it('should register PUT route', () => {
			server.put('');
			server.put('/', handlers[0]);
			server.put('/*/:a1/b/:b1/c/:c1/*/:d1', ...handlers);
			validateEndpoint(server.routes[0] as Endpoint, 'PUT', '', [], []);
			validateEndpoint(server.routes[1] as Endpoint, 'PUT', '/', [], [handlers[0]]);
			validateEndpoint(server.routes[2] as Endpoint, 'PUT', '/*/:a1/b/:b1/c/:c1/*/:d1', ['a1', 'b1', 'c1', 'd1'], handlers);
			assert.deepStrictEqual(server.routes.length, 3);
		});

		mocha.it('should register PATCH route', () => {
			server.patch('');
			server.patch('/', handlers[0]);
			server.patch('/*/:a1/b/:b1/c/:c1/*/:d1', ...handlers);
			validateEndpoint(server.routes[0] as Endpoint, 'PATCH', '', [], []);
			validateEndpoint(server.routes[1] as Endpoint, 'PATCH', '/', [], [handlers[0]]);
			validateEndpoint(server.routes[2] as Endpoint, 'PATCH', '/*/:a1/b/:b1/c/:c1/*/:d1', ['a1', 'b1', 'c1', 'd1'], handlers);
			assert.deepStrictEqual(server.routes.length, 3);
		});

		mocha.it('should register DELETE route', () => {
			server.delete('');
			server.delete('/', handlers[0]);
			server.delete('/*/:a1/b/:b1/c/:c1/*/:d1', ...handlers);
			validateEndpoint(server.routes[0] as Endpoint, 'DELETE', '', [], []);
			validateEndpoint(server.routes[1] as Endpoint, 'DELETE', '/', [], [handlers[0]]);
			validateEndpoint(server.routes[2] as Endpoint, 'DELETE', '/*/:a1/b/:b1/c/:c1/*/:d1', ['a1', 'b1', 'c1', 'd1'], handlers);
			assert.deepStrictEqual(server.routes.length, 3);
		});

		mocha.it('should register ALL route', () => {
			server.all('');
			server.all('/', handlers[0]);
			server.all('/*/:a1/b/:b1/c/:c1/*/:d1', ...handlers);
			validateEndpoint(server.routes[0] as Endpoint, 'ALL', '', [], []);
			validateEndpoint(server.routes[1] as Endpoint, 'ALL', '/', [], [handlers[0]]);
			validateEndpoint(server.routes[2] as Endpoint, 'ALL', '/*/:a1/b/:b1/c/:c1/*/:d1', ['a1', 'b1', 'c1', 'd1'], handlers);
			assert.deepStrictEqual(server.routes.length, 3);
		});
	});

	mocha.describe('Mount Test', () => {
		const registerEndpoints = <R extends IRouter>(router: R) => {
			const handlers = Array<RequestHandler>(3).fill((request, response, next) => {});
			router.get('/endpoint1', ...handlers);
			router.post('/endpoint2', ...handlers);
			router.put('/endpoint3', ...handlers);
			router.patch('/endpoint4', ...handlers);
			router.delete('/endpoint5', ...handlers);
			router.all('/*', ...handlers);
		};

		mocha.it('should mount no router on empty path', () => {
			server.mount('');
			assert.deepStrictEqual((server.routes[0] as Stack).path, '');
			assert.notDeepStrictEqual((server.routes[0] as Stack).regExp, undefined);
			assert.deepStrictEqual((server.routes[0] as Stack).routes, []);
			assert.deepStrictEqual(server.routes.length, 1);
		});

		mocha.it('should mount single router on root path', () => {
			const router1 = new Router();
			server.mount('/', router1);
			assert.deepStrictEqual((server.routes[0] as Stack).path, '/');
			assert.notDeepStrictEqual((server.routes[0] as Stack).regExp, undefined);
			assert.deepStrictEqual((server.routes[0] as Stack).routes[0], router1.routes);
			assert.deepStrictEqual((server.routes[0] as Stack).routes[0].length, 0);
			assert.deepStrictEqual(server.routes.length, 1);
		});

		mocha.it('should mount single router on single path', () => {
			const router1 = new Router();
			registerEndpoints(router1);
			const router2 = new Router();
			server.mount('/path1', router1);
			server.mount('/path2', router2);
			assert.deepStrictEqual((server.routes[0] as Stack).path, '/path1');
			assert.notDeepStrictEqual((server.routes[0] as Stack).regExp, undefined);
			assert.deepStrictEqual((server.routes[0] as Stack).routes[0], router1.routes);
			assert.deepStrictEqual((server.routes[0] as Stack).routes[0].length, 6);
			assert.deepStrictEqual((server.routes[1] as Stack).path, '/path2');
			assert.notDeepStrictEqual((server.routes[1] as Stack).regExp, undefined);
			assert.deepStrictEqual((server.routes[1] as Stack).routes[0], router2.routes);
			assert.deepStrictEqual((server.routes[1] as Stack).routes[0].length, 0);
			assert.deepStrictEqual(server.routes.length, 2);
		});

		mocha.it('should mount multiple routers on single path', () => {
			const router1 = new Router();
			registerEndpoints(router1);
			const router2 = new Router();
			server.mount('/path1', router1, router2);
			assert.deepStrictEqual((server.routes[0] as Stack).path, '/path1');
			assert.notDeepStrictEqual((server.routes[0] as Stack).regExp, undefined);
			assert.deepStrictEqual((server.routes[0] as Stack).routes[0], router1.routes);
			assert.deepStrictEqual((server.routes[0] as Stack).routes[0].length, 6);
			assert.deepStrictEqual((server.routes[0] as Stack).routes[1], router2.routes);
			assert.deepStrictEqual((server.routes[0] as Stack).routes[1].length, 0);
			assert.deepStrictEqual((server.routes[0] as Stack).routes.length, 2);
			assert.deepStrictEqual(server.routes.length, 1);
		});

		mocha.it('should mount nested routers on single path', () => {
			const router1 = new Router();
			registerEndpoints(router1);
			const router2 = new Router();
			server.mount('/path1', router1);
			router1.mount('/path2', router2);
			assert.deepStrictEqual((server.routes[0] as Stack).path, '/path1');
			assert.notDeepStrictEqual((server.routes[0] as Stack).regExp, undefined);
			assert.deepStrictEqual((server.routes[0] as Stack).routes[0], router1.routes);
			assert.deepStrictEqual((server.routes[0] as Stack).routes[0].length, 6 + 1);
			assert.deepStrictEqual(((server.routes[0] as Stack).routes[0][6] as Stack).path, '/path2');
			assert.notDeepStrictEqual(((server.routes[0] as Stack).routes[0][6] as Stack).regExp, undefined);
			assert.deepStrictEqual(((server.routes[0] as Stack).routes[0][6] as Stack).routes[0], router2.routes);
			assert.deepStrictEqual(((server.routes[0] as Stack).routes[0][6] as Stack).routes[0].length, 0);
			assert.deepStrictEqual(server.routes.length, 1);
		});
	});

	mocha.describe('Dispatch Test', () => {
		let nextCalled: number;

		const nextHandler: RequestHandler = (request, response, next) => {
			nextCalled++;
			next();
		};

		const errorHandler: RequestHandler = (request, response, next) => {
			throw new Error('Should not be called');
		};

		mocha.beforeEach(async () => {
			nextCalled = 0;
			server.listen(port);
			await once(server, 'listening');
		});

		mocha.afterEach(async () => {
			server.close();
			await once(server, 'close');
		});

		mocha.it('should dispatch request to GET route', async () => {
			// Server
			server.all('/*', nextHandler);
			server.get('/endpoint/:param1', (request, response, next) => {
				assert.deepStrictEqual(nextCalled, 1);
				assert.deepStrictEqual(request.path, '/endpoint/1');
				assert.deepStrictEqual(request.params, { param1: '1' });
				assert.deepStrictEqual({ ...request.query }, { query1: '1' });
				request.pipe(response).writeHead(StatusCode.OK);
			});
			server.post('/endpoint/:param1', errorHandler);
			server.put('/endpoint/:param1', errorHandler);
			server.patch('/endpoint/:param1', errorHandler);
			server.delete('/endpoint/:param1', errorHandler);

			// Client
			const requestBody = createString(1000);
			const { response, body: responseBody } = await clientRequest(host, port, 'GET', '/endpoint/1?query1=1', requestBody);
			assert.deepStrictEqual(response.headers['x-server-identifier'], server.identifier);
			assert.deepStrictEqual(response.statusCode, StatusCode.OK);
			assert.deepStrictEqual(responseBody, requestBody);
		});

		mocha.it('should dispatch request to POST route', async () => {
			// Server
			server.all('/*', nextHandler);
			server.get('/endpoint/:param1', errorHandler);
			server.post('/endpoint/:param1', (request, response, next) => {
				assert.deepStrictEqual(nextCalled, 1);
				assert.deepStrictEqual(request.path, '/endpoint/1');
				assert.deepStrictEqual(request.params, { param1: '1' });
				assert.deepStrictEqual({ ...request.query }, { query1: '1' });
				request.pipe(response).writeHead(StatusCode.OK);
			});
			server.put('/endpoint/:param1', errorHandler);
			server.patch('/endpoint/:param1', errorHandler);
			server.delete('/endpoint/:param1', errorHandler);

			// Client
			const requestBody = createString(1000);
			const { response, body: responseBody } = await clientRequest(host, port, 'POST', '/endpoint/1?query1=1', requestBody);
			assert.deepStrictEqual(response.headers['x-server-identifier'], server.identifier);
			assert.deepStrictEqual(response.statusCode, StatusCode.OK);
			assert.deepStrictEqual(responseBody, requestBody);
		});

		mocha.it('should dispatch request to PUT route', async () => {
			// Server
			server.all('/*', nextHandler);
			server.get('/endpoint/:param1', errorHandler);
			server.post('/endpoint/:param1', errorHandler);
			server.put('/endpoint/:param1', (request, response, next) => {
				assert.deepStrictEqual(nextCalled, 1);
				assert.deepStrictEqual(request.path, '/endpoint/1');
				assert.deepStrictEqual(request.params, { param1: '1' });
				assert.deepStrictEqual({ ...request.query }, { query1: '1' });
				request.pipe(response).writeHead(StatusCode.OK);
			});
			server.patch('/endpoint/:param1', errorHandler);
			server.delete('/endpoint/:param1', errorHandler);

			// Client
			const requestBody = createString(1000);
			const { response, body: responseBody } = await clientRequest(host, port, 'PUT', '/endpoint/1?query1=1', requestBody);
			assert.deepStrictEqual(response.headers['x-server-identifier'], server.identifier);
			assert.deepStrictEqual(response.statusCode, StatusCode.OK);
			assert.deepStrictEqual(responseBody, requestBody);
		});

		mocha.it('should dispatch request to PATCH route', async () => {
			// Server
			server.all('/*', nextHandler);
			server.get('/endpoint/:param1', errorHandler);
			server.post('/endpoint/:param1', errorHandler);
			server.put('/endpoint/:param1', errorHandler);
			server.patch('/endpoint/:param1', (request, response, next) => {
				assert.deepStrictEqual(nextCalled, 1);
				assert.deepStrictEqual(request.path, '/endpoint/1');
				assert.deepStrictEqual(request.params, { param1: '1' });
				assert.deepStrictEqual({ ...request.query }, { query1: '1' });
				request.pipe(response).writeHead(StatusCode.OK);
			});
			server.delete('/endpoint/:param1', errorHandler);

			// Client
			const requestBody = createString(1000);
			const { response, body: responseBody } = await clientRequest(host, port, 'PATCH', '/endpoint/1?query1=1', requestBody);
			assert.deepStrictEqual(response.headers['x-server-identifier'], server.identifier);
			assert.deepStrictEqual(response.statusCode, StatusCode.OK);
			assert.deepStrictEqual(responseBody, requestBody);
		});

		mocha.it('should dispatch request to DELETE route', async () => {
			// Server
			server.all('/*', nextHandler);
			server.get('/endpoint/:param1', errorHandler);
			server.post('/endpoint/:param1', errorHandler);
			server.put('/endpoint/:param1', errorHandler);
			server.patch('/endpoint/:param1', errorHandler);
			server.delete('/endpoint/:param1', (request, response, next) => {
				assert.deepStrictEqual(nextCalled, 1);
				assert.deepStrictEqual(request.path, '/endpoint/1');
				assert.deepStrictEqual(request.params, { param1: '1' });
				assert.deepStrictEqual({ ...request.query }, { query1: '1' });
				request.pipe(response).writeHead(StatusCode.OK);
			});

			// Client
			const requestBody = createString(1000);
			const { response, body: responseBody } = await clientRequest(host, port, 'DELETE', '/endpoint/1?query1=1', requestBody);
			assert.deepStrictEqual(response.headers['x-server-identifier'], server.identifier);
			assert.deepStrictEqual(response.statusCode, StatusCode.OK);
			assert.deepStrictEqual(responseBody, requestBody);
		});

		mocha.it('should dispatch request to route with required parameters', async () => {
			// Server
			server.get('/endpoint/:param1/:param2/:param3/:param4', (request, response, next) => {
				assert.deepStrictEqual(request.path, '/endpoint/1/22/333/4444');
				assert.deepStrictEqual(request.params, { param1: '1', param2: '22', param3: '333', param4: '4444' });
				assert.deepStrictEqual({ ...request.query }, {});
				request.pipe(response).writeHead(StatusCode.OK);
			});

			// Client
			const requestBody = createString(1000);
			const { response, body: responseBody } = await clientRequest(host, port, 'GET', '/endpoint/1/22/333/4444', requestBody);
			assert.deepStrictEqual(response.headers['x-server-identifier'], server.identifier);
			assert.deepStrictEqual(response.statusCode, StatusCode.OK);
			assert.deepStrictEqual(responseBody, requestBody);
		});

		mocha.it('should dispatch request to route with optional parameters(provided)', async () => {
			// Server
			server.get('/endpoint/:param1?/:param2?/:param3?/:param4?', (request, response, next) => {
				assert.deepStrictEqual(request.path, '/endpoint/1/22/333/4444');
				assert.deepStrictEqual(request.params, { param1: '1', param2: '22', param3: '333', param4: '4444' });
				assert.deepStrictEqual({ ...request.query }, {});
				request.pipe(response).writeHead(StatusCode.OK);
			});

			// Client
			const requestBody = createString(1000);
			const { response, body: responseBody } = await clientRequest(host, port, 'GET', '/endpoint/1/22/333/4444', requestBody);
			assert.deepStrictEqual(response.headers['x-server-identifier'], server.identifier);
			assert.deepStrictEqual(response.statusCode, StatusCode.OK);
			assert.deepStrictEqual(responseBody, requestBody);
		});

		mocha.it('should dispatch request to route with optional parameters(missing)', async () => {
			// Server
			server.get('/endpoint/:param1?/:param2?/:param3?/:param4?', (request, response, next) => {
				assert.deepStrictEqual(request.path, '/endpoint/1//333/');
				assert.deepStrictEqual(request.params, { param1: '1', param2: undefined, param3: '333', param4: undefined });
				assert.deepStrictEqual({ ...request.query }, {});
				request.pipe(response).writeHead(StatusCode.OK);
			});

			// Client
			const requestBody = createString(1000);
			const { response, body: responseBody } = await clientRequest(host, port, 'GET', '/endpoint/1//333/', requestBody);
			assert.deepStrictEqual(response.headers['x-server-identifier'], server.identifier);
			assert.deepStrictEqual(response.statusCode, StatusCode.OK);
			assert.deepStrictEqual(responseBody, requestBody);
		});

		mocha.it('should dispatch request to route with query parameters(provided)', async () => {
			// Server
			server.get('/endpoint', (request, response, next) => {
				assert.deepStrictEqual(request.path, '/endpoint');
				assert.deepStrictEqual(request.params, {});
				assert.deepStrictEqual({ ...request.query }, { query1: '1', query2: '22', query3: '333', query4: '4444' });
				request.pipe(response).writeHead(StatusCode.OK);
			});

			// Client
			const requestBody = createString(1000);
			const { response, body: responseBody } = await clientRequest(host, port, 'GET', '/endpoint?query1=1&query2=22&query3=333&query4=4444', requestBody);
			assert.deepStrictEqual(response.headers['x-server-identifier'], server.identifier);
			assert.deepStrictEqual(response.statusCode, StatusCode.OK);
			assert.deepStrictEqual(responseBody, requestBody);
		});

		mocha.it('should dispatch request to route with query parameters(missing)', async () => {
			// Server
			server.get('/endpoint', (request, response, next) => {
				assert.deepStrictEqual(request.path, '/endpoint');
				assert.deepStrictEqual(request.params, {});
				assert.deepStrictEqual({ ...request.query }, { query1: '', query2: '', query3: '', query4: '' });
				request.pipe(response).writeHead(StatusCode.OK);
			});

			// Client
			const requestBody = createString(1000);
			const { response, body: responseBody } = await clientRequest(host, port, 'GET', '/endpoint?query1=&query2=&query3=&query4=', requestBody);
			assert.deepStrictEqual(response.headers['x-server-identifier'], server.identifier);
			assert.deepStrictEqual(response.statusCode, StatusCode.OK);
			assert.deepStrictEqual(responseBody, requestBody);
		});

		mocha.it('should dispatch request to route with wildcard path', async () => {
			// Server
			server.get('/e*/*/2*/3*/4*', nextHandler);
			server.get('/*t/*/*2/*3/*4', nextHandler);
			server.get('/endpoint/1/22/333/*4', nextHandler);
			server.get('/endpoint/1/22/3*4', nextHandler);
			server.get('/endpoint/1/2*4', nextHandler);
			server.get('/endpoint/1*4', nextHandler);
			server.get('/endpoint/*4', nextHandler);
			server.get('/e*4', nextHandler);
			server.get('/*', nextHandler);
			server.get('*', (request, response, next) => {
				assert.deepStrictEqual(nextCalled, 9);
				assert.deepStrictEqual(request.path, '/endpoint/1/22/333/4444');
				assert.deepStrictEqual(request.params, {});
				assert.deepStrictEqual({ ...request.query }, {});
				request.pipe(response).writeHead(StatusCode.OK);
			});

			// Client
			const requestBody = createString(1000);
			const { response, body: responseBody } = await clientRequest(host, port, 'GET', '/endpoint/1/22/333/4444', requestBody);
			assert.deepStrictEqual(response.headers['x-server-identifier'], server.identifier);
			assert.deepStrictEqual(response.statusCode, StatusCode.OK);
			assert.deepStrictEqual(responseBody, requestBody);
		});

		mocha.it('should dispatch request to route with long path', async () => {
			const longPath = '/endpoint'.repeat(1000);

			// Server
			server.get(longPath, (request, response, next) => {
				assert.deepStrictEqual(request.path, longPath);
				assert.deepStrictEqual(request.params, {});
				assert.deepStrictEqual({ ...request.query }, {});
				request.pipe(response).writeHead(StatusCode.OK);
			});

			// Client
			const requestBody = createString(1000);
			const { response, body: responseBody } = await clientRequest(host, port, 'GET', longPath, requestBody);
			assert.deepStrictEqual(response.headers['x-server-identifier'], server.identifier);
			assert.deepStrictEqual(response.statusCode, StatusCode.OK);
			assert.deepStrictEqual(responseBody, requestBody);
		});

		mocha.it('should dispatch request to route with trailing slashes in path', async () => {
			// Server
			server.get('/endpoint/', (request, response, next) => {
				assert.deepStrictEqual(request.path, '/endpoint');
				assert.deepStrictEqual(request.params, {});
				assert.deepStrictEqual({ ...request.query }, {});
				request.pipe(response).writeHead(StatusCode.OK);
			});

			// Client
			const requestBody = createString(1000);
			const { response, body: responseBody } = await clientRequest(host, port, 'GET', '/endpoint', requestBody);
			assert.deepStrictEqual(response.headers['x-server-identifier'], server.identifier);
			assert.deepStrictEqual(response.statusCode, StatusCode.OK);
			assert.deepStrictEqual(responseBody, requestBody);
		});

		mocha.it('should dispatch request to route with special characters in path', async () => {
			// Server
			server.get('/endpoint/:param1', (request, response, next) => {
				assert.deepStrictEqual(request.path, '/endpoint/special!@$%*([');
				assert.deepStrictEqual(request.params, { param1: 'special!@$%*([' });
				assert.deepStrictEqual({ ...request.query }, {});
				request.pipe(response).writeHead(StatusCode.OK);
			});

			// Client
			const requestBody = createString(1000);
			const { response, body: responseBody } = await clientRequest(host, port, 'GET', '/endpoint/special!@$%*([', requestBody);
			assert.deepStrictEqual(response.headers['x-server-identifier'], server.identifier);
			assert.deepStrictEqual(response.statusCode, StatusCode.OK);
			assert.deepStrictEqual(responseBody, requestBody);
		});

		mocha.it('should dispatch request to route with case sensitivity in path', async () => {
			// Server
			server.get('/EndPoint', errorHandler);
			server.get('/endpoint', (request, response, next) => {
				assert.deepStrictEqual(request.path, '/endpoint');
				assert.deepStrictEqual(request.params, {});
				assert.deepStrictEqual({ ...request.query }, {});
				request.pipe(response).writeHead(StatusCode.OK);
			});

			// Client
			const requestBody = createString(1000);
			const { response, body: responseBody } = await clientRequest(host, port, 'GET', '/endpoint', requestBody);
			assert.deepStrictEqual(response.headers['x-server-identifier'], server.identifier);
			assert.deepStrictEqual(response.statusCode, StatusCode.OK);
			assert.deepStrictEqual(responseBody, requestBody);
		});

		mocha.it('should dispatch request to route with multiple middleware in order', async () => {
			// Server
			const nextHandlers = Array();
			const firstMiddleware: RequestHandler = (request, response, next) => {
				nextHandlers.push('First');
				next();
			};
			const secondMiddleware: RequestHandler = (request, response, next) => {
				nextHandlers.push('Second');
				next();
			};
			server.get('/endpoint', firstMiddleware, secondMiddleware, (request, response, next) => {
				assert.deepStrictEqual(nextHandlers, ['First', 'Second']);
				assert.deepStrictEqual(request.path, '/endpoint');
				assert.deepStrictEqual(request.params, {});
				assert.deepStrictEqual({ ...request.query }, {});
				request.pipe(response).writeHead(StatusCode.OK);
			});

			// Client
			const requestBody = createString(1000);
			const { response, body: responseBody } = await clientRequest(host, port, 'GET', '/endpoint', requestBody);
			assert.deepStrictEqual(response.headers['x-server-identifier'], server.identifier);
			assert.deepStrictEqual(response.statusCode, StatusCode.OK);
			assert.deepStrictEqual(responseBody, requestBody);
		});

		mocha.it('should dispatch request to route with registration order', async () => {
			// Server
			server.get('/endpoint', (request, response, next) => {
				assert.deepStrictEqual(request.path, '/endpoint');
				assert.deepStrictEqual(request.params, {});
				assert.deepStrictEqual({ ...request.query }, {});
				request.pipe(response).writeHead(StatusCode.OK);
			});
			server.get('/endpoint/:param1', errorHandler);

			// Client
			const requestBody = createString(1000);
			const { response, body: responseBody } = await clientRequest(host, port, 'GET', '/endpoint', requestBody);
			assert.deepStrictEqual(response.headers['x-server-identifier'], server.identifier);
			assert.deepStrictEqual(response.statusCode, StatusCode.OK);
			assert.deepStrictEqual(responseBody, requestBody);
		});

		mocha.it('should dispatch request to overlapping routes', async () => {
			// Server
			server.get('/endpoint/:param1', (request, response, next) => {
				nextCalled++;
				assert.deepStrictEqual(request.path, '/endpoint/123');
				assert.deepStrictEqual(request.params, { param1: '123' });
				assert.deepStrictEqual({ ...request.query }, {});
				next();
			});
			server.get('/endpoint/123', (request, response, next) => {
				assert.deepStrictEqual(nextCalled, 1);
				assert.deepStrictEqual(request.path, '/endpoint/123');
				assert.deepStrictEqual(request.params, {});
				assert.deepStrictEqual({ ...request.query }, {});
				request.pipe(response).writeHead(StatusCode.OK);
			});

			// Client
			const requestBody = createString(1000);
			const { response, body: responseBody } = await clientRequest(host, port, 'GET', '/endpoint/123', requestBody);
			assert.deepStrictEqual(response.headers['x-server-identifier'], server.identifier);
			assert.deepStrictEqual(response.statusCode, StatusCode.OK);
			assert.deepStrictEqual(responseBody, requestBody);
		});

		mocha.it('should dispatch request to duplicate routes', async () => {
			// Server
			server.get('/endpoint', (request, response, next) => {
				nextCalled++;
				assert.deepStrictEqual(request.path, '/endpoint');
				assert.deepStrictEqual(request.params, {});
				assert.deepStrictEqual({ ...request.query }, {});
				next();
			});
			server.get('/endpoint', (request, response, next) => {
				assert.deepStrictEqual(nextCalled, 1);
				assert.deepStrictEqual(request.path, '/endpoint');
				assert.deepStrictEqual(request.params, {});
				assert.deepStrictEqual({ ...request.query }, {});
				request.pipe(response).writeHead(StatusCode.OK);
			});

			// Client
			const requestBody = createString(1000);
			const { response, body: responseBody } = await clientRequest(host, port, 'GET', '/endpoint', requestBody);
			assert.deepStrictEqual(response.headers['x-server-identifier'], server.identifier);
			assert.deepStrictEqual(response.statusCode, StatusCode.OK);
			assert.deepStrictEqual(responseBody, requestBody);
		});

		mocha.it('should dispatch request to router mounted on root path', async () => {
			// Server
			const router = new Router();
			router.get('/', (request, response, next) => {
				assert.deepStrictEqual(request.path, '/');
				assert.deepStrictEqual(request.params, {});
				assert.deepStrictEqual({ ...request.query }, {});
				request.pipe(response).writeHead(StatusCode.OK);
			});
			server.mount('/', router);

			// Client
			const requestBody = createString(1000);
			const { response, body: responseBody } = await clientRequest(host, port, 'GET', '/', requestBody);
			assert.deepStrictEqual(response.headers['x-server-identifier'], server.identifier);
			assert.deepStrictEqual(response.statusCode, StatusCode.OK);
			assert.deepStrictEqual(responseBody, requestBody);
		});

		mocha.it('should dispatch request to router mounted on single path', async () => {
			// Server
			const router1 = new Router();
			const router2 = new Router();
			const router3 = new Router();
			const router4 = new Router();
			router4.get('/endpoint', (request, response, next) => {
				assert.deepStrictEqual(request.path, '/endpoint');
				assert.deepStrictEqual(request.params, {});
				assert.deepStrictEqual({ ...request.query }, {});
				request.pipe(response).writeHead(StatusCode.OK);
			});
			server.mount('/', router1);
			router1.mount('/a', router2);
			router2.mount('/', router3);
			router3.mount('/b', router4);

			// Client
			const requestBody = createString(1000);
			const { response, body: responseBody } = await clientRequest(host, port, 'GET', '/a/b/endpoint', requestBody);
			assert.deepStrictEqual(response.headers['x-server-identifier'], server.identifier);
			assert.deepStrictEqual(response.statusCode, StatusCode.OK);
			assert.deepStrictEqual(responseBody, requestBody);
		});

		mocha.it('should dispatch request through routes & routers', async () => {
			// Server
			server.all('/a/e*t', nextHandler, nextHandler);
			server.post('/a/endpoint', errorHandler);
			server.get('/a/endpoint', nextHandler);
			const router1 = new Router();
			router1.all('/*/e*t', nextHandler, nextHandler);
			server.post('/a/endpoint', errorHandler);
			router1.get('/a/endpoint', nextHandler);
			const router2 = new Router();
			server.post('/endpoint', errorHandler);
			router2.all('/e*t', nextHandler, nextHandler);
			router2.get('/endpoint', nextHandler, (request, response, next) => {
				assert.deepStrictEqual(nextCalled, 9);
				assert.deepStrictEqual(request.path, '/endpoint');
				assert.deepStrictEqual(request.params, {});
				assert.deepStrictEqual({ ...request.query }, {});
				request.pipe(response).writeHead(StatusCode.OK);
			});
			server.mount('/', router1);
			router1.mount('/a', router2);

			// Client
			const requestBody = createString(1000);
			const { response, body: responseBody } = await clientRequest(host, port, 'GET', '/a/endpoint', requestBody);
			assert.deepStrictEqual(response.headers['x-server-identifier'], server.identifier);
			assert.deepStrictEqual(response.statusCode, StatusCode.OK);
			assert.deepStrictEqual(responseBody, requestBody);
		});
	});
});
