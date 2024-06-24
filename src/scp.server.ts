//Import Libs.
import Stream from 'stream';

//Import @iprotechs Libs.
import { RFI, Incoming, Outgoing, Server, Connection } from '@iprotechs/scp';

/**
 * This class is used to create a SCP server.
 * A `ScpServer` is bound to an IP address and port number and listens for incoming SCP client connections.
 *
 * @emits `listening` when the server has been bound after calling `server.listen()`.
 * @emits `connection` when a client socket connection is received.
 * @emits `error` when an error occurs.
 * @emits `drop` when the number of connections reaches the threshold of `server.maxConnections`.
 * @emits `close` when the server is fully closed.
 */
export default class ScpServer extends Server implements IScpServer {
    /**
     * The unique identifier of the server.
     */
    public readonly identifier: string;

    /**
     * The client socket connections.
     */
    public readonly connections: Array<ScpConnection>;

    /**
     * The coordinates registered on the server.
     */
    public readonly coordinates: Array<Coordinate>;

    /**
     * Creates an instance of SCP server.
     * 
     * @param identifier the unique identifier of the server.
     */
    constructor(identifier: string) {
        super();

        //Initialize Options.
        this.identifier = identifier;

        //Initialize Variables.
        this.coordinates = new Array();

        //Bind listeners.
        this.onIncoming = this.onIncoming.bind(this);

        //Add listeners.
        this.addListener('incoming', this.onIncoming);

        //Apply `Coordinator` properties 👻.
        this.applyCoordinatorProperties(this);
    }

    //////////////////////////////
    //////Event Listeners
    //////////////////////////////
    /**
     * - Subscribe is handled by `subscribe` function.
     * - Omni is handled by `dispatch` function.
     */
    private onIncoming(incoming: Incoming, outgoing: Outgoing) {
        //Set: Outgoing.
        outgoing.set('SID', this.identifier);

        if (incoming.mode === 'SUBSCRIBE' && incoming.operation === 'subscribe') {
            this.subscribe(incoming, outgoing);
        }
        if (incoming.mode === 'OMNI') {
            //Below line will blow your mind! 🤯
            this.dispatch(0, false, this.coordinates, incoming, outgoing, () => { });
        }
    }

    //////////////////////////////
    //////Dispatch
    //////////////////////////////
    /**
     * Recursively loop through the coordinates to find and execute its handler.
     * 
     * @param coordinateIndex the index of the current coordinate being processed.
     * @param gridMatched set to true if the grid matched, false otherwise.
     * @param coordinates the coordinates to be processed.
     * @param incoming the incoming stream.
     * @param outgoing the outgoing stream.
     * @param unwind function called once the processed coordinates unwind.
     */
    private dispatch(coordinateIndex: number, gridMatched: boolean, coordinates: Array<Coordinate>, incoming: Incoming, outgoing: Outgoing, unwind: () => void) {
        //Need I say more.
        if (coordinateIndex >= coordinates.length) return unwind();

        const coordinate = coordinates[coordinateIndex];
        const regExp = new RegExp(/^(?:(?<gridName>[^.]+)\.)?(?<nexusName>[^.]+)$/);
        const { gridName, nexusName } = regExp.exec(incoming.operation).groups;

        //Shits about to go down! 😎
        if ('coordinates' in coordinate) {
            const grid = coordinate as Grid;
            const operationMatches = gridName.match(grid.regExp);

            if (operationMatches) {
                //Grid found, process the grid. 🎢
                const unwindFunction = () => this.dispatch(coordinateIndex + 1, false, this.coordinates, incoming, outgoing, unwind);
                this.dispatch(0, true, grid.coordinates, incoming, outgoing, unwindFunction);
                return;
            }
        } else {
            const nexus = coordinate as Nexus;
            const gridMatches = (gridName && gridMatched) || (!gridName && !gridMatched);
            const operationMatches = nexusName.match(nexus.regExp);

            if (gridMatches && operationMatches) {
                //Nexus found, execute the handler. 🎉
                const proceedFunction = () => this.dispatch(coordinateIndex + 1, gridMatched, coordinates, incoming, outgoing, unwind);
                nexus.handler(incoming, outgoing, proceedFunction);
                return;
            }
        }

        //Coordinate not found, lets keep going though the loop.
        this.dispatch(coordinateIndex + 1, gridMatched, coordinates, incoming, outgoing, unwind);
    }

    //////////////////////////////
    //////Subscribe
    //////////////////////////////
    /**
     * Registers the subscription from the client socket connection.
     * Broadcasts can only be sent to subscribed connections.
     */
    private subscribe(incoming: Incoming, outgoing: Outgoing) {
        //Read: Incoming stream.
        Stream.finished(incoming, (error) => { /* LIFE HAPPENS!!! */ });
        incoming.resume();

        //Set: Connection properties.
        (incoming.socket as ScpConnection).identifier = incoming.get('CID');

        //Write: Outgoing stream.
        Stream.finished(outgoing, (error) => { /* LIFE HAPPENS!!! */ });
        outgoing.end('');
    }

    //////////////////////////////
    //////Interface: ScpServer
    //////////////////////////////
    public broadcast(operation: string, data: string, params?: Iterable<readonly [string, string]>) {
        for (const connection of this.connections) {
            if (!connection.identifier) continue;

            connection.createOutgoing((outgoing: Outgoing) => {
                Stream.finished(outgoing, (error) => { /* LIFE HAPPENS!!! */ });
                outgoing.setRFI(new RFI('BROADCAST', operation, params));
                outgoing.set('SID', this.identifier);
                outgoing.end(data);
            });
        }
        return this;
    }

    public Coordinate() {
        const coordinator = { coordinates: new Array<Coordinate>() } as Coordinator;

        //Apply `Coordinator` properties 👻.
        this.applyCoordinatorProperties(coordinator);
        return coordinator;
    }

    public attach(operation: string, coordinator: Coordinator) {
        const { coordinates } = coordinator;
        const regExp = new RegExp(`^${operation.replace(/\*/g, '.*')}$`);
        this.coordinates.push({ operation, regExp, coordinates } as Grid);
        return this;
    }

    //////////////////////////////
    //////Interface: Coordinator
    //////////////////////////////
    public omni: (operation: string, handler: IncomingHandler) => this;

    //////////////////////////////
    //////Factory: Coordinator
    //////////////////////////////
    /**
     * Applies properties of the `Coordinator` interface to the provided instance,
     * enabling the registration of coordinates.
     * 
     * @param instance the instance to which the `Coordinator` properties are applied.
     */
    private applyCoordinatorProperties<I extends Coordinator>(instance: I) {
        //`Coordinator` properties 😈.
        instance.omni = (operation: string, handler: IncomingHandler) => {
            const regExp = new RegExp(`^${operation.replace(/\*/g, '.*')}$`);
            instance.coordinates.push({ operation, regExp, handler } as Nexus);
            return instance;
        }
    }
}

//////////////////////////////
/////IScpServer
//////////////////////////////
/**
 * Interface of `ScpServer`.
 */
export interface IScpServer extends Coordinator {
    /**
     * Broadcasts data to all the subscribed client socket connections.
     * 
     * @param operation the operation pattern.
     * @param data the data to broadcast.
     * @param params the optional input/output parameters of the broadcast.
     */
    broadcast: (operation: string, data: string, params?: Iterable<readonly [string, string]>) => this;

    /**
     * Returns a `Coordinator` to group coordinates that share related functionality.
     */
    Coordinate: () => Coordinator;

    /**
     * Attaches a coordinator.
     * 
     * @param operation the operation pattern.
     * @param coordinator the coordinator to attach.
     */
    attach: (operation: string, coordinator: Coordinator) => this;
}

//////////////////////////////
//////Coordinator
//////////////////////////////
/**
 * Interface for handling SCP I/O's and registering coordinates.
 */
export interface Coordinator {
    /**
     * The coordinates registered.
     */
    coordinates: Array<Coordinate>;

    /**
     * Registers a coordinate for handling OMNI I/O.
     * 
     * @param operation the operation pattern.
     * @param handler the incoming handler function.
     */
    omni: (operation: string, handler: IncomingHandler) => this;
}

//////////////////////////////
//////Coordinate
//////////////////////////////
/**
 * The union of an `Grid`/`Nexus`.
 */
export type Coordinate = Grid | Nexus;

/**
 * Represents a group of coordinates that share related functionality.
 */
export interface Grid {
    /**
     * The operation pattern of the grid.
     */
    operation: string;

    /**
     * The compiled regular expression to match the operation of the grid.
     */
    regExp: RegExp;

    /**
     * The coordinates registered in the grid.
     */
    coordinates: Array<Nexus>;
}

/**
 * Represents a nexus.
 */
export interface Nexus {
    /**
     * The operation pattern of the nexus.
     */
    operation: string;

    /**
     * The compiled regular expression to match the operation of the nexus.
     */
    regExp: RegExp;

    /**
     * The incoming handler function of the nexus.
     */
    handler: IncomingHandler;
}

/**
 * The incoming handler.
 */
export type IncomingHandler = (incoming: Incoming, outgoing: Outgoing, proceed: ProceedFunction) => void;

/**
 * The proceed function.
 */
export type ProceedFunction = () => void;

//////////////////////////////
//////Connection
//////////////////////////////
export interface ScpConnection extends Connection {
    /**
     * The unique identifier of the client socket connection.
     */
    identifier: string;
}