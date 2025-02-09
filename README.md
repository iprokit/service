# Service

`Service` is a powerful, lightweight framework designed to simplify the development of efficient, reliable, and scalable applications. Whether you're developing a monolithic system or a suite of interconnected microservices, `Service` simplifies the process with minimal configuration.

# Features

- **Hypertext Transfer Protocol (HTTP):** Define and manage routes for handling web requests with support for dynamic and wildcard paths.
- **Service Communication Protocol (SCP):** Create robust inter-service communication with remote functions, broadcasts, and workflows.
- **Service Discovery Protocol (SDP):** Dynamically discover and link services for seamless interaction in distributed systems.

# Installation

```sh
npm install @iprolab/service --save
```

# Quick Start

Here’s how to get a basic service running:

```javascript
import Service from '@iprolab/service';

// Create a service instance.
const service = new Service('MyService');

// Listen for service events.
service.on('start', () => console.log('Service has started successfully.'));
service.on('stop', () => console.log('Service has stopped successfully.'));

// Start the service.
await service.start(3000, 6000, 5000, '224.0.0.2');
console.log('Service is running: HTTP Port: 3000, SCP Port: 6000, SDP Port: 5000, Multicast Address: 224.0.0.2.');
```

# HTTP (Hypertext Transfer Protocol)

The **HTTP** module provides the tools to define, expose, and manage routes for handling client requests efficiently.

## Routes

Create HTTP routes to handle client requests with ease. The framework supports all standard HTTP methods and offers flexible options for advanced routing.

### Get

Handle `GET` requests to retrieve resources:

```javascript
service.get('/products', (request, response) => {
	response.end('Retrieve all products');
});
```

### Post

Handle `POST` requests to create resources:

```javascript
service.post('/products', (request, response) => {
	response.end('Create a new product');
});
```

### Put

Handle `PUT` requests to update resources entirely:

```javascript
service.put('/products/:id', (request, response) => {
	response.end(`Update product with ID: ${request.params.id}`);
});
```

### Patch

Handle `PATCH` requests to update resources partially:

```javascript
service.patch('/products/:id', (request, response) => {
	response.end(`Partially update product with ID: ${request.params.id}`);
});
```

### Delete

Handle `DELETE` requests to delete resources:

```javascript
service.delete('/products/:id', (request, response) => {
	response.end(`Delete product with ID: ${request.params.id}`);
});
```

### All

Handle any HTTP method for a specific route:

```javascript
service.all('/products', (request, response) => {
	response.end('Handle all methods for /products');
});
```

## Dynamic Parameters

Capture and use dynamic URL parameters to create flexible routes:

```javascript
service.get('/products/:id', (request, response) => {
	const { id } = request.params;
	response.end(`Retrieve product with ID: ${id}`);
});
```

## Query Parameters

Extract and use query parameters from the request URL:

```javascript
service.get('/products/search', (request, response) => {
	const { category, price } = request.query;
	response.end(`Search products in category: ${category} with price: ${price}`);
});
```

## Multiple Handlers

Chain multiple handlers for modular request processing. Use `next()` to pass control:

```javascript
const validateRequest = (request, response, next) => {
	console.log('Validating request');
	next();
};

const processRequest = (request, response) => {
	response.end('Request processed successfully');
};

service.get('/products/process', validateRequest, processRequest);
```

## Router

Organize and manage related routes with the `Router` class.

### Create and Mount Routers

Create a router and mount it to the service:

```javascript
import { Router } from '@iprolab/service';

const router = new Router();

router.get('/users', (request, response) => {
	response.end('Get all users');
});

service.mount('/', router);
```

### Mount Routes on the Same Path

Mount multiple routers on the same path to handle different functionalities:

```javascript
const userRouter = new Router();
const productRouter = new Router();

userRouter.get('/users', (request, response) => {
	response.end('User route');
});
productRouter.get('/products', (request, response) => {
	response.end('Product route');
});

service.mount('/', userRouter, productRouter);
```

### Mount Routes on a Parent Router

Nest routes under a parent router for hierarchical organization:

```javascript
const apiRouter = new Router();
const userRouter = new Router();

userRouter.get('/profile', (request, response) => {
	response.end('User profile');
});
apiRouter.mount('/users', userRouter);

service.mount('/api', apiRouter);
```

## Wildcard Paths

Use wildcard routes to match dynamic patterns.

### Match Routes

Catch-all handler for unmatched routes:

```javascript
service.get('*', (request, response) => {
	response.end(`No matching route for: ${request.url}`);
});
```

### Match Nested Routes

Match nested paths under a specific route:

```javascript
service.get('/categories/*', (request, response) => {
	response.end(`Nested path: ${request.url}`);
});
```

### Match Prefix-Based Routes

Match routes starting with a specific prefix:

```javascript
service.get('/prod*', (request, response) => {
	response.end(`Matched prefix route: ${request.url}`);
});
```

# SDP (Service Discovery Protocol)

The **SDP** module allows services to automatically discover and connect to each other within a network. This simplifies the process of linking services and ensures seamless communication between them.

## Linking Services

### Discoverable Target Service

A service can be configured to become discoverable on the network, allowing other services to link to it.

```javascript
import Service from '@iprolab/service';

// Create a discoverable service instance.
const serviceA = new Service('ServiceA');

// Start the service to make it discoverable.
await serviceA.start(3000, 6000, 5000, '224.0.0.2');
console.log('ServiceA is discoverable on SDP (Port: 5000, Address: 224.0.0.2).');
```

### Linking to a Target Service

A service can link to a discoverable target service using the `RemoteService` class. This establishes a connection during startup, enabling communication between the two services.

```javascript
import Service, { RemoteService } from '@iprolab/service';

// Create a service instance.
const serviceB = new Service('ServiceB');

// Link to ServiceA using the RemoteService class.
const remoteToA = new RemoteService('RemoteToA');
serviceB.link('ServiceA', remoteToA);

// Start the service.
await serviceB.start(4000, 7000, 5000, '224.0.0.2');
console.log('ServiceB is running and linked to ServiceA.');
```

# SCP (Service Communication Protocol)

The **SCP** module enables seamless interaction between services by defining remote functions, broadcasting messages, and coordinating complex workflows. SCP supports various communication modes, making it easy to tailor inter-service interactions to your system’s requirements.

## Broadcast

Broadcast messages to notify multiple services simultaneously. This is useful for system-wide updates, alerts, or notifications.

Send a broadcast to all subscribed services:

```javascript
await serviceA.broadcast('Catalog.updated', { id: 'P12345', name: 'Wireless Headphones' });
```

Subscribe to broadcast events and handle incoming messages:

```javascript
remoteToA.on('Catalog.updated', (product) => {
	console.log(`Product Details: ID - ${product.id}, Name - ${product.name}`);
});
```

## Execution (Remote Functions)

SCP allows services to expose and call remote functions for direct, targeted communication.

### Message/Reply

The message-reply model enables direct communication between two services. This pattern is particularly suited for synchronous operations where the caller needs an immediate reply from the callee.

Expose a reply function to fetch product details:

```javascript
serviceA.reply('getProduct', (productId) => {
	return { id: productId, name: 'Wireless Headphones', price: 99.99, stock: 25 };
});
```

Call a remote function to retrieve product details:

```javascript
const product = await remoteToA.message('getProduct', 'P12345');
console.log(`Product Details:`, product);
```

### Conduct/Conductor

The conduct-conductor model facilitates multi-step workflows across services. It enables coordinated operations with support for signaling (e.g., COMMIT, ROLLBACK) to ensure consistency in distributed workflows.

Expose a conductor function to handle multi-step workflows:

```javascript
serviceA.conductor('createOrder', (conductor, orderDetails) => {
	console.log(`Processing order:`, orderDetails);

	conductor.on('signal', (event, tags) => {
		console.log(`${event} signal received.`);
		conductor.signal(event, tags);
	});
	conductor.on('end', () => conductor.end());
});
```

Coordinate conductors across multiple services:

```javascript
import { Coordinator } from '@iprolab/service';

const coordinator = new Coordinator();
try {
	console.log('Starting workflow.');

	// Conduct operations across services.
	await remoteToA.conduct('createOrder', coordinator, { orderId: 'O123' });
	console.log('Order validated.');

	await remoteToB.conduct('processPayment', coordinator, { paymentId: 'P456' });
	console.log('Payment processed.');

	console.log('Sending COMMIT signal.');
	await coordinator.signal('COMMIT');
} catch (error) {
	console.error('Error occurred. Sending ROLLBACK signal.', error);
	await coordinator.signal('ROLLBACK');
} finally {
	console.log('Ending coordinator.');
	await coordinator.end();
}
```

### Omni

The Omni mode acts as a catch-all handler for operations that don’t match a specific function. It is particularly useful for handling undefined or broad operation patterns in a flexible and generic way.

```javascript
serviceA.omni('order', (incoming, outgoing) => {
	outgoing.end(`Operation '${incoming.operation}' completed.`);
});
```

## Executor

The Executor class organizes and manages remote functions within a service. Executors are ideal for creating modular, reusable logic for handling various operations.

### Create and Attach Executors

Create an executor and attach it to a service to handle specific operations:

```javascript
const executor = new Executor();

executor.reply('get', (userId) => {
	return { id: userId, name: 'John Doe', email: 'johndoe@example.com' };
});

serviceA.attach('User', executor);
```

### Attach Executions on the Same Operation

The Omni mode allows multiple handlers to process the same operation in steps. Use `proceed()` to pass control from one handler to the next.

Processing an Order in Steps:

```javascript
executor.omni('processOrder', (incoming, outgoing, proceed) => {
	console.log('Step 1: Validating order');
	proceed(); // Pass control to the next handler
});

executor.omni('processOrder', (incoming, outgoing, proceed) => {
	console.log('Step 2: Checking inventory');
	proceed(); // Pass control to the next handler
});

executor.omni('processOrder', (incoming, outgoing) => {
	console.log('Step 3: Completing the order');
	outgoing.end('Order processed successfully.');
});
```

**Note:** The **Omni** mode is the only SCP mode that supports `proceed()` and allows multiple handlers for the same operation. Each handler in Omni mode shares the same `incoming` and `outgoing` objects, enabling step-by-step processing within the same execution context. Other modes (e.g., Reply, Conductor) do not support `proceed()` or multi-handler execution.

## Wildcard Operations

Wildcard operations provide dynamic handling for undefined or broad operation patterns. This is useful for logging, debugging, or fallback logic.

### Match All Unmatched Operations

Catch all unmatched operations using a wildcard handler:

```javascript
executor.omni('*', (incoming, outgoing) => {
	outgoing.end(`No handler defined for operation: ${incoming.operation}`);
});
```

### Match Operations with Specific Prefixes

Match operations dynamically based on a prefix to group related tasks:

```javascript
executor.omni('inventory*', (incoming, outgoing) => {
	outgoing.end(`Handled operation: ${incoming.operation}`);
});
```

# Versions:

| Version | Description                                                                                                                                                                                  |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.0.0   | First release of Service.                                                                                                                                                                    |
| 1.1.0   | Introduced `Router` and `Executor` as modular classes, and `Remote` to enhance service linking. Introduced `Orchestrator` and `Conductor` for coordinating signals across multiple services. |
| 1.1.1   | Formatted HTTP headers to follow a standard.                                                                                                                                                 |
| 1.2.0   | Removed HTTP proxy handler.                                                                                                                                                                  |
| 1.2.1   | Improved readability and optimized code.                                                                                                                                                     |
| 1.3.0   | Added connection pool to `RemoteService` and converted the SCP & SDP repositories to native modules.                                                                                         |
| 1.3.1   | Improved error handling for SCP client and server.                                                                                                                                           |
| 1.4.0   | Renamed `Orchestrator` to `Coordinator` and introduced a queue mechanism for the outgoing stream in the SCP server.                                                                          |
