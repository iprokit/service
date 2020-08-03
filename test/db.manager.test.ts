//Import Libs.
import mocha from 'mocha';
import assert from 'assert';

//Import Local.
import Service from '../lib/service';
import { ConnectionOptions, InvalidConnectionOptions } from '../lib/db.manager';

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

mocha.describe('Database Test', () => {
    mocha.describe('Constructor(RDB) Test', () => {
        mocha.it('should construct service with RDB(default variables) connection', () => {
            const db: ConnectionOptions = {
                name: 'HeroDB',
                type: 'mysql',
                host: '127.0.0.1',
                username: 'HeroUser',
                password: 'HeroPass'
            }

            const service = new Service({ name: 'HeroSVC', db: db, logPath: logPath });

            //Options Variables.
            assert.deepStrictEqual(service.dbManager.name, 'HeroDB');
            assert.deepStrictEqual(service.dbManager.type, 'mysql');
            assert.deepStrictEqual(service.dbManager.host, '127.0.0.1');
            assert.deepStrictEqual(service.dbManager.username, 'HeroUser');
            assert.deepStrictEqual(service.dbManager.password, 'HeroPass');
            assert.deepStrictEqual(service.dbManager.paperTrail, true);

            //Class Variables.
            assert.notDeepStrictEqual(service.dbManager, undefined);
            assert.notDeepStrictEqual(service.dbManager.connection, undefined);
            assert.notDeepStrictEqual(service.dbManager.models, undefined);
            assert.deepStrictEqual(service.dbManager.connected, false);
            assert.deepStrictEqual(service.dbManager.rdb, true);
            assert.deepStrictEqual(service.dbManager.noSQL, false);
        });

        mocha.it('should construct service with RDB(Truthy variables) connection', () => {
            const db: ConnectionOptions = {
                name: 'HeroDB',
                type: 'mysql',
                host: '127.0.0.1',
                username: 'HeroUser',
                password: 'HeroPass',
                paperTrail: true
            }

            const service = new Service({ name: 'HeroSVC', db: db, logPath: logPath });

            //Options Variables.
            assert.deepStrictEqual(service.dbManager.name, 'HeroDB');
            assert.deepStrictEqual(service.dbManager.type, 'mysql');
            assert.deepStrictEqual(service.dbManager.host, '127.0.0.1');
            assert.deepStrictEqual(service.dbManager.username, 'HeroUser');
            assert.deepStrictEqual(service.dbManager.password, 'HeroPass');
            assert.deepStrictEqual(service.dbManager.paperTrail, true);

            //Class Variables.
            assert.notDeepStrictEqual(service.dbManager, undefined);
            assert.notDeepStrictEqual(service.dbManager.connection, undefined);
            assert.notDeepStrictEqual(service.dbManager.models, undefined);
            assert.deepStrictEqual(service.dbManager.connected, false);
            assert.deepStrictEqual(service.dbManager.rdb, true);
            assert.deepStrictEqual(service.dbManager.noSQL, false);
        });

        mocha.it('should construct service with RDB(Falsy variables) connection', () => {
            const db: ConnectionOptions = {
                name: '',
                type: 'mysql',
                host: '',
                username: '',
                password: '',
                paperTrail: false
            }

            const service = new Service({ name: 'HeroSVC', db: db, logPath: logPath });

            //Options Variables.
            assert.deepStrictEqual(service.dbManager.name, '');
            assert.deepStrictEqual(service.dbManager.type, 'mysql');
            assert.deepStrictEqual(service.dbManager.host, '');
            assert.deepStrictEqual(service.dbManager.username, '');
            assert.deepStrictEqual(service.dbManager.password, '');
            assert.deepStrictEqual(service.dbManager.paperTrail, false);

            //Class Variables.
            assert.notDeepStrictEqual(service.dbManager, undefined);
            assert.notDeepStrictEqual(service.dbManager.connection, undefined);
            assert.notDeepStrictEqual(service.dbManager.models, undefined);
            assert.deepStrictEqual(service.dbManager.connected, false);
            assert.deepStrictEqual(service.dbManager.rdb, true);
            assert.deepStrictEqual(service.dbManager.noSQL, false);
        });
    });

    mocha.describe('Constructor(NoSQL) Test', () => {
        mocha.it('should construct service with NoSQL(default variables) connection', () => {
            const db: ConnectionOptions = {
                name: 'HeroDB',
                type: 'mongo',
                host: '127.0.0.1',
                username: 'HeroUser',
                password: 'HeroPass'
            }

            const service = new Service({ name: 'HeroSVC', db: db, logPath: logPath });

            //Options Variables.
            assert.deepStrictEqual(service.dbManager.name, 'HeroDB');
            assert.deepStrictEqual(service.dbManager.type, 'mongo');
            assert.deepStrictEqual(service.dbManager.host, '127.0.0.1');
            assert.deepStrictEqual(service.dbManager.username, 'HeroUser');
            assert.deepStrictEqual(service.dbManager.password, 'HeroPass');
            assert.deepStrictEqual(service.dbManager.paperTrail, true);

            //Class Variables.
            assert.notDeepStrictEqual(service.dbManager, undefined);
            assert.notDeepStrictEqual(service.dbManager.connection, undefined);
            assert.notDeepStrictEqual(service.dbManager.models, undefined);
            assert.deepStrictEqual(service.dbManager.connected, false);
            assert.deepStrictEqual(service.dbManager.rdb, false);
            assert.deepStrictEqual(service.dbManager.noSQL, true);
        });

        mocha.it('should construct service with RDB(Truthy variables) connection', () => {
            const db: ConnectionOptions = {
                name: 'HeroDB',
                type: 'mongo',
                host: '127.0.0.1',
                username: 'HeroUser',
                password: 'HeroPass',
                paperTrail: true
            }

            const service = new Service({ name: 'HeroSVC', db: db, logPath: logPath });

            //Options Variables.
            assert.deepStrictEqual(service.dbManager.name, 'HeroDB');
            assert.deepStrictEqual(service.dbManager.type, 'mongo');
            assert.deepStrictEqual(service.dbManager.host, '127.0.0.1');
            assert.deepStrictEqual(service.dbManager.username, 'HeroUser');
            assert.deepStrictEqual(service.dbManager.password, 'HeroPass');
            assert.deepStrictEqual(service.dbManager.paperTrail, true);

            //Class Variables.
            assert.notDeepStrictEqual(service.dbManager, undefined);
            assert.notDeepStrictEqual(service.dbManager.connection, undefined);
            assert.notDeepStrictEqual(service.dbManager.models, undefined);
            assert.deepStrictEqual(service.dbManager.connected, false);
            assert.deepStrictEqual(service.dbManager.rdb, false);
            assert.deepStrictEqual(service.dbManager.noSQL, true);
        });

        mocha.it('should construct service with RDB(Falsy variables) connection', () => {
            const db: ConnectionOptions = {
                name: '',
                type: 'mongo',
                host: '',
                username: '',
                password: '',
                paperTrail: false
            }

            const service = new Service({ name: 'HeroSVC', db: db, logPath: logPath });

            //Options Variables.
            assert.deepStrictEqual(service.dbManager.name, '');
            assert.deepStrictEqual(service.dbManager.type, 'mongo');
            assert.deepStrictEqual(service.dbManager.host, '');
            assert.deepStrictEqual(service.dbManager.username, '');
            assert.deepStrictEqual(service.dbManager.password, '');
            assert.deepStrictEqual(service.dbManager.paperTrail, false);

            //Class Variables.
            assert.notDeepStrictEqual(service.dbManager, undefined);
            assert.notDeepStrictEqual(service.dbManager.connection, undefined);
            assert.notDeepStrictEqual(service.dbManager.models, undefined);
            assert.deepStrictEqual(service.dbManager.connected, false);
            assert.deepStrictEqual(service.dbManager.rdb, false);
            assert.deepStrictEqual(service.dbManager.noSQL, true);
        });
    });

    mocha.describe('Connection(RDB) Test', () => {
        mocha.it('should start service with RDB(Valid) connection and succeed', (done) => {
            const db: ConnectionOptions = {
                name: rdbOptions.name,
                type: rdbOptions.type,
                host: rdbOptions.host,
                username: rdbOptions.username,
                password: rdbOptions.password
            }
            let service = new Service({ name: 'HeroSVC', db: db, logPath: logPath });
            silentLog(service);

            service.start((error) => {
                assert.deepStrictEqual(error, undefined);
                assert.deepStrictEqual(service.dbManager.connected, true);

                service.stop((error) => {
                    assert.deepStrictEqual(error, undefined);
                    assert.deepStrictEqual(service.dbManager.connected, false);

                    done();
                });
            });
        }).timeout(1000 * 60);

        mocha.it('should start service with RDB(Invalid name) connection and fail', (done) => {
            const db: ConnectionOptions = {
                name: 'HeroDB',
                type: rdbOptions.type,
                host: rdbOptions.host,
                username: rdbOptions.username,
                password: rdbOptions.password
            }
            let service = new Service({ name: 'HeroSVC', db: db, logPath: logPath });
            silentLog(service);

            service.start((error) => {
                if (error instanceof InvalidConnectionOptions) {
                    assert.deepStrictEqual(error.code, 'ER_DBACCESS_DENIED_ERROR');
                    assert.deepStrictEqual(error.errno, 1044);
                }
                assert.deepStrictEqual(service.dbManager.connected, false);

                service.stop((error) => {
                    assert.deepStrictEqual(error, undefined);
                    assert.deepStrictEqual(service.dbManager.connected, false);

                    done();
                });
            });
        }).timeout(1000 * 60);

        mocha.it('should start service with RDB(Invalid host) connection and fail', (done) => {
            const db: ConnectionOptions = {
                name: rdbOptions.name,
                type: rdbOptions.type,
                host: '127.0.0.1',
                username: rdbOptions.username,
                password: rdbOptions.password
            }
            let service = new Service({ name: 'HeroSVC', db: db, logPath: logPath });
            silentLog(service);

            service.start((error) => {
                if (error instanceof InvalidConnectionOptions) {
                    assert.deepStrictEqual(error.code, 'ECONNREFUSED');
                    assert.deepStrictEqual(error.errno, 'ECONNREFUSED');
                }
                assert.deepStrictEqual(service.dbManager.connected, false);

                service.stop((error) => {
                    assert.deepStrictEqual(error, undefined);
                    assert.deepStrictEqual(service.dbManager.connected, false);

                    done();
                });
            });
        }).timeout(1000 * 60);

        mocha.it('should start service with RDB(Invalid username) connection and fail', (done) => {
            const db: ConnectionOptions = {
                name: rdbOptions.name,
                type: rdbOptions.type,
                host: rdbOptions.host,
                username: 'heroUser',
                password: rdbOptions.password
            }
            let service = new Service({ name: 'HeroSVC', db: db, logPath: logPath });
            silentLog(service);

            service.start((error) => {
                if (error instanceof InvalidConnectionOptions) {
                    assert.deepStrictEqual(error.code, 'ER_ACCESS_DENIED_ERROR');
                    assert.deepStrictEqual(error.errno, 1045);
                }
                assert.deepStrictEqual(service.dbManager.connected, false);

                service.stop((error) => {
                    assert.deepStrictEqual(error, undefined);
                    assert.deepStrictEqual(service.dbManager.connected, false);

                    done();
                });
            });
        }).timeout(1000 * 60);

        mocha.it('should start service with RDB(Invalid password) connection and fail', (done) => {
            const db: ConnectionOptions = {
                name: rdbOptions.name,
                type: rdbOptions.type,
                host: rdbOptions.host,
                username: rdbOptions.username,
                password: 'heroPass'
            }
            let service = new Service({ name: 'HeroSVC', db: db, logPath: logPath });
            silentLog(service);

            service.start((error) => {
                if (error instanceof InvalidConnectionOptions) {
                    assert.deepStrictEqual(error.code, 'ER_ACCESS_DENIED_ERROR');
                    assert.deepStrictEqual(error.errno, 1045);
                }
                assert.deepStrictEqual(service.dbManager.connected, false);

                service.stop((error) => {
                    assert.deepStrictEqual(error, undefined);
                    assert.deepStrictEqual(service.dbManager.connected, false);

                    done();
                });
            });
        }).timeout(1000 * 60);
    });

    mocha.describe('Connection(NoSQL) Test', () => {
        mocha.it('should start service with NoSQL(Valid) connection and succeed', (done) => {
            const db: ConnectionOptions = {
                name: noSQLOptions.name,
                type: noSQLOptions.type,
                host: noSQLOptions.host,
                username: noSQLOptions.username,
                password: noSQLOptions.password
            }
            let service = new Service({ name: 'HeroSVC', db: db, logPath: logPath });
            silentLog(service);

            service.start((error) => {
                assert.deepStrictEqual(error, undefined);
                assert.deepStrictEqual(service.dbManager.connected, true);

                service.stop((error) => {
                    assert.deepStrictEqual(error, undefined);
                    assert.deepStrictEqual(service.dbManager.connected, false);

                    done();
                });
            });
        }).timeout(1000 * 60);

        mocha.it('should start service with NoSQL(Invalid name) connection and succeed', (done) => {
            const db: ConnectionOptions = {
                name: 'HeroDB',
                type: noSQLOptions.type,
                host: noSQLOptions.host,
                username: noSQLOptions.username,
                password: noSQLOptions.password
            }
            let service = new Service({ name: 'HeroSVC', db: db, logPath: logPath });
            silentLog(service);

            service.start((error) => {
                assert.deepStrictEqual(error, undefined);
                assert.deepStrictEqual(service.dbManager.connected, true);

                service.stop((error) => {
                    assert.deepStrictEqual(error, undefined);
                    assert.deepStrictEqual(service.dbManager.connected, false);

                    done();
                });
            });
        }).timeout(1000 * 60);

        mocha.it('should start service with NoSQL(Invalid host) connection and fail', (done) => {
            const db: ConnectionOptions = {
                name: noSQLOptions.name,
                type: noSQLOptions.type,
                host: '127.0.0.1',
                username: noSQLOptions.username,
                password: noSQLOptions.password
            }
            let service = new Service({ name: 'HeroSVC', db: db, logPath: logPath });
            silentLog(service);


            service.start((error) => {
                if (error instanceof InvalidConnectionOptions) {
                    assert.deepStrictEqual(error.message.includes('connect ECONNREFUSED'), true);
                }
                assert.deepStrictEqual(service.dbManager.connected, false);

                service.stop((error) => {
                    assert.deepStrictEqual(error, undefined);
                    assert.deepStrictEqual(service.dbManager.connected, false);

                    done();
                });
            });
        }).timeout(1000 * 60);

        mocha.it('should start service with NoSQL(Invalid username) connection and fail', (done) => {
            const db: ConnectionOptions = {
                name: noSQLOptions.name,
                type: noSQLOptions.type,
                host: noSQLOptions.host,
                username: 'heroUser',
                password: noSQLOptions.password
            }
            let service = new Service({ name: 'HeroSVC', db: db, logPath: logPath });
            silentLog(service);

            service.start((error) => {
                if (error instanceof InvalidConnectionOptions) {
                    assert.deepStrictEqual(error.message, 'Authentication failed.');
                }
                assert.deepStrictEqual(service.dbManager.connected, false);

                service.stop((error) => {
                    assert.deepStrictEqual(error, undefined);
                    assert.deepStrictEqual(service.dbManager.connected, false);

                    done();
                });
            });
        }).timeout(1000 * 60);

        mocha.it('should start service with NoSQL(Invalid password) connection and fail', (done) => {
            const db: ConnectionOptions = {
                name: noSQLOptions.name,
                type: noSQLOptions.type,
                host: noSQLOptions.host,
                username: noSQLOptions.username,
                password: 'heroPass'
            }
            let service = new Service({ name: 'HeroSVC', db: db, logPath: logPath });
            silentLog(service);

            service.start((error) => {
                if (error instanceof InvalidConnectionOptions) {
                    assert.deepStrictEqual(error.message, 'Authentication failed.');
                }
                assert.deepStrictEqual(service.dbManager.connected, false);

                service.stop((error) => {
                    assert.deepStrictEqual(error, undefined);
                    assert.deepStrictEqual(service.dbManager.connected, false);

                    done();
                });
            });
        }).timeout(1000 * 60);
    });

    //TODO: Implement health and report test.
});

//////////////////////////////
//////Helpers
//////////////////////////////
function silentLog(service: Service) {
    service.logger.transports.forEach((transport) => (transport.silent = true));
}