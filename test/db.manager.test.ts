//Import Libs.
import mocha from 'mocha';
import assert from 'assert';

//Import Local.
import Service from '../lib/service';
import { ConnectionOptions } from '../lib/db.manager';

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
    mocha.describe('Constructor Test', () => {
        //TODO: Implement Constructor Test.

        // //Options Variables.
        // assert.deepStrictEqual(service.dbManager.name, db.name);
        // assert.deepStrictEqual(service.dbManager.type, db.type);
        // assert.deepStrictEqual(service.dbManager.host, db.host);
        // assert.deepStrictEqual(service.dbManager.username, db.username);
        // assert.deepStrictEqual(service.dbManager.password, db.password);
        // assert.deepStrictEqual(service.dbManager.paperTrail, true);

        // //Class Variables.
        // assert.notDeepStrictEqual(service.dbManager, undefined);
        // assert.notDeepStrictEqual(service.dbManager.connection, undefined);
        // assert.deepStrictEqual(service.dbManager.models, []);
        // assert.deepStrictEqual(service.dbManager.connected, false);
        // assert.deepStrictEqual(service.dbManager.rdb, false);
        // assert.deepStrictEqual(service.dbManager.noSQL, true);
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

            service.start(() => {
                assert.deepStrictEqual(service.dbManager.connected, true);

                service.stop(done);
            });
        }).timeout(1000 * 60 * 3);

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

            service.start(() => {
                assert.deepStrictEqual(service.dbManager.connected, false);

                service.stop(done);
            });
        }).timeout(1000 * 60 * 3);

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

            service.start(() => {
                assert.deepStrictEqual(service.dbManager.connected, false);

                service.stop(done);
            });
        }).timeout(1000 * 60 * 3);

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

            service.start(() => {
                assert.deepStrictEqual(service.dbManager.connected, false);

                service.stop(done);
            });
        }).timeout(1000 * 60 * 3);

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

            service.start(() => {
                assert.deepStrictEqual(service.dbManager.connected, false);

                service.stop(done);
            });
        }).timeout(1000 * 60 * 3);
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

            service.start(() => {
                assert.deepStrictEqual(service.dbManager.connected, true);

                service.stop(done);
            });
        }).timeout(1000 * 60 * 3);

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

            service.start(() => {
                assert.deepStrictEqual(service.dbManager.connected, true);

                service.stop(done);
            });
        }).timeout(1000 * 60 * 3);

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

            service.start(() => {
                assert.deepStrictEqual(service.dbManager.connected, false);

                service.stop(done);
            });
        }).timeout(1000 * 60 * 3);

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

            service.start(() => {
                assert.deepStrictEqual(service.dbManager.connected, false);

                service.stop(done);
            });
        }).timeout(1000 * 60 * 3);

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

            service.start(() => {
                assert.deepStrictEqual(service.dbManager.connected, false);

                service.stop(done);
            });
        }).timeout(1000 * 60 * 3);
    });

    mocha.describe('Model Test', () => {
        //TODO: Implement CRUD Test.
    });

    mocha.describe('Sync Test', () => {
        //TODO: Implement Sync Test.
    });

    //TODO: Implement health and report test.
});

//////////////////////////////
//////Helpers
//////////////////////////////
function silentLog(service: Service) {
    service.logger.transports.forEach((transport) => (transport.silent = true));
}