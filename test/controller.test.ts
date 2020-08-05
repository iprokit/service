//Import Libs.
import mocha from 'mocha';
import assert from 'assert';
import { Request, Response } from 'express';

//Import Local.
import Service from '../lib/service';
import { ConnectionOptions } from '../lib/db.manager';
import RDBModel, { RDBDataTypes, RDBModelAttributes } from '../lib/db.rdb.model';
import NoSQLModel, { NoSQLModelAttributes, NoSQLDataTypes } from '../lib/db.nosql.model';
import Controller from '../lib/controller';
import HttpStatusCodes from '../lib/http.statusCodes';
import Helper from '../lib/helper';

//Import Util.
import { setTimeoutAsync, silentLog, httpRequest, HttpOptions } from './util';

const logPath = '/Users/iprotechs/Desktop/logs';

const rdbOptions: ConnectionOptions = {
    name: 'rutvik_promicro',
    type: 'mysql',
    host: 'stage-elb-internet-664379967.ap-south-1.elb.amazonaws.com',
    username: 'rutvik',
    password: 'Pr0m1cr@2020'
}

const noSQLOptions: ConnectionOptions = {
    name: 'PoC',
    type: 'mongo',
    host: 'stage-elb-internet-664379967.ap-south-1.elb.amazonaws.com',
    username: 'admin',
    password: 'c3r1stm3s'
}

mocha.describe('Controller Test', () => {
    mocha.describe('RDB: CRUD Operations Test', () => {
        const db: ConnectionOptions = {
            name: rdbOptions.name,
            type: rdbOptions.type,
            host: rdbOptions.host,
            username: rdbOptions.username,
            password: rdbOptions.password
        }
        const service = new Service({ name: 'HeroSVC', db: db, logPath: logPath });
        silentLog(service);

        //Define & Initialize Model
        class HeroModel extends RDBModel { }
        const heroAttributes: RDBModelAttributes = {
            name: {
                type: RDBDataTypes.STRING(30),
                allowNull: false
            }
        }
        service.dbManager.initModel('Hero', 'HeroTable', heroAttributes, HeroModel);

        //Define & Initialize Controller
        class HeroController extends Controller {
            constructor() {
                super(HeroModel);
            }
            public async create(request: Request, response: Response) {
                super.create(request, response);
            }
            public async getAll(request: Request, response: Response) {
                super.getAll(request, response);
            }
            public async getOneByID(request: Request, response: Response) {
                super.getOneByID(request, response);
            }
            public async updateOneByID(request: Request, response: Response) {
                super.updateOneByID(request, response);
            }
            public async deleteOneByID(request: Request, response: Response) {
                super.deleteOneByID(request, response);
            }
        }
        const heroController = new HeroController();
        const heroRouter = service.createRouter('/hero');
        heroRouter.post('/', Helper.bind(heroController.create, heroController));
        heroRouter.get('/', Helper.bind(heroController.getAll, heroController));
        heroRouter.get('/:id', Helper.bind(heroController.getOneByID, heroController));
        heroRouter.put('/:id', Helper.bind(heroController.updateOneByID, heroController));
        heroRouter.delete('/:id', Helper.bind(heroController.deleteOneByID, heroController));

        mocha.before(function (done) {
            this.timeout(1000 * 60);
            service.start(async (error) => {
                assert.deepStrictEqual(error, undefined);

                const sync = await service.dbManager.sync(true);
                assert.deepStrictEqual(sync, true);

                done();
            });
        });

        mocha.after((done) => {
            service.stop(done);
        });

        mocha.describe('#create() Test', () => {
            let options: HttpOptions = { host: '127.0.0.1', port: 3000, method: 'POST', path: '/hero', body: {}, json: true };
            options.headers = { 'Content-Type': 'application/json' };

            mocha.it('should execute POST(/hero) and receive body(JSON) with CORS support', (done) => {
                options.body = { name: 'Iron Man' };
                httpRequest(options, async (response, error) => {
                    assert.deepStrictEqual(response.headers['access-control-allow-origin'], '*');
                    assert.deepStrictEqual(response.statusCode, HttpStatusCodes.CREATED);
                    assert.deepStrictEqual(response.body.id, 1); //id: 1

                    await setTimeoutAsync(1000 * 2);
                    options.body = { name: 'Thor' };
                    httpRequest(options, async (response, error) => {
                        assert.deepStrictEqual(response.headers['access-control-allow-origin'], '*');
                        assert.deepStrictEqual(response.statusCode, HttpStatusCodes.CREATED);
                        assert.deepStrictEqual(response.body.id, 2); //id: 2

                        await setTimeoutAsync(1000 * 2);
                        options.body = { name: 'Wasp' };
                        httpRequest(options, async (response, error) => {
                            assert.deepStrictEqual(response.headers['access-control-allow-origin'], '*');
                            assert.deepStrictEqual(response.statusCode, HttpStatusCodes.CREATED);
                            assert.deepStrictEqual(response.body.id, 3); //id: 3

                            await setTimeoutAsync(1000 * 2);
                            options.body = { name: 'Ant-Man' };
                            httpRequest(options, async (response, error) => {
                                assert.deepStrictEqual(response.headers['access-control-allow-origin'], '*');
                                assert.deepStrictEqual(response.statusCode, HttpStatusCodes.CREATED);
                                assert.deepStrictEqual(response.body.id, 4); //id: 4

                                await setTimeoutAsync(1000 * 2);
                                options.body = { name: 'Hulk' };
                                httpRequest(options, async (response, error) => {
                                    assert.deepStrictEqual(response.headers['access-control-allow-origin'], '*');
                                    assert.deepStrictEqual(response.statusCode, HttpStatusCodes.CREATED);
                                    assert.deepStrictEqual(response.body.id, 5); //id: 5

                                    await setTimeoutAsync(1000 * 2);
                                    options.body = { name: 'Vision' };
                                    httpRequest(options, async (response, error) => {
                                        assert.deepStrictEqual(response.headers['access-control-allow-origin'], '*');
                                        assert.deepStrictEqual(response.statusCode, HttpStatusCodes.CREATED);
                                        assert.deepStrictEqual(response.body.id, 6); //id: 6

                                        await setTimeoutAsync(1000 * 2);
                                        done();
                                    });
                                });
                            });
                        });
                    });
                });
            }).timeout(1000 * 60);
        });

        mocha.describe('#getOneByID() Test', () => {
            const options: HttpOptions = { host: '127.0.0.1', port: 3000, method: 'GET', path: '/hero/4', body: {}, json: true };
            options.headers = { 'Content-Type': 'application/json' };

            mocha.it('should execute GET(/hero/:id) with valid id and receive body(JSON) with CORS support', (done) => {
                options.path = '/hero/4';
                httpRequest(options, (response, error) => {
                    assert.deepStrictEqual(response.headers['access-control-allow-origin'], '*');
                    assert.deepStrictEqual(response.statusCode, HttpStatusCodes.OK);
                    assert.deepStrictEqual(response.body.id, 4);
                    assert.deepStrictEqual(response.body.name, 'Ant-Man');
                    assert.notDeepStrictEqual(response.body.createdAt, undefined);
                    assert.notDeepStrictEqual(response.body.updatedAt, undefined);
                    done();
                });
            }).timeout(1000 * 60);

            mocha.it('should execute GET(/hero/:id) with invalid id and receive body(Empty JSON) with CORS support', (done) => {
                options.path = '/hero/40';
                httpRequest(options, (response, error) => {
                    assert.deepStrictEqual(response.headers['access-control-allow-origin'], '*');
                    assert.deepStrictEqual(response.statusCode, HttpStatusCodes.OK);
                    assert.deepStrictEqual(response.body, {});
                    done();
                });
            }).timeout(1000 * 60);
        });

        mocha.describe('#updateOneByID() Test', () => {
            const options: HttpOptions = { host: '127.0.0.1', port: 3000, method: 'PUT', path: '/hero/4', body: { name: 'Ant Man' }, json: true };
            options.headers = { 'Content-Type': 'application/json' };

            mocha.it('should execute PUT(/hero/:id) with valid id and receive body(True JSON) with CORS support', (done) => {
                options.path = '/hero/4';
                httpRequest(options, (response, error) => {
                    assert.deepStrictEqual(response.headers['access-control-allow-origin'], '*');
                    assert.deepStrictEqual(response.statusCode, HttpStatusCodes.OK);
                    assert.deepStrictEqual(response.body, { updated: true });
                    done();
                });
            }).timeout(1000 * 60);

            mocha.it('should execute PUT(/hero/:id) with invalid id and receive body(False JSON) with CORS support', (done) => {
                options.path = '/hero/40';
                httpRequest(options, (response, error) => {
                    assert.deepStrictEqual(response.headers['access-control-allow-origin'], '*');
                    assert.deepStrictEqual(response.statusCode, HttpStatusCodes.OK);
                    assert.deepStrictEqual(response.body, { updated: false });
                    done();
                });
            }).timeout(1000 * 60);
        });

        mocha.describe('#deleteOneByID() Test', () => {
            const options: HttpOptions = { host: '127.0.0.1', port: 3000, method: 'DELETE', path: '/hero/6', body: {}, json: true };
            options.headers = { 'Content-Type': 'application/json' };

            mocha.it('should execute DELETE(/hero/:id) with valid id and receive body(True JSON) with CORS support', (done) => {
                options.path = '/hero/6';
                httpRequest(options, (response, error) => {
                    assert.deepStrictEqual(response.headers['access-control-allow-origin'], '*');
                    assert.deepStrictEqual(response.statusCode, HttpStatusCodes.OK);
                    assert.deepStrictEqual(response.body, { deleted: true });
                    done();
                });
            }).timeout(1000 * 60);

            mocha.it('should execute DELETE(/hero/:id) with invalid id and receive body(False JSON) with CORS support', (done) => {
                options.path = '/hero/60';
                httpRequest(options, (response, error) => {
                    assert.deepStrictEqual(response.headers['access-control-allow-origin'], '*');
                    assert.deepStrictEqual(response.statusCode, HttpStatusCodes.OK);
                    assert.deepStrictEqual(response.body, { deleted: false });
                    done();
                });
            }).timeout(1000 * 60);
        });

        mocha.describe('#getAll() Test', () => {
            const options: HttpOptions = { host: '127.0.0.1', port: 3000, method: 'GET', path: '/hero', body: {}, json: true };
            options.headers = { 'Content-Type': 'application/json' };

            mocha.it('should execute GET(/hero) and receive body(JSON) with CORS support', (done) => {
                options.path = '/hero';
                httpRequest(options, (response, error) => {
                    assert.deepStrictEqual(response.headers['access-control-allow-origin'], '*');
                    assert.deepStrictEqual(response.statusCode, HttpStatusCodes.OK);
                    assert.deepStrictEqual(response.body.length, 5);
                    assert.deepStrictEqual(response.body[0].name, 'Hulk');
                    assert.deepStrictEqual(response.body[1].name, 'Ant Man');
                    assert.deepStrictEqual(response.body[2].name, 'Wasp');
                    assert.deepStrictEqual(response.body[3].name, 'Thor');
                    assert.deepStrictEqual(response.body[4].name, 'Iron Man');
                    done();
                });
            }).timeout(1000 * 60);

            mocha.it('should execute GET(/hero/?order=new) and receive body(JSON) with CORS support', (done) => {
                options.path = '/hero/?order=new';
                httpRequest(options, (response, error) => {
                    assert.deepStrictEqual(response.headers['access-control-allow-origin'], '*');
                    assert.deepStrictEqual(response.statusCode, HttpStatusCodes.OK);
                    assert.deepStrictEqual(response.body.length, 5);
                    assert.deepStrictEqual(response.body[0].name, 'Hulk');
                    assert.deepStrictEqual(response.body[1].name, 'Ant Man');
                    assert.deepStrictEqual(response.body[2].name, 'Wasp');
                    assert.deepStrictEqual(response.body[3].name, 'Thor');
                    assert.deepStrictEqual(response.body[4].name, 'Iron Man');
                    done();
                });
            }).timeout(1000 * 60);

            mocha.it('should execute GET(/hero/?order=old) and receive body(JSON) with CORS support', (done) => {
                options.path = '/hero/?order=old';
                httpRequest(options, (response, error) => {
                    assert.deepStrictEqual(response.headers['access-control-allow-origin'], '*');
                    assert.deepStrictEqual(response.statusCode, HttpStatusCodes.OK);
                    assert.deepStrictEqual(response.body.length, 5);
                    assert.deepStrictEqual(response.body[0].name, 'Iron Man');
                    assert.deepStrictEqual(response.body[1].name, 'Thor');
                    assert.deepStrictEqual(response.body[2].name, 'Wasp');
                    assert.deepStrictEqual(response.body[3].name, 'Ant Man');
                    assert.deepStrictEqual(response.body[4].name, 'Hulk');
                    done();
                });
            }).timeout(1000 * 60);

            mocha.it('should execute GET(/hero/?page=1) and receive body(JSON) with CORS support', (done) => {
                options.path = '/hero/?page=1';
                httpRequest(options, (response, error) => {
                    assert.deepStrictEqual(response.headers['access-control-allow-origin'], '*');
                    assert.deepStrictEqual(response.statusCode, HttpStatusCodes.OK);
                    assert.deepStrictEqual(response.body.length, 0);
                    done();
                });
            }).timeout(1000 * 60);

            mocha.it('should execute GET(/hero/?pageSize=1) and receive body(JSON) with CORS support', (done) => {
                options.path = '/hero/?pageSize=1';
                httpRequest(options, (response, error) => {
                    assert.deepStrictEqual(response.headers['access-control-allow-origin'], '*');
                    assert.deepStrictEqual(response.statusCode, HttpStatusCodes.OK);
                    assert.deepStrictEqual(response.body.length, 1);
                    assert.deepStrictEqual(response.body[0].name, 'Hulk');
                    done();
                });
            }).timeout(1000 * 60);

            mocha.it('should execute GET(/hero/?page=1&pageSize=1) and receive body(JSON) with CORS support', (done) => {
                options.path = '/hero/?page=1&pageSize=1';
                httpRequest(options, (response, error) => {
                    assert.deepStrictEqual(response.headers['access-control-allow-origin'], '*');
                    assert.deepStrictEqual(response.statusCode, HttpStatusCodes.OK);
                    assert.deepStrictEqual(response.body.length, 1);
                    assert.deepStrictEqual(response.body[0].name, 'Ant Man');
                    done();
                });
            }).timeout(1000 * 60);
        });
    });

    mocha.describe('NoSQL: CRUD Operations Test', () => {
        const db: ConnectionOptions = {
            name: noSQLOptions.name,
            type: noSQLOptions.type,
            host: noSQLOptions.host,
            username: noSQLOptions.username,
            password: noSQLOptions.password
        }
        const service = new Service({ name: 'HeroSVC', db: db, logPath: logPath });
        silentLog(service);

        class HeroModel extends NoSQLModel { }
        const heroAttributes: NoSQLModelAttributes = {
            name: {
                type: String,
                trim: true,
                required: true
            }
        }
        service.dbManager.initModel('Hero', 'HeroCollection', heroAttributes, HeroModel);

        //Define & Initialize Controller
        class HeroController extends Controller {
            constructor() {
                super(HeroModel);
            }
            public async create(request: Request, response: Response) {
                super.create(request, response);
            }
            public async getAll(request: Request, response: Response) {
                super.getAll(request, response);
            }
            public async getOneByID(request: Request, response: Response) {
                super.getOneByID(request, response);
            }
            public async updateOneByID(request: Request, response: Response) {
                super.updateOneByID(request, response);
            }
            public async deleteOneByID(request: Request, response: Response) {
                super.deleteOneByID(request, response);
            }
        }
        const heroController = new HeroController();
        const heroRouter = service.createRouter('/hero');
        heroRouter.post('/', Helper.bind(heroController.create, heroController));
        heroRouter.get('/', Helper.bind(heroController.getAll, heroController));
        heroRouter.get('/:id', Helper.bind(heroController.getOneByID, heroController));
        heroRouter.put('/:id', Helper.bind(heroController.updateOneByID, heroController));
        heroRouter.delete('/:id', Helper.bind(heroController.deleteOneByID, heroController));

        mocha.before(function (done) {
            this.timeout(1000 * 60);
            service.start(async (error) => {
                assert.deepStrictEqual(error, undefined);

                const sync = await service.dbManager.sync(true);
                assert.deepStrictEqual(sync, true);

                done();
            });
        });

        mocha.after((done) => {
            service.stop(done);
        });

        const randomId = '5f28ca9e65af907654c1c6f9';
        let antmanId: NoSQLDataTypes.ObjectId;
        let visionId: NoSQLDataTypes.ObjectId;

        mocha.describe('#create() Test', () => {
            const options: HttpOptions = { host: '127.0.0.1', port: 3000, method: 'POST', path: '/hero', body: {}, json: true };
            options.headers = { 'Content-Type': 'application/json' };

            mocha.it('should execute POST(/hero) and receive body(JSON) with CORS support', (done) => {
                options.body = { name: 'Iron Man' };
                httpRequest(options, async (response, error) => {
                    assert.deepStrictEqual(response.headers['access-control-allow-origin'], '*');
                    assert.deepStrictEqual(response.statusCode, HttpStatusCodes.CREATED);
                    assert.notDeepStrictEqual(response.body[0].id, undefined);

                    await setTimeoutAsync(1000 * 2);
                    options.body = { name: 'Thor' };
                    httpRequest(options, async (response, error) => {
                        assert.deepStrictEqual(response.headers['access-control-allow-origin'], '*');
                        assert.deepStrictEqual(response.statusCode, HttpStatusCodes.CREATED);
                        assert.notDeepStrictEqual(response.body[0].id, undefined);

                        await setTimeoutAsync(1000 * 2);
                        options.body = { name: 'Wasp' };
                        httpRequest(options, async (response, error) => {
                            assert.deepStrictEqual(response.headers['access-control-allow-origin'], '*');
                            assert.deepStrictEqual(response.statusCode, HttpStatusCodes.CREATED);
                            assert.notDeepStrictEqual(response.body[0].id, undefined);

                            await setTimeoutAsync(1000 * 2);
                            options.body = { name: 'Ant-Man' };
                            httpRequest(options, async (response, error) => {
                                assert.deepStrictEqual(response.headers['access-control-allow-origin'], '*');
                                assert.deepStrictEqual(response.statusCode, HttpStatusCodes.CREATED);
                                assert.notDeepStrictEqual(response.body[0].id, undefined);

                                //assign id for next test.
                                antmanId = response.body[0].id;

                                await setTimeoutAsync(1000 * 2);
                                options.body = { name: 'Hulk' };
                                httpRequest(options, async (response, error) => {
                                    assert.deepStrictEqual(response.headers['access-control-allow-origin'], '*');
                                    assert.deepStrictEqual(response.statusCode, HttpStatusCodes.CREATED);
                                    assert.notDeepStrictEqual(response.body[0].id, undefined);

                                    await setTimeoutAsync(1000 * 2);
                                    options.body = { name: 'Vision' };
                                    httpRequest(options, async (response, error) => {
                                        assert.deepStrictEqual(response.headers['access-control-allow-origin'], '*');
                                        assert.deepStrictEqual(response.statusCode, HttpStatusCodes.CREATED);
                                        assert.notDeepStrictEqual(response.body[0].id, undefined);

                                        await setTimeoutAsync(1000 * 2);

                                        //assign id for next test.
                                        visionId = response.body[0].id;
                                        done();
                                    });
                                });
                            });
                        });
                    });
                });
            }).timeout(1000 * 60);
        });

        mocha.describe('#getOneByID() Test', () => {
            const options: HttpOptions = { host: '127.0.0.1', port: 3000, method: 'GET', path: `/hero/${antmanId}`, body: {}, json: true };
            options.headers = { 'Content-Type': 'application/json' };

            mocha.it('should execute GET(/hero/:id) with valid id and receive body(JSON) with CORS support', (done) => {
                options.path = `/hero/${antmanId}`;
                httpRequest(options, (response, error) => {
                    assert.deepStrictEqual(response.headers['access-control-allow-origin'], '*');
                    assert.deepStrictEqual(response.statusCode, HttpStatusCodes.OK);
                    assert.deepStrictEqual(response.body.id, antmanId);
                    assert.deepStrictEqual(response.body.name, 'Ant-Man');
                    assert.notDeepStrictEqual(response.body.createdAt, undefined);
                    assert.notDeepStrictEqual(response.body.updatedAt, undefined);
                    done();
                });
            }).timeout(1000 * 60);

            mocha.it('should execute GET(/hero/:id) with invalid id and receive body(Empty JSON) with CORS support', (done) => {
                options.path = `/hero/${randomId}`;
                httpRequest(options, (response, error) => {
                    assert.deepStrictEqual(response.headers['access-control-allow-origin'], '*');
                    assert.deepStrictEqual(response.statusCode, HttpStatusCodes.OK);
                    assert.deepStrictEqual(response.body, {});
                    done();
                });
            }).timeout(1000 * 60);
        });

        mocha.describe('#updateOneByID() Test', () => {
            const options: HttpOptions = { host: '127.0.0.1', port: 3000, method: 'PUT', path: `/hero/${antmanId}`, body: { name: 'Ant Man' }, json: true };
            options.headers = { 'Content-Type': 'application/json' };

            mocha.it('should execute PUT(/hero/:id) with valid id and receive body(True JSON) with CORS support', (done) => {
                options.path = `/hero/${antmanId}`;
                httpRequest(options, (response, error) => {
                    assert.deepStrictEqual(response.headers['access-control-allow-origin'], '*');
                    assert.deepStrictEqual(response.statusCode, HttpStatusCodes.OK);
                    assert.deepStrictEqual(response.body, { updated: true });
                    done();
                });
            }).timeout(1000 * 60);

            mocha.it('should execute PUT(/hero/:id) with invalid id and receive body(False JSON) with CORS support', (done) => {
                options.path = `/hero/${randomId}`;
                httpRequest(options, (response, error) => {
                    assert.deepStrictEqual(response.headers['access-control-allow-origin'], '*');
                    assert.deepStrictEqual(response.statusCode, HttpStatusCodes.OK);
                    assert.deepStrictEqual(response.body, { updated: false });
                    done();
                });
            }).timeout(1000 * 60);
        });

        mocha.describe('#deleteOneByID() Test', () => {
            const options: HttpOptions = { host: '127.0.0.1', port: 3000, method: 'DELETE', path: `/hero/${visionId}`, body: {}, json: true };
            options.headers = { 'Content-Type': 'application/json' };

            mocha.it('should execute DELETE(/hero/:id) with valid id and receive body(True JSON) with CORS support', (done) => {
                options.path = `/hero/${visionId}`;
                httpRequest(options, (response, error) => {
                    assert.deepStrictEqual(response.headers['access-control-allow-origin'], '*');
                    assert.deepStrictEqual(response.statusCode, HttpStatusCodes.OK);
                    assert.deepStrictEqual(response.body, { deleted: true });
                    done();
                });
            }).timeout(1000 * 60);

            mocha.it('should execute DELETE(/hero/:id) with invalid id and receive body(False JSON) with CORS support', (done) => {
                options.path = `/hero/${randomId}`;
                httpRequest(options, (response, error) => {
                    assert.deepStrictEqual(response.headers['access-control-allow-origin'], '*');
                    assert.deepStrictEqual(response.statusCode, HttpStatusCodes.OK);
                    assert.deepStrictEqual(response.body, { deleted: false });
                    done();
                });
            }).timeout(1000 * 60);
        });

        mocha.describe('#getAll() Test', () => {
            const options: HttpOptions = { host: '127.0.0.1', port: 3000, method: 'GET', path: '/hero', body: {}, json: true };
            options.headers = { 'Content-Type': 'application/json' };

            mocha.it('should execute GET(/hero) and receive body(JSON) with CORS support', (done) => {
                options.path = '/hero';
                httpRequest(options, (response, error) => {
                    assert.deepStrictEqual(response.headers['access-control-allow-origin'], '*');
                    assert.deepStrictEqual(response.statusCode, HttpStatusCodes.OK);
                    assert.deepStrictEqual(response.body.length, 5);
                    assert.deepStrictEqual(response.body[0].name, 'Hulk');
                    assert.deepStrictEqual(response.body[1].name, 'Ant Man');
                    assert.deepStrictEqual(response.body[2].name, 'Wasp');
                    assert.deepStrictEqual(response.body[3].name, 'Thor');
                    assert.deepStrictEqual(response.body[4].name, 'Iron Man');
                    done();
                });
            }).timeout(1000 * 60);

            mocha.it('should execute GET(/hero/?order=new) and receive body(JSON) with CORS support', (done) => {
                options.path = '/hero/?order=new';
                httpRequest(options, (response, error) => {
                    assert.deepStrictEqual(response.headers['access-control-allow-origin'], '*');
                    assert.deepStrictEqual(response.statusCode, HttpStatusCodes.OK);
                    assert.deepStrictEqual(response.body.length, 5);
                    assert.deepStrictEqual(response.body[0].name, 'Hulk');
                    assert.deepStrictEqual(response.body[1].name, 'Ant Man');
                    assert.deepStrictEqual(response.body[2].name, 'Wasp');
                    assert.deepStrictEqual(response.body[3].name, 'Thor');
                    assert.deepStrictEqual(response.body[4].name, 'Iron Man');
                    done();
                });
            }).timeout(1000 * 60);

            mocha.it('should execute GET(/hero/?order=old) and receive body(JSON) with CORS support', (done) => {
                options.path = '/hero/?order=old';
                httpRequest(options, (response, error) => {
                    assert.deepStrictEqual(response.headers['access-control-allow-origin'], '*');
                    assert.deepStrictEqual(response.statusCode, HttpStatusCodes.OK);
                    assert.deepStrictEqual(response.body.length, 5);
                    assert.deepStrictEqual(response.body[0].name, 'Iron Man');
                    assert.deepStrictEqual(response.body[1].name, 'Thor');
                    assert.deepStrictEqual(response.body[2].name, 'Wasp');
                    assert.deepStrictEqual(response.body[3].name, 'Ant Man');
                    assert.deepStrictEqual(response.body[4].name, 'Hulk');
                    done();
                });
            }).timeout(1000 * 60);

            mocha.it('should execute GET(/hero/?page=1) and receive body(JSON) with CORS support', (done) => {
                options.path = '/hero/?page=1';
                httpRequest(options, (response, error) => {
                    assert.deepStrictEqual(response.headers['access-control-allow-origin'], '*');
                    assert.deepStrictEqual(response.statusCode, HttpStatusCodes.OK);
                    assert.deepStrictEqual(response.body.length, 0);
                    done();
                });
            }).timeout(1000 * 60);

            mocha.it('should execute GET(/hero/?pageSize=1) and receive body(JSON) with CORS support', (done) => {
                options.path = '/hero/?pageSize=1';
                httpRequest(options, (response, error) => {
                    assert.deepStrictEqual(response.headers['access-control-allow-origin'], '*');
                    assert.deepStrictEqual(response.statusCode, HttpStatusCodes.OK);
                    assert.deepStrictEqual(response.body.length, 1);
                    assert.deepStrictEqual(response.body[0].name, 'Hulk');
                    done();
                });
            }).timeout(1000 * 60);

            mocha.it('should execute GET(/hero/?page=1&pageSize=1) and receive body(JSON) with CORS support', (done) => {
                options.path = '/hero/?page=1&pageSize=1';
                httpRequest(options, (response, error) => {
                    assert.deepStrictEqual(response.headers['access-control-allow-origin'], '*');
                    assert.deepStrictEqual(response.statusCode, HttpStatusCodes.OK);
                    assert.deepStrictEqual(response.body.length, 1);
                    assert.deepStrictEqual(response.body[0].name, 'Ant Man');
                    done();
                });
            }).timeout(1000 * 60);
        });
    });
});