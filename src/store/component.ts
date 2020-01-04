/**
 * Connection States:
 * Disconnected = 0, Connected = 1, NoConnection = -1
 */
export type ConnectionState = 0 | 1 | -1;

export interface IServer {
    getReport(): Object;
    listen(): Promise<ConnectionState>;
    close(): Promise<ConnectionState>;
}

export interface IClient {
    getReport(): Object;
    connect(): Promise<ConnectionState>;
    disconnect(): Promise<ConnectionState>;
}