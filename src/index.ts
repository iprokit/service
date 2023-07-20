//Export SCP.
export { Frame, FrameType, RFI, IRFI, Params, Signal, Args, Socket, SocketOptions, Incoming, Outgoing, DropArgument } from '@iprotechs/scp';
export { default as ScpClient } from './scp.client';
export { default as ScpServer, ScpConnection, RemoteFunction, RemoteFunctionHandler, ReplyFunction } from './scp.server';

//Export HTTP.
export { default as HttpServer, Request, Response, Route, HttpMethod, RequestHandler } from './http.server';
export { proxy } from './http.handler';
export { default as HttpStatusCode } from './http.statusCode';

//Export Common.
export { generateID, generateRFID, NextFunction } from './common';