//Import Libs.
import mocha from 'mocha';
import assert from 'assert';

//Import Local.
import Service from '../lib/service';
import { ConnectionOptions } from '../lib/db.manager';
import RDBModel, { RDBDataTypes, RDBModelAttributes } from '../lib/db.rdb.model';

//Import Util.
import { setTimeoutAsync, silentLog } from './util';

const logPath = '/Users/iprotechs/Desktop/logs';

const rdbOptions: ConnectionOptions = {
    name: 'rutvik_promicro',
    type: 'mysql',
    host: 'stage2.aqucloud.com',
    username: 'rutvik',
    password: 'Pr0m1cr@2020'
}

mocha.describe('RDB Model Test', () => {
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
    class HeroModel extends RDBModel {
        public static associated = false;
        public static hooked = false;

        public static associate() {
            this.associated = true;
        }
        public static hooks() {
            this.hooked = true;
        }
    }
    const heroAttributes: RDBModelAttributes = {
        name: {
            type: RDBDataTypes.STRING(30),
            allowNull: false
        }
    }
    service.dbManager.initModel('Hero', 'HeroTable', heroAttributes, HeroModel);

    mocha.before(function (done) {
        this.timeout(1000 * 60);
        service.start(done);
    });

    mocha.after((done) => {
        service.stop(done);
    });

    mocha.describe('Creation & Initialization Test', () => {
        mocha.it('should initialize hero model', (done) => {
            assert.deepStrictEqual(HeroModel.associated, true);
            assert.deepStrictEqual(HeroModel.hooked, true);

            assert.deepStrictEqual(service.dbManager.models.length, 1);
            assert.deepStrictEqual(service.dbManager.models[0], HeroModel);
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
        mocha.describe('#create() Test', () => {
            mocha.it('should execute #HeroModel.create()', async () => {
                try {
                    const ironman: any = await HeroModel.create({ name: 'Iron Man' }, { raw: true }); //id: 1
                    assert.deepStrictEqual(ironman.id, 1);
                    await setTimeoutAsync(1000 * 2);

                    const thor: any = await HeroModel.create({ name: 'Thor' }, { raw: true }); //id: 2
                    assert.deepStrictEqual(thor.id, 2);
                    await setTimeoutAsync(1000 * 2);

                    const wasp: any = await HeroModel.create({ name: 'Wasp' }, { raw: true }); //id: 3
                    assert.deepStrictEqual(wasp.id, 3);
                    await setTimeoutAsync(1000 * 2);

                    const antman: any = await HeroModel.create({ name: 'Ant-Man' }, { raw: true }); //id: 4
                    assert.deepStrictEqual(antman.id, 4);
                    await setTimeoutAsync(1000 * 2);

                    const hulk: any = await HeroModel.create({ name: 'Hulk' }, { raw: true }); //id: 5
                    assert.deepStrictEqual(hulk.id, 5);
                    await setTimeoutAsync(1000 * 2);

                    const vision: any = await HeroModel.create({ name: 'Vision' }, { raw: true }); //id: 6
                    assert.deepStrictEqual(vision.id, 6);
                    await setTimeoutAsync(1000 * 2);
                } catch (error) {
                    assert.deepStrictEqual(error, undefined);
                }
            }).timeout(1000 * 60);
        });

        mocha.describe('#getOneByID() Test', () => {
            mocha.it('should execute #HeroModel.getOneByID() with valid id and succeed', async () => {
                try {
                    const hero: any = await HeroModel.getOneByID(4);
                    assert.deepStrictEqual(hero.id, 4);
                    assert.deepStrictEqual(hero.name, 'Ant-Man');
                    assert.notDeepStrictEqual(hero.createdAt, undefined);
                    assert.notDeepStrictEqual(hero.updatedAt, undefined);
                } catch (error) {
                    assert.deepStrictEqual(error, undefined);
                }
            }).timeout(1000 * 60);

            mocha.it('should execute #HeroModel.getOneByID() with invalid id and fail', async () => {
                try {
                    const hero: any = await HeroModel.getOneByID(40);
                    assert.deepStrictEqual(hero, {});
                } catch (error) {
                    assert.deepStrictEqual(error, undefined);
                }
            }).timeout(1000 * 60);
        });

        mocha.describe('#updateOneByID() Test', () => {
            mocha.it('should execute #HeroModel.updateOneByID() with valid id and succeed', async () => {
                try {
                    const updated = await HeroModel.updateOneByID(4, { name: 'Ant Man' });
                    assert.deepStrictEqual(updated, true);
                } catch (error) {
                    assert.deepStrictEqual(error, undefined);
                }
            }).timeout(1000 * 60);

            mocha.it('should execute #HeroModel.updateOneByID() with invalid id and fail', async () => {
                try {
                    const updated = await HeroModel.updateOneByID(40, { name: 'Ant Man' });
                    assert.deepStrictEqual(updated, false);
                } catch (error) {
                    assert.deepStrictEqual(error, undefined);
                }
            }).timeout(1000 * 60);
        });

        mocha.describe('#deleteOneByID() Test', () => {
            mocha.it('should execute #HeroModel.deleteOneByID() with valid id and succeed', async () => {
                try {
                    const deleted = await HeroModel.deleteOneByID(6);
                    assert.deepStrictEqual(deleted, true);
                } catch (error) {
                    assert.deepStrictEqual(error, undefined);
                }
            }).timeout(1000 * 60);

            mocha.it('should execute #HeroModel.deleteOneByID() with invalid id and fail', async () => {
                try {
                    const deleted = await HeroModel.deleteOneByID(60);
                    assert.deepStrictEqual(deleted, false);
                } catch (error) {
                    assert.deepStrictEqual(error, undefined);
                }
            }).timeout(1000 * 60);
        });

        mocha.describe('#getAll() Test', () => {
            mocha.it('should execute #HeroModel.getAll() with options(order: default, pagination: { page: default, size: default })', async () => {
                try {
                    const heros: Array<any> = await HeroModel.getAll();
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

            mocha.it('should execute #HeroModel.getAll() with options(order: new, pagination: { page: default, size: default })', async () => {
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

            mocha.it('should execute #HeroModel.getAll() with options(order: old, pagination: { page: default, size: default })', async () => {
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

            mocha.it('should execute #HeroModel.getAll() with options(order: default, pagination: { page: 1, size: default } )', async () => {
                try {
                    const heros: Array<any> = await HeroModel.getAll({ pagination: { page: 1 } });
                    assert.deepStrictEqual(heros.length, 0);
                } catch (error) {
                    assert.deepStrictEqual(error, undefined);
                }
            }).timeout(1000 * 60);

            mocha.it('should execute #HeroModel.getAll() with options(order: default, pagination: { page: default, size: 1 })', async () => {
                try {
                    const heros: Array<any> = await HeroModel.getAll({ pagination: { size: 1 } });
                    assert.deepStrictEqual(heros.length, 1);
                    assert.deepStrictEqual(heros[0].name, 'Hulk');
                } catch (error) {
                    assert.deepStrictEqual(error, undefined);
                }
            }).timeout(1000 * 60);

            mocha.it('should execute #HeroModel.getAll() with options(order: default, pagination: { page: 1, size: 1 })', async () => {
                try {
                    const heros: Array<any> = await HeroModel.getAll({ pagination: { page: 1, size: 1 } });
                    assert.deepStrictEqual(heros.length, 1);
                    assert.deepStrictEqual(heros[0].name, 'Ant Man');
                } catch (error) {
                    assert.deepStrictEqual(error, undefined);
                }
            }).timeout(1000 * 60);

            mocha.it('should execute #HeroModel.getAll() with options(order: default, pagination: { page: undefined, size: undefined })', async () => {
                try {
                    const heros: Array<any> = await HeroModel.getAll({ pagination: { page: undefined, size: undefined } });
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
        });
    });
});