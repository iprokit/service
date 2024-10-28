// Import Libs.
import HTTP from 'http';

//////////////////////////////
//////// Method
//////////////////////////////
export namespace Method {
    /**
     * HTTP GET method.
     */
    export const GET = 'GET' as const;

    /**
     * HTTP POST method.
     */
    export const POST = 'POST' as const;

    /**
     * HTTP PUT method.
     */
    export const PUT = 'PUT' as const;

    /**
     * HTTP PATCH method.
     */
    export const PATCH = 'PATCH' as const;

    /**
     * HTTP DELETE method.
     */
    export const DELETE = 'DELETE' as const;

    /**
     * HTTP ALL method.
     */
    export const ALL = 'ALL' as const;
}

//////////////////////////////
//////// Headers
//////////////////////////////
interface Headers {
    /**
     * Unique identifier of the proxy server.
     */
    'x-proxy-identifier'?: string;
}

export type RequestHeaders = HTTP.IncomingHttpHeaders & Headers;
export type ResponseHeaders = HTTP.OutgoingHttpHeaders & Headers;

//////////////////////////////
//////// StatusCode
//////////////////////////////
export namespace StatusCode {
    //////////////////////////////
    //////// 100x
    //////////////////////////////
    /**
     * This interim response indicates that everything so far is OK and that the client should continue the request, or ignore the response if the request is already finished.
     */
    export const CONTINUE = 100;

    /**
     * This code is sent in response to an Upgrade request header from the client, and indicates the protocol the server is switching to.
     */
    export const SWITCHING_PROTOCOLS = 101;

    /**
     * This code indicates that the server has received and is processing the request, but no response is available yet.
     */
    export const PROCESSING = 102;

    /**
     * This status code is primarily intended to be used with the Link header, letting the user agent start preloading resources while the server prepares a response.
     */
    export const EARLY_HINTS = 103;

    //////////////////////////////
    //////// 200x
    //////////////////////////////
    /**
     * The request has succeeded. The meaning of the success depends on the HTTP method:
     * 
     * - GET: The resource has been fetched and is transmitted in the message body.
     * - HEAD: The entity headers are in the message body.
     * - PUT or POST: The resource describing the result of the action is transmitted in the message body.
     * - TRACE: The message body contains the request message as received by the server
     */
    export const OK = 200;

    /**
     * The request has succeeded and a new resource has been created as a result.
     * This is typically the response sent after POST requests, or some PUT requests.
     */
    export const CREATED = 201;

    /**
     * The request has been received but not yet acted upon.
     * It is noncommittal, since there is no way in HTTP to later send an asynchronous response indicating the outcome of the request.
     * It is intended for cases where another process or server handles the request, or for batch processing.
     */
    export const ACCEPTED = 202;

    /**
     * This response code means the returned meta-information is not exactly the same as is available from the origin server, but is collected from a local or a third-party copy.
     * This is mostly used for mirrors or backups of another resource.
     * Except for that specific case, the "200 OK" response is preferred to this status.
     */
    export const NON_AUTHORITATIVE_INFORMATION = 203;

    /**
     * There is no content to send for this request, but the headers may be useful.
     * The user-agent may update its cached headers for this resource with the new ones.
     */
    export const NO_CONTENT = 204;

    /**
     * Tells the user-agent to reset the document which sent this request.
     */
    export const RESET_CONTENT = 205;

    /**
     * This response code is used when the Range header is sent from the client to request only part of a resource.
     */
    export const PARTIAL_CONTENT = 206;

    //////////////////////////////
    //////// 300x
    //////////////////////////////
    /**
     * The request has more than one possible response. The user-agent or user should choose one of them.
     * There is no standardized way of choosing one of the responses, but HTML links to the possibilities are recommended so the user can pick.
     */
    export const MULTIPLE_CHOICES = 300;

    /**
     * The URL of the requested resource has been changed permanently.
     * The new URL is given in the response.
     */
    export const MOVED_PERMANENTLY = 301;

    /**
     * This response code means that the URI of requested resource has been changed temporarily.
     * Further changes in the URI might be made in the future.
     * Therefore, this same URI should be used by the client in future requests.
     */
    export const FOUND = 302;

    /**
     * The server sent this response to direct the client to get the requested resource at another URI with a GET request.
     */
    export const SEE_OTHER = 303;

    /**
     * This is used for caching purposes.
     * It tells the client that the response has not been modified, so the client can continue to use the same cached version of the response.
     */
    export const NOT_MODIFIED = 304;

    /**
     * The server sends this response to direct the client to get the requested resource at another URI with same method that was used in the prior request.
     * This has the same semantics as the 302 Found HTTP response code, with the exception that the user agent must not change the HTTP method used:
     * If a POST was used in the first request, a POST must be used in the second request.
     */
    export const TEMPORARY_REDIRECT = 307;

    /**
     * This means that the resource is now permanently located at another URI, specified by the Location: HTTP Response header.
     * This has the same semantics as the 301 Moved Permanently HTTP response code, with the exception that the user agent must not change the HTTP method used:
     * If a POST was used in the first request, a POST must be used in the second request.
     */
    export const PERMANENT_REDIRECT = 308;

    //////////////////////////////
    //////// 400x
    //////////////////////////////
    /**
     * The server could not understand the request due to invalid syntax.
     */
    export const BAD_REQUEST = 400;

    /**
     * Although the HTTP standard specifies "unauthorized", semantically this response means "unauthenticated".
     * That is, the client must authenticate itself to get the requested response.
     */
    export const UNAUTHORIZED = 401;

    /**
     * The client does not have access rights to the content; that is, it is unauthorized, so the server is refusing to give the requested resource.
     * Unlike 401, the client's identity is known to the server.
     */
    export const FORBIDDEN = 403;

    /**
     * The server can not find the requested resource.
     * In the browser, this means the URL is not recognized.
     * In an API, this can also mean that the endpoint is valid but the resource itself does not exist.
     * Servers may also send this response instead of 403 to hide the existence of a resource from an unauthorized client.
     * This response code is probably the most famous one due to its frequent occurrence on the web.
     */
    export const NOT_FOUND = 404;

    /**
     * The request method is known by the server but has been disabled and cannot be used.
     * For example, an API may forbid DELETE-ing a resource.
     * The two mandatory methods, GET and HEAD, must never be disabled and should not return this error code.
     */
    export const METHOD_NOT_ALLOWED = 405;

    /**
     * This response is sent when the web server, after performing server-driven content negotiation,
     * doesn't find any content that conforms to the criteria given by the user agent.
     */
    export const NOT_ACCEPTABLE = 406;

    /**
     * This is similar to 401 but authentication is needed to be done by a proxy.
     */
    export const PROXY_AUTHENTICATION_REQUIRED = 407;

    /**
     * This response is sent on an idle connection by some servers, even without any previous request by the client.
     * It means that the server would like to shut down this unused connection.
     * This response is used much more since some browsers, like Chrome, Firefox 27+, or IE9, use HTTP pre-connection mechanisms to speed up surfing.
     * Also note that some servers merely shut down the connection without sending this message.
     */
    export const REQUEST_TIMEOUT = 408;

    /**
     * This response is sent when a request conflicts with the current state of the server.
     */
    export const CONFLICT = 409;

    /**
     * This response is sent when the requested content has been permanently deleted from server, with no forwarding address.
     * Clients are expected to remove their caches and links to the resource.
     * The HTTP specification intends this status code to be used for "limited-time, promotional services".
     * APIs should not feel compelled to indicate resources that have been deleted with this status code.
     */
    export const GONE = 410;

    /**
     * Server rejected the request because the Content-Length header field is not defined and the server requires it.
     */
    export const LENGTH_REQUIRED = 411;

    /**
     * The client has indicated preconditions in its headers which the server does not meet.
     */
    export const PRECONDITION_FAILED = 412;

    /**
     * Request entity is larger than limits defined by server; the server might close the connection or return an Retry-After header field.
     */
    export const PAYLOAD_TOO_LONG = 413;

    /**
     * The URI requested by the client is longer than the server is willing to interpret.
     */
    export const URI_TOO_LONG = 414;

    /**
     * The media format of the requested data is not supported by the server, so the server is rejecting the request.
     */
    export const UNSUPPORTED_MEDIA_TYPE = 415;

    /**
     * The range specified by the Range header field in the request can't be fulfilled; it's possible that the range is outside the size of the target URI's data.
     */
    export const RANGE_NOT_SATISFIABLE = 416;

    /**
     * This response code means the expectation indicated by the Expect request header field can't be met by the server.
     */
    export const EXPECTATION_FAILED = 417;

    /**
     * The server refuses the attempt to brew coffee with a teapot.
     */
    export const IM_A_TEAPOT = 418;

    /**
     * The request was well-formed but was unable to be followed due to semantic errors.
     */
    export const UNPROCESSABLE_ENTITY = 422;

    /**
     * Indicates that the server is unwilling to risk processing a request that might be replayed.
     */
    export const TOO_EARLY = 422;

    /**
     * The server refuses to perform the request using the current protocol but might be willing to do so after the client upgrades to a different protocol.
     * The server sends an Upgrade header in a 426 response to indicate the required protocol(s).
     */
    export const UPGRADE_REQUIRED = 426;

    /**
     * The origin server requires the request to be conditional.
     * This response is intended to prevent the 'lost update' problem, where a client GETs a resource's state, modifies it, and PUTs it back to the server,
     * when meanwhile a third party has modified the state on the server, leading to a conflict.
     */
    export const PRECONDITION_REQUIRED = 428;

    /**
     * The user has sent too many requests in a given amount of time ("rate limiting").
     */
    export const TOO_MANY_REQUESTS = 429;

    /**
     * The server is unwilling to process the request because its header fields are too large.
     * The request may be resubmitted after reducing the size of the request header fields.
     */
    export const REQUEST_HEADER_FIELDS_TOO_LARGE = 431;

    //////////////////////////////
    //////// 500x
    //////////////////////////////
    /**
     * The server has encountered a situation it doesn't know how to handle.
     */
    export const INTERNAL_SERVER_ERROR = 500;

    /**
     * The request method is not supported by the server and cannot be handled.
     * The only methods that servers are required to support (and therefore that must not return this code) are GET and HEAD.
     */
    export const NOT_IMPLEMENTED = 501;

    /**
     * This error response means that the server, while working as a gateway to get a response needed to handle the request, got an invalid response.
     */
    export const BAD_GATEWAY = 502;

    /**
     * The server is not ready to handle the request.
     * Common causes are a server that is down for maintenance or that is overloaded.
     * Note that together with this response, a user-friendly page explaining the problem should be sent.
     * This responses should be used for temporary conditions and the Retry-After:
     * HTTP header should, if possible, contain the estimated time before the recovery of the service.
     * The webmaster must also take care about the caching-related headers that are sent along with this response,
     * as these temporary condition responses should usually not be cached.
     */
    export const SERVICE_UNAVAILABLE = 503;

    /**
     * This error response is given when the server is acting as a gateway and cannot get a response in time.
     */
    export const GATEWAY_TIMEOUT = 504;

    /**
     * The HTTP version used in the request is not supported by the server.
     */
    export const HTTP_VERSION_NOT_SUPPORTED = 505;

    /**
     * The server has an internal configuration error:
     * the chosen variant resource is configured to engage in transparent content negotiation itself, and is therefore not a proper end point in the negotiation process.
     */
    export const VARIANT_ALSO_NEGOTIATES = 506;

    /**
     * The method could not be performed on the resource because the server is unable to store the representation needed to successfully complete the request.
     */
    export const INSUFFICIENT_STORAGE = 507;

    /**
     * The server detected an infinite loop while processing the request.
     */
    export const LOOP_DETECTED = 508;

    /**
     * Further extensions to the request are required for the server to fulfil it.
     */
    export const NOT_EXTENDED = 510;

    /**
     * The 511 status code indicates that the client needs to authenticate to gain network access.
     */
    export const NETWORK_AUTHENTICATION_REQUIRED = 511;
}