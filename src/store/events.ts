/////////////////////////
///////Events
/////////////////////////
export class Events {
    //TODO: Move this to appropriate classes.
    //Main
    public static readonly STARTING = Symbol('STARTING');
    public static readonly STARTED = Symbol('STARTED');
    public static readonly STOPPING = Symbol('STOPPING');
    public static readonly STOPPED = Symbol('STOPPED');
    //API Server
    public static readonly API_SERVER_STARTED = Symbol('API_SERVER_STARTED');
    public static readonly API_SERVER_STOPPED = Symbol('API_SERVER_STOPPED');
    public static readonly API_SERVER_ADDED_CONTROLLER = Symbol('API_SERVER_ADDED_CONTROLLER');
    //Comm Server
    public static readonly COMM_SERVER_STARTED = Symbol('COMM_SERVER_STARTED');
    public static readonly COMM_SERVER_STOPPED = Symbol('COMM_SERVER_STOPPED');
    public static readonly COMM_SERVER_ADDED_PUBLISHER = Symbol('COMM_SERVER_ADDED_PUBLISHER');
    public static readonly COMM_SERVER_RECEIVED_PACKET = Symbol('COMM_SERVER_RECEIVED_PACKET');
    public static readonly COMM_SERVER_SENT_PACKET = Symbol('COMM_SERVER_SENT_PACKET');
    //Comm Router
    public static readonly COMM_ROUTER_RECEIVED_PACKET = Symbol('COMM_ROUTER_RECEIVED_PACKET');
    public static readonly COMM_ROUTER_SENT_PACKET = Symbol('COMM_ROUTER_SENT_PACKET');
    //Reply
    public static readonly COMM_ROUTER_SEND_REPLY = Symbol('COMM_ROUTER_SEND_REPLY');
    //Transaction
    public static readonly COMM_ROUTER_TRANSACTION_PREPARE = Symbol('COMM_ROUTER_TRANSACTION_PREPARE');
    public static readonly COMM_ROUTER_TRANSACTION_COMMIT = Symbol('COMM_ROUTER_TRANSACTION_COMMIT');
    public static readonly COMM_ROUTER_TRANSACTION_ROLLBACK = Symbol('COMM_ROUTER_TRANSACTION_ROLLBACK');
    public static readonly COMM_ROUTER_TRANSACTION_PREPARED = Symbol('COMM_ROUTER_TRANSACTION_PREPARED');
    public static readonly COMM_ROUTER_TRANSACTION_COMMITTED = Symbol('COMM_ROUTER_TRANSACTION_COMMITTED');
    public static readonly COMM_ROUTER_TRANSACTION_ROLLEDBACK = Symbol('COMM_ROUTER_TRANSACTION_ROLLEDBACK');
    //Mesh
    public static readonly MESH_CONNECTING = Symbol('MESH_CONNECTING');
    public static readonly MESH_CONNECTED = Symbol('MESH_CONNECTED');
    public static readonly MESH_DISCONNECTING = Symbol('MESH_DISCONNECTING');
    public static readonly MESH_DISCONNECTED = Symbol('MESH_DISCONNECTED');
    public static readonly MESH_ADDED_NODE = Symbol('MESH_ADDED_NODE');
    //Node
    public static readonly NODE_CONNECTED = Symbol('NODE_CONNECTED');
    public static readonly NODE_DISCONNECTED = Symbol('NODE_DISCONNECTED');
    public static readonly NODE_RECEIVED_REPLY = Symbol('NODE_RECEIVED_REPLY');
    public static readonly NODE_SENT_MESSAGE = Symbol('NODE_SENT_MESSAGE');
    //DB
    public static readonly DB_CONNECTED = Symbol('DB_CONNECTED');
    public static readonly DB_DISCONNECTED = Symbol('DB_DISCONNECTED');
    public static readonly DB_ADDED_MODEL = Symbol('DB_ADDED_MODEL');
}
