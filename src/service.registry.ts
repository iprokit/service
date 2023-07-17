//Import @iprotechs Libs.
import { Discovery, Pod, Args } from '@iprotechs/discovery';

export default class ServiceRegistry extends Discovery {
    constructor(identifier: string, args?: Args) {
        super(identifier, args);

        //Bind Listeners.
        this.onDiscover = this.onDiscover.bind(this);

        //Add Listeners.
        this.addListener('discover', this.onDiscover);
    }

    //////////////////////////////
    //////Event Listeners
    //////////////////////////////
    private onDiscover(pod: Pod) {
        this.emit('available');
    }
}