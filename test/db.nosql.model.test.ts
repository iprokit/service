//Import Libs.
import mocha from 'mocha';
import assert from 'assert';

//Import Local.
import Service from '../lib/service';
import { ConnectionOptions } from '../lib/db.manager';
import NoSQLModel, { NoSQLModelAttributes, NoSQLDataTypes } from '../lib/db.nosql.model';

const logPath = '/Users/iprotechs/Desktop/logs';

const noSQLOptions: ConnectionOptions = {
    name: 'PoC',
    type: 'mongo',
    host: 'stage-elb-internet-664379967.ap-south-1.elb.amazonaws.com',
    username: 'admin',
    password: 'c3r1stm3s'
}

mocha.describe('NoSQL Model Test', () => {
    const db: ConnectionOptions = {
        name: noSQLOptions.name,
        type: noSQLOptions.type,
        host: noSQLOptions.host,
        username: noSQLOptions.username,
        password: noSQLOptions.password
    }
    const service = new Service({ name: 'HeroSVC', db: db, logPath: logPath });
    silentLog(service);

    //Define & Initialize Model
    class HeroModel extends NoSQLModel {
        public static hooked = false;

        public static hooks() {
            this.hooked = true;
        }
    }
    const heroAttributes: NoSQLModelAttributes = {
        name: {
            type: String,
            trim: true,
            required: true
        }
    }
    service.dbManager.initModel('Hero', 'HeroCollection', heroAttributes, HeroModel);

    mocha.before(function (done) {
        this.timeout(1000 * 60);
        service.start(done);
    });

    mocha.after((done) => {
        service.stop(done);
    });

    mocha.describe('Creation & Initialization Test', () => {
        mocha.it('should initialize hero model', (done) => {
            assert.deepStrictEqual(HeroModel.hooked, true);

            assert.deepStrictEqual(service.dbManager.models.length, 1);
            assert.deepStrictEqual(service.dbManager.models[0], HeroModel._model);
            done();
        });
    });

    mocha.describe('Synchronization Test', () => {
        mocha.it('should synchronize the database', async () => {
            const synced = await service.dbManager.sync(true);
            assert.deepStrictEqual(synced, true);
        }).timeout(1000 * 60);
    });

    mocha.describe('CRUD Operations Test', () => {
        const randomId = '5f28ca9e65af907654c1c6f9';
        let antmanId: NoSQLDataTypes.ObjectId;
        let visionId: NoSQLDataTypes.ObjectId;

        mocha.describe('#create() Test', () => {
            mocha.it('should execute #HeroModel.create()', async () => {
                try {
                    const ironman: any = await HeroModel.create({ name: 'Iron Man' }); //id: 1
                    assert.notDeepStrictEqual(ironman[0]._id, undefined);
                    await setTimeoutAsync(1000 * 2);

                    const thor: any = await HeroModel.create({ name: 'Thor' }); //id: 2
                    assert.notDeepStrictEqual(thor[0]._id, undefined);
                    await setTimeoutAsync(1000 * 2);

                    const wasp: any = await HeroModel.create({ name: 'Wasp' }); //id: 3
                    assert.notDeepStrictEqual(wasp[0]._id, undefined);
                    await setTimeoutAsync(1000 * 2);

                    const antman: any = await HeroModel.create({ name: 'Ant-Man' }); //id: 4
                    assert.notDeepStrictEqual(antman[0]._id, undefined);
                    await setTimeoutAsync(1000 * 2);

                    const hulk: any = await HeroModel.create({ name: 'Hulk' }); //id: 5
                    assert.notDeepStrictEqual(hulk[0]._id, undefined);
                    await setTimeoutAsync(1000 * 2);

                    const vision: any = await HeroModel.create({ name: 'Vision' }); //id: 6
                    assert.notDeepStrictEqual(vision[0]._id, undefined);
                    await setTimeoutAsync(1000 * 2);

                    //assign id for next test.
                    antmanId = antman[0]._id;
                    visionId = vision[0]._id;
                } catch (error) {
                    assert.deepStrictEqual(error, undefined);
                }
            }).timeout(1000 * 60);
        });

        mocha.describe('#getOneByID() Test', () => {
            mocha.it('should execute #HeroModel.getOneByID() with valid id and succeed', async () => {
                try {
                    const hero: any = await HeroModel.getOneByID(antmanId);
                    assert.deepStrictEqual(hero._id, antmanId);
                    assert.deepStrictEqual(hero.name, 'Ant-Man');
                    assert.notDeepStrictEqual(hero.createdAt, undefined);
                    assert.notDeepStrictEqual(hero.updatedAt, undefined);
                } catch (error) {
                    assert.deepStrictEqual(error, undefined);
                }
            }).timeout(1000 * 60);

            mocha.it('should execute #HeroModel.getOneByID() with invalid id and fail', async () => {
                try {
                    const hero: any = await HeroModel.getOneByID(randomId);
                    assert.deepStrictEqual(hero, undefined);
                } catch (error) {
                    assert.deepStrictEqual(error, undefined);
                }
            }).timeout(1000 * 60);
        });

        mocha.describe('#updateOneByID() Test', () => {
            mocha.it('should execute #HeroModel.updateOneByID() with valid id and succeed', async () => {
                try {
                    const updated = await HeroModel.updateOneByID(antmanId, { name: 'Ant Man' });
                    assert.deepStrictEqual(updated, true);
                } catch (error) {
                    assert.deepStrictEqual(error, undefined);
                }
            }).timeout(1000 * 60);

            mocha.it('should execute #HeroModel.updateOneByID() with invalid id and fail', async () => {
                try {
                    const updated = await HeroModel.updateOneByID(randomId, { name: 'Ant Man' });
                    assert.deepStrictEqual(updated, false);
                } catch (error) {
                    assert.deepStrictEqual(error, undefined);
                }
            }).timeout(1000 * 60);
        });

        mocha.describe('#deleteOneByID() Test', () => {
            mocha.it('should execute #HeroModel.deleteOneByID() with valid id and succeed', async () => {
                try {
                    const deleted = await HeroModel.deleteOneByID(visionId);
                    assert.deepStrictEqual(deleted, true);
                } catch (error) {
                    assert.deepStrictEqual(error, undefined);
                }
            }).timeout(1000 * 60);

            mocha.it('should execute #HeroModel.deleteOneByID() with invalid id and fail', async () => {
                try {
                    const deleted = await HeroModel.deleteOneByID(randomId);
                    assert.deepStrictEqual(deleted, false);
                } catch (error) {
                    assert.deepStrictEqual(error, undefined);
                }
            }).timeout(1000 * 60);
        });

        mocha.describe('#getAll() Test', () => {
            mocha.it('should execute #HeroModel.getAll() with default options(order: default, pagination: { page: default, size: default })', async () => {
                try {
                    const heros: Array<any> = await HeroModel.getAll({});
                    assert.deepStrictEqual(heros.length, 5);
                    assert.deepStrictEqual(heros[0].name, 'Hulk');
                    assert.deepStrictEqual(heros[1].name, 'Ant Man');
                    assert.deepStrictEqual(heros[2].name, 'Wasp');
                    assert.deepStrictEqual(heros[3].name, 'Thor');
                    assert.deepStrictEqual(heros[4].name, 'Iron Man');
                } catch (error) {
                    assert.deepStrictEqual(error, undefined);
                }
            }).timeout(1000 * 60);

            mocha.it('should execute #HeroModel.getAll() with default options(order: new, pagination: { page: default, size: default })', async () => {
                try {
                    const heros: Array<any> = await HeroModel.getAll({ order: 'new' });
                    assert.deepStrictEqual(heros.length, 5);
                    assert.deepStrictEqual(heros[0].name, 'Hulk');
                    assert.deepStrictEqual(heros[1].name, 'Ant Man');
                    assert.deepStrictEqual(heros[2].name, 'Wasp');
                    assert.deepStrictEqual(heros[3].name, 'Thor');
                    assert.deepStrictEqual(heros[4].name, 'Iron Man');
                } catch (error) {
                    assert.deepStrictEqual(error, undefined);
                }
            }).timeout(1000 * 60);

            mocha.it('should execute #HeroModel.getAll() with default options(order: old, pagination: { page: default, size: default })', async () => {
                try {
                    const heros: Array<any> = await HeroModel.getAll({ order: 'old' });
                    assert.deepStrictEqual(heros.length, 5);
                    assert.deepStrictEqual(heros[0].name, 'Iron Man');
                    assert.deepStrictEqual(heros[1].name, 'Thor');
                    assert.deepStrictEqual(heros[2].name, 'Wasp');
                    assert.deepStrictEqual(heros[3].name, 'Ant Man');
                    assert.deepStrictEqual(heros[4].name, 'Hulk');
                } catch (error) {
                    assert.deepStrictEqual(error, undefined);
                }
            }).timeout(1000 * 60);

            mocha.it('should execute #HeroModel.getAll() with default options(order: default, pagination: { page: 1, size: default } )', async () => {
                try {
                    const heros: Array<any> = await HeroModel.getAll({ pagination: { page: 1 } });
                    assert.deepStrictEqual(heros.length, 0);
                } catch (error) {
                    assert.deepStrictEqual(error, undefined);
                }
            }).timeout(1000 * 60);

            mocha.it('should execute #HeroModel.getAll() with default options(order: default, pagination: { page: default, size: 1 })', async () => {
                try {
                    const heros: Array<any> = await HeroModel.getAll({ pagination: { size: 1 } });
                    assert.deepStrictEqual(heros.length, 1);
                    assert.deepStrictEqual(heros[0].name, 'Hulk');
                } catch (error) {
                    assert.deepStrictEqual(error, undefined);
                }
            }).timeout(1000 * 60);

            mocha.it('should execute #HeroModel.getAll() with default options(order: default, pagination: { page: 1, size: 1 })', async () => {
                try {
                    const heros: Array<any> = await HeroModel.getAll({ pagination: { page: 1, size: 1 } });
                    assert.deepStrictEqual(heros.length, 1);
                    assert.deepStrictEqual(heros[0].name, 'Ant Man');
                } catch (error) {
                    assert.deepStrictEqual(error, undefined);
                }
            }).timeout(1000 * 60);
        });
    });
});

//////////////////////////////
//////Helpers
//////////////////////////////
function silentLog(service: Service) {
    service.logger.transports.forEach((transport) => (transport.silent = true));
}

function setTimeoutAsync(ms: number) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve();
        }, ms);
    });
}