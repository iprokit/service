//Import Libs.
import mocha from 'mocha';
import assert from 'assert';
import { once } from 'events';
import http, { IncomingMessage } from 'http';

//Import Local.
import { HttpServer, Request, Response, NextFunction, HttpStatusCode } from '../lib';

const host = '127.0.0.1';
const port = 3000;

mocha.describe('HTTP Test', () => {
    mocha.describe('Constructor Test', () => {
        mocha.it('should construct server', (done) => {
            const server = new HttpServer();
            assert.notDeepStrictEqual(server, undefined);
            done();
        });
    });

    mocha.describe('Route Test', () => {
        let server: HttpServer;

        const nextHandler = (key: string) => {
            return (request: Request, response: Response, next: NextFunction) => {
                if ((response as any).body === undefined) (response as any).body = '';
                (response as any).body += key;
                next();
            }
        }

        const requestHandler = () => {
            return (request: Request, response: Response, next: NextFunction) => {
                response.writeHead(HttpStatusCode.OK).end(`${(response as any).body}-${request.query.x}${request.query.y}`);
            }
        }

        const request = (method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string) => {
            return new Promise<{ response: IncomingMessage, body: string }>((resolve, reject) => {
                const request = http.request({ host, port, method, path }, async (response) => {
                    try {
                        let body = '';
                        for await (const chunk of response) {
                            body += chunk;
                        }
                        resolve({ response, body });
                    } catch (error) {
                        reject(error);
                    }
                });
                request.end('');
            });
        }

        mocha.beforeEach(async () => {
            server = new HttpServer();
            server.all('*', nextHandler(''));
            server.get('/a/:id/*', nextHandler('a1'));
            server.get('/a/:id/b/:id/*', nextHandler('a2'));
            server.get('/a/:id/b/:id/c/:id', nextHandler('a3'));
            server.post('/a', nextHandler('a'));
            server.put('/b', nextHandler('b'));
            server.patch('/c', nextHandler('c'));
            server.delete('/d', nextHandler('d'));
            server.all('/*', requestHandler());
            server.listen(port);
            await once(server, 'listening');
        });

        mocha.afterEach(async () => {
            server.close();
            await once(server, 'close');
        });

        mocha.it('should respond to GET request', async () => {
            const { response, body } = await request('GET', '/a/1/b/2/c?x=1&y=1');
            assert.deepStrictEqual(response.statusCode, HttpStatusCode.OK);
            assert.deepStrictEqual(body, 'a1a2-11');
        });

        mocha.it('should respond to POST request', async () => {
            const { response, body } = await request('POST', '/a?x=2&y=2');
            assert.deepStrictEqual(response.statusCode, HttpStatusCode.OK);
            assert.deepStrictEqual(body, 'a-22');
        });

        mocha.it('should respond to PUT request', async () => {
            const { response, body } = await request('PUT', '/b?x=3&y=3');
            assert.deepStrictEqual(response.statusCode, HttpStatusCode.OK);
            assert.deepStrictEqual(body, 'b-33');
        });

        mocha.it('should respond to PATCH request', async () => {
            const { response, body } = await request('PATCH', '/c?x=4&y=4');
            assert.deepStrictEqual(response.statusCode, HttpStatusCode.OK);
            assert.deepStrictEqual(body, 'c-44');
        });

        mocha.it('should respond to DELETE request', async () => {
            const { response, body } = await request('DELETE', '/d?x=5&y=5');
            assert.deepStrictEqual(response.statusCode, HttpStatusCode.OK);
            assert.deepStrictEqual(body, 'd-55');
        });
    });

    mocha.describe('Proxy Test', () => {
        mocha.it('should proxy request with default path', () => {

        });
    });
});