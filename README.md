# Service
`Service` is a powerful, lightweight framework designed to streamline the development of efficient, reliable, and scalable services. Whether you're building a monolithic application or a suite of microservices, Service provides the tools you need to create robust systems. Built on a native HTTP server, Service leverages the Service Discovery Protocol (SDP) to enable seamless service discovery, and the Service Communication Protocol (SCP) to facilitate inter-service communication. With minimal code, Service provides a robust foundation for building interconnected systems that are both flexible and scalable.

# Features
* Native
* Lightweight
* Minimal Configuration
* Service Discovery
* Inter-Service Communication
* Native HTTP Server

# Installation
```sh
npm install @iprotechs/service --save
```

# User Service and Notification Service
Let's dive into an example where we build two microservices: `UserService` and `NotificationService`. These services will demonstrate how to manage users and respond to user-related events in a distributed system.

## UserService
`UserService` is responsible for managing users-handling user creation and listing users. It also broadcasts events whenever a new user is created.
```javascript
import Service, { HttpStatusCode } from '@iprotechs/service';

// Declare the service.
const userService = new Service('User');

// Define Router
const userRouter = userService.Route()
    .get('/list', (request, response, next) => {
        const users = [{ id: 1, name: 'John Doe' }, { id: 2, name: 'Jane Smith' }]; // Example users
        response.writeHead(HttpStatusCode.OK, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify(users));
    }).post('/create', (request, response, next) => {
        const user = { id: 1, name: 'John Doe' }; // Example user
        response.writeHead(HttpStatusCode.CREATED, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ message: 'User created successfully!' }));
        // Trigger a broadcast to all services that a user was created.
        userService.broadcast('created', user);
    });

// Mount Router
userService.mount('/user', userRouter);

// Define Remote Function
const userExecutor = userService.Execution()
    .func('list', (...args) => {
        const users = [{ id: 1, name: 'John Doe' }, { id: 2, name: 'Jane Smith' }]; // Example users
        return users;
    });

// Attach Remote Function
userService.attach('User', userExecutor);

// Start the service.
userService.start(3000, 6000, 5000, '224.0.0.2');
userService.on('start', () => {
    console.log(`${userService.identifier} has started!`);
});
```

1. **Service Declaration**: We start by declaring a `UserService` using the `Service` framework.
2. **Router Definition**: The service defines HTTP routes for listing users (`GET /user/list`) and creating users (`POST /user/create`). When a new user is created, the service broadcasts an event (`created`).
3. **Remote Function**: The service also defines a remote function `list` that other services can execute to retrieve the list of users.
4. **Service Start**: Finally, the service is started on a specific port and IP address.
    * The `start` method takes four arguments:
        1. **HTTP Port**: The port on which the service's HTTP server will run (e.g., `3000`).
        2. **SCP Port**: The port used for Service Communication Protocol (e.g., `6000`).
        3. **SDP Port**: The port used for Service Discovery Protocol (e.g., `5000`).
        4. **Multicast Address**: The multicast address used for service discovery (e.g., `224.0.0.2`).
    * **Note**: The SDP port and multicast address must be the same across all services to enable them to discover each other within the network.

## NotificationService
`NotificationService` listens for user-related events broadcasted by `UserService` and handles them appropriately-such as logging user creation events or fetching the list of users.
```javascript
import Service from '@iprotechs/service';

// Declare the service.
const notificationService = new Service('Notification');

// Link Notification to UserService
notificationService.linkTo('User');
const userLink = notificationService.linkOf('User');

// Start the service.
notificationService.start(3001, 6001, 5000, '224.0.0.2');
notificationService.on('start', async () => {
    console.log(`${notificationService.identifier} has started!`);

    // Listen to user creation events broadcasted by UserService.
    userLink.onBroadcast('created', (user) => {
        console.log(`User created:`, user);
    });

    // Execute 'User.list' on UserService to get the list of users.
    const users = await userLink.execute('User.list');
    console.log(`List of Users:`, users);
});
```

1. **Service Declaration**: `NotificationService` is declared to handle notifications and events related to users.
2. **Linking Services**: The service links to `UserService` to listen to its broadcasts and execute its remote functions.
3. **Service Start**: The service starts on a different port and listens for user creation events (`created`). When a new user is created, it logs the information. It can also retrieve the list of users by executing the `User.list` function from `UserService`.
    * The start method for `NotificationService` is similar to `UserService`, with the SDP port and multicast address needing to be consistent across services to ensure proper service discovery.
    
# Running the Services
To run both services, you would typically use the following command:
```sh
npm start
```

This setup allows you to see how the `UserService` and `NotificationService` interact within a microservices architecture, demonstrating the ease with which `Service` enables service discovery, communication, and event-driven interactions.

## Versions:
| Version | Description               |
| ------- | ------------------------- |
| 1.0.0   | First release of Service. |