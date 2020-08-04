//Import Libs.
import mocha from 'mocha';
import assert from 'assert';

//Import Local.
import micro from '../lib/micro';

//Import Util.
import { silentLog } from './util';

mocha.describe('Micro Test', () => {
    mocha.describe('Creation Test', () => {
        mocha.it('should create Micro', () => {
            // process.env.HTTP_PORT = '100';

            const hero = micro();
            silentLog(hero);

            assert.notDeepStrictEqual(hero, undefined);
        });
    });
});