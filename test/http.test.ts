//Import Libs.
import mocha from 'mocha';
import assert from 'assert';

//Import Local.
import { HttpServer, Router, Stack, Endpoint, HttpMethod, RequestHandler } from '../lib';
import { simulateRequest } from './util';

mocha.describe('HTTP Test', () => {
    let server: HttpServer;

    mocha.beforeEach((done) => {
        server = new HttpServer();
        done();
    });

    mocha.describe('Register Test', () => {
        const handlers = Array<RequestHandler>(3).fill((request, response, next) => { });
        const validateEndpoint = (endpoint: Endpoint, method: HttpMethod, path: string, paramKeys: Array<string>, handlers: Array<RequestHandler>) => {
            assert.deepStrictEqual(endpoint.method, method);
            assert.deepStrictEqual(endpoint.path, path);
            assert.notDeepStrictEqual(endpoint.regExp, undefined);
            assert.deepStrictEqual(endpoint.paramKeys, paramKeys);
            assert.deepStrictEqual(endpoint.handlers, handlers);
        }

        mocha.it('should register GET route', (done) => {
            server.get('');
            server.get('/', handlers[0]);
            server.get('/*/:a1/b/:b1/c/:c1/*/:d1', ...handlers);
            validateEndpoint(server.routes[0] as Endpoint, 'GET', '', [], []);
            validateEndpoint(server.routes[1] as Endpoint, 'GET', '/', [], [handlers[0]]);
            validateEndpoint(server.routes[2] as Endpoint, 'GET', '/*/:a1/b/:b1/c/:c1/*/:d1', ['a1', 'b1', 'c1', 'd1'], handlers);
            assert.deepStrictEqual(server.routes.length, 3);
            done();
        });

        mocha.it('should register POST route', (done) => {
            server.post('');
            server.post('/', handlers[0]);
            server.post('/*/:a1/b/:b1/c/:c1/*/:d1', ...handlers);
            validateEndpoint(server.routes[0] as Endpoint, 'POST', '', [], []);
            validateEndpoint(server.routes[1] as Endpoint, 'POST', '/', [], [handlers[0]]);
            validateEndpoint(server.routes[2] as Endpoint, 'POST', '/*/:a1/b/:b1/c/:c1/*/:d1', ['a1', 'b1', 'c1', 'd1'], handlers);
            assert.deepStrictEqual(server.routes.length, 3);
            done();
        });

        mocha.it('should register PUT route', (done) => {
            server.put('');
            server.put('/', handlers[0]);
            server.put('/*/:a1/b/:b1/c/:c1/*/:d1', ...handlers);
            validateEndpoint(server.routes[0] as Endpoint, 'PUT', '', [], []);
            validateEndpoint(server.routes[1] as Endpoint, 'PUT', '/', [], [handlers[0]]);
            validateEndpoint(server.routes[2] as Endpoint, 'PUT', '/*/:a1/b/:b1/c/:c1/*/:d1', ['a1', 'b1', 'c1', 'd1'], handlers);
            assert.deepStrictEqual(server.routes.length, 3);
            done();
        });

        mocha.it('should register PATCH route', (done) => {
            server.patch('');
            server.patch('/', handlers[0]);
            server.patch('/*/:a1/b/:b1/c/:c1/*/:d1', ...handlers);
            validateEndpoint(server.routes[0] as Endpoint, 'PATCH', '', [], []);
            validateEndpoint(server.routes[1] as Endpoint, 'PATCH', '/', [], [handlers[0]]);
            validateEndpoint(server.routes[2] as Endpoint, 'PATCH', '/*/:a1/b/:b1/c/:c1/*/:d1', ['a1', 'b1', 'c1', 'd1'], handlers);
            assert.deepStrictEqual(server.routes.length, 3);
            done();
        });

        mocha.it('should register DELETE route', (done) => {
            server.delete('');
            server.delete('/', handlers[0]);
            server.delete('/*/:a1/b/:b1/c/:c1/*/:d1', ...handlers);
            validateEndpoint(server.routes[0] as Endpoint, 'DELETE', '', [], []);
            validateEndpoint(server.routes[1] as Endpoint, 'DELETE', '/', [], [handlers[0]]);
            validateEndpoint(server.routes[2] as Endpoint, 'DELETE', '/*/:a1/b/:b1/c/:c1/*/:d1', ['a1', 'b1', 'c1', 'd1'], handlers);
            assert.deepStrictEqual(server.routes.length, 3);
            done();
        });

        mocha.it('should register ALL route', (done) => {
            server.all('');
            server.all('/', handlers[0]);
            server.all('/*/:a1/b/:b1/c/:c1/*/:d1', ...handlers);
            validateEndpoint(server.routes[0] as Endpoint, 'ALL', '', [], []);
            validateEndpoint(server.routes[1] as Endpoint, 'ALL', '/', [], [handlers[0]]);
            validateEndpoint(server.routes[2] as Endpoint, 'ALL', '/*/:a1/b/:b1/c/:c1/*/:d1', ['a1', 'b1', 'c1', 'd1'], handlers);
            assert.deepStrictEqual(server.routes.length, 3);
            done();
        });
    });

    mocha.describe('Mount Test', () => {
        const registerEndpoints = <R extends Router>(router: R) => {
            const handlers = Array<RequestHandler>(3).fill((request, response, next) => { });
            router.get('/endpoint1', ...handlers);
            router.post('/endpoint2', ...handlers);
            router.put('/endpoint3', ...handlers);
            router.patch('/endpoint4', ...handlers);
            router.delete('/endpoint5', ...handlers);
            router.all('/*', ...handlers);
        }

        mocha.it('should mount no router on empty path', (done) => {
            server.mount('');
            assert.deepStrictEqual((server.routes[0] as Stack).path, '');
            assert.notDeepStrictEqual((server.routes[0] as Stack).regExp, undefined);
            assert.deepStrictEqual((server.routes[0] as Stack).routes, []);
            assert.deepStrictEqual(server.routes.length, 1);
            done();
        });

        mocha.it('should mount single router on root path', (done) => {
            const router1 = server.Route();
            server.mount('/', router1);
            assert.deepStrictEqual((server.routes[0] as Stack).path, '/');
            assert.notDeepStrictEqual((server.routes[0] as Stack).regExp, undefined);
            assert.deepStrictEqual((server.routes[0] as Stack).routes[0], router1.routes);
            assert.deepStrictEqual((server.routes[0] as Stack).routes[0].length, 0);
            assert.deepStrictEqual(server.routes.length, 1);
            done();
        });

        mocha.it('should mount single router on single path', (done) => {
            const router1 = server.Route();
            registerEndpoints(router1);
            const router2 = server.Route();
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
            done();
        });

        mocha.it('should mount multiple routers on single path', (done) => {
            const router1 = server.Route();
            registerEndpoints(router1);
            const router2 = server.Route();
            server.mount('/path1', router1, router2);
            assert.deepStrictEqual((server.routes[0] as Stack).path, '/path1');
            assert.notDeepStrictEqual((server.routes[0] as Stack).regExp, undefined);
            assert.deepStrictEqual((server.routes[0] as Stack).routes[0], router1.routes);
            assert.deepStrictEqual((server.routes[0] as Stack).routes[0].length, 6);
            assert.deepStrictEqual((server.routes[0] as Stack).routes[1], router2.routes);
            assert.deepStrictEqual((server.routes[0] as Stack).routes[1].length, 0);
            assert.deepStrictEqual((server.routes[0] as Stack).routes.length, 2);
            assert.deepStrictEqual(server.routes.length, 1);
            done();
        });

        mocha.it('should mount nested routers on single path', (done) => {
            const router1 = server.Route();
            registerEndpoints(router1);
            const router2 = server.Route();
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
            done();
        });
    });

    mocha.describe('Dispatch Test', () => {
        let nextCalled: number;

        const nextHandler: RequestHandler = (request, response, next) => {
            nextCalled++;
            next();
        }

        const errorHandler: RequestHandler = (request, response, next) => {
            throw new Error('Should not be called');
        }

        mocha.beforeEach((done) => {
            nextCalled = 0;
            done();
        });

        mocha.it('should dispatch request to GET route', (done) => {
            //Server
            server.all('/*', nextHandler);
            server.get('/endpoint/:param1', (request, response, next) => {
                assert.deepStrictEqual(nextCalled, 1);
                assert.deepStrictEqual(request.path, '/endpoint/1');
                assert.deepStrictEqual(request.params, { param1: '1' });
                assert.deepStrictEqual({ ...request.query }, { query1: '1' });
                done();
            });
            server.post('/endpoint/:param1', errorHandler);
            server.put('/endpoint/:param1', errorHandler);
            server.patch('/endpoint/:param1', errorHandler);
            server.delete('/endpoint/:param1', errorHandler);

            //Client
            simulateRequest(server, 'GET', '/endpoint/1?query1=1');
        });

        mocha.it('should dispatch request to POST route', (done) => {
            //Server
            server.all('/*', nextHandler);
            server.get('/endpoint/:param1', errorHandler);
            server.post('/endpoint/:param1', (request, response, next) => {
                assert.deepStrictEqual(nextCalled, 1);
                assert.deepStrictEqual(request.path, '/endpoint/1');
                assert.deepStrictEqual(request.params, { param1: '1' });
                assert.deepStrictEqual({ ...request.query }, { query1: '1' });
                done();
            });
            server.put('/endpoint/:param1', errorHandler);
            server.patch('/endpoint/:param1', errorHandler);
            server.delete('/endpoint/:param1', errorHandler);

            //Client
            simulateRequest(server, 'POST', '/endpoint/1?query1=1');
        });

        mocha.it('should dispatch request to PUT route', (done) => {
            //Server
            server.all('/*', nextHandler);
            server.get('/endpoint/:param1', errorHandler);
            server.post('/endpoint/:param1', errorHandler);
            server.put('/endpoint/:param1', (request, response, next) => {
                assert.deepStrictEqual(nextCalled, 1);
                assert.deepStrictEqual(request.path, '/endpoint/1');
                assert.deepStrictEqual(request.params, { param1: '1' });
                assert.deepStrictEqual({ ...request.query }, { query1: '1' });
                done();
            });
            server.patch('/endpoint/:param1', errorHandler);
            server.delete('/endpoint/:param1', errorHandler);

            //Client
            simulateRequest(server, 'PUT', '/endpoint/1?query1=1');
        });

        mocha.it('should dispatch request to PATCH route', (done) => {
            //Server
            server.all('/*', nextHandler);
            server.get('/endpoint/:param1', errorHandler);
            server.post('/endpoint/:param1', errorHandler);
            server.put('/endpoint/:param1', errorHandler);
            server.patch('/endpoint/:param1', (request, response, next) => {
                assert.deepStrictEqual(nextCalled, 1);
                assert.deepStrictEqual(request.path, '/endpoint/1');
                assert.deepStrictEqual(request.params, { param1: '1' });
                assert.deepStrictEqual({ ...request.query }, { query1: '1' });
                done();
            });
            server.delete('/endpoint/:param1', errorHandler);

            //Client
            simulateRequest(server, 'PATCH', '/endpoint/1?query1=1');
        });

        mocha.it('should dispatch request to DELETE route', (done) => {
            //Server
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
                done();
            });

            //Client
            simulateRequest(server, 'DELETE', '/endpoint/1?query1=1');
        });

        mocha.it('should dispatch request to route with required parameters', (done) => {
            //Server
            server.get('/endpoint/:param1/:param2/:param3/:param4', (request, response, next) => {
                assert.deepStrictEqual(request.path, '/endpoint/1/22/333/4444');
                assert.deepStrictEqual(request.params, { param1: '1', param2: '22', param3: '333', param4: '4444' });
                assert.deepStrictEqual({ ...request.query }, {});
                done();
            });

            //Client
            simulateRequest(server, 'GET', '/endpoint/1/22/333/4444');
        });

        mocha.it('should dispatch request to route with optional parameters(provided)', (done) => {
            //Server
            server.get('/endpoint/:param1?/:param2?/:param3?/:param4?', (request, response, next) => {
                assert.deepStrictEqual(request.path, '/endpoint/1/22/333/4444');
                assert.deepStrictEqual(request.params, { param1: '1', param2: '22', param3: '333', param4: '4444' });
                assert.deepStrictEqual({ ...request.query }, {});
                done();
            });

            //Client
            simulateRequest(server, 'GET', '/endpoint/1/22/333/4444');
        });

        mocha.it('should dispatch request to route with optional parameters(missing)', (done) => {
            //Server
            server.get('/endpoint/:param1?/:param2?/:param3?/:param4?', (request, response, next) => {
                assert.deepStrictEqual(request.path, '/endpoint/1//333/');
                assert.deepStrictEqual(request.params, { param1: '1', param2: undefined, param3: '333', param4: undefined });
                assert.deepStrictEqual({ ...request.query }, {});
                done();
            });

            //Client
            simulateRequest(server, 'GET', '/endpoint/1//333/');
        });

        mocha.it('should dispatch request to route with query parameters(provided)', (done) => {
            //Server
            server.get('/endpoint', (request, response, next) => {
                assert.deepStrictEqual(request.path, '/endpoint');
                assert.deepStrictEqual(request.params, {});
                assert.deepStrictEqual({ ...request.query }, { query1: '1', query2: '22', query3: '333', query4: '4444' });
                done();
            });

            //Client
            simulateRequest(server, 'GET', '/endpoint?query1=1&query2=22&query3=333&query4=4444');
        });

        mocha.it('should dispatch request to route with query parameters(missing)', (done) => {
            //Server
            server.get('/endpoint', (request, response, next) => {
                assert.deepStrictEqual(request.path, '/endpoint');
                assert.deepStrictEqual(request.params, {});
                assert.deepStrictEqual({ ...request.query }, { query1: '', query2: '', query3: '', query4: '' });
                done();
            });

            //Client
            simulateRequest(server, 'GET', '/endpoint?query1=&query2=&query3=&query4=');
        });

        mocha.it('should dispatch request to route with wildcard path', (done) => {
            //Server
            server.get('/endpoint/*', (request, response, next) => {
                assert.deepStrictEqual(request.path, '/endpoint/1/22/333/4444');
                assert.deepStrictEqual(request.params, {});
                assert.deepStrictEqual({ ...request.query }, {});
                done();
            });

            //Client
            simulateRequest(server, 'GET', '/endpoint/1/22/333/4444');
        });

        mocha.it('should dispatch request to route with long path', (done) => {
            const longPath = '/endpoint'.repeat(1000);

            //Server
            server.get(longPath, (request, response, next) => {
                assert.deepStrictEqual(request.path, longPath);
                assert.deepStrictEqual(request.params, {});
                assert.deepStrictEqual({ ...request.query }, {});
                done();
            });

            //Client
            simulateRequest(server, 'GET', longPath);
        });

        mocha.it('should dispatch request to route with trailing slashes in path', (done) => {
            //Server
            server.get('/endpoint/', (request, response, next) => {
                assert.deepStrictEqual(request.path, '/endpoint');
                assert.deepStrictEqual(request.params, {});
                assert.deepStrictEqual({ ...request.query }, {});
                done();
            });

            //Client
            simulateRequest(server, 'GET', '/endpoint');
        });

        mocha.it('should dispatch request to route with special characters in path', (done) => {
            //Server
            server.get('/endpoint/:param1', (request, response, next) => {
                assert.deepStrictEqual(request.path, '/endpoint/special!@$%*([');
                assert.deepStrictEqual(request.params, { param1: 'special!@$%*([' });
                assert.deepStrictEqual({ ...request.query }, {});
                done();
            });

            //Client
            simulateRequest(server, 'GET', '/endpoint/special!@$%*([');
        });

        mocha.it('should dispatch request to route with case sensitivity in path', (done) => {
            //Server
            server.get('/EndPoint', errorHandler);
            server.get('/endpoint', (request, response, next) => {
                assert.deepStrictEqual(request.path, '/endpoint');
                assert.deepStrictEqual(request.params, {});
                assert.deepStrictEqual({ ...request.query }, {});
                done();
            });

            //Client
            simulateRequest(server, 'GET', '/endpoint');
        });

        mocha.it('should dispatch request to route with multiple middleware in order', (done) => {
            //Server
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
                done();
            });

            //Client
            simulateRequest(server, 'GET', '/endpoint');
        });

        mocha.it('should dispatch request to route with registration order', (done) => {
            //Server
            server.get('/endpoint', (request, response, next) => {
                assert.deepStrictEqual(request.path, '/endpoint');
                assert.deepStrictEqual(request.params, {});
                assert.deepStrictEqual({ ...request.query }, {});
                done();
            });
            server.get('/endpoint/:param1', errorHandler);

            //Client
            simulateRequest(server, 'GET', '/endpoint');
        });

        mocha.it('should dispatch request to overlapping routes', (done) => {
            //Server
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
                done();
            });

            //Client
            simulateRequest(server, 'GET', '/endpoint/123');
        });

        mocha.it('should dispatch request to duplicate routes', (done) => {
            //Server
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
                done();
            });

            //Client
            simulateRequest(server, 'GET', '/endpoint');
        });

        mocha.it('should dispatch request to router mounted on root path', (done) => {
            //Server
            const router = server.Route();
            router.get('/endpoint', (request, response, next) => {
                assert.deepStrictEqual(request.path, '/endpoint');
                assert.deepStrictEqual(request.params, {});
                assert.deepStrictEqual({ ...request.query }, {});
                done();
            });
            server.mount('/', router);

            // Client
            simulateRequest(server, 'GET', '/endpoint');
        });

        mocha.it('should dispatch request to router mounted on single path', (done) => {
            //Server
            const router1 = server.Route();
            const router2 = server.Route();
            const router3 = server.Route();
            const router4 = server.Route();
            router4.get('/endpoint', (request, response, next) => {
                assert.deepStrictEqual(request.path, '/endpoint');
                assert.deepStrictEqual(request.params, {});
                assert.deepStrictEqual({ ...request.query }, {});
                done();
            });
            server.mount('/', router1);
            router1.mount('/a', router2);
            router2.mount('/', router3);
            router3.mount('/b', router4);

            // Client
            simulateRequest(server, 'GET', '/a/b/endpoint');
        });
    });
});