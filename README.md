# Service
`Service` is a powerful, lightweight framework designed to streamline the development of efficient, reliable, and scalable services. Built on a native HTTP server, Service leverages the Service Discovery Protocol (SDP) to enable seamless service discovery, and the Service Communication Protocol (SCP) to facilitate inter-service communication. With minimal code, Service provides a robust foundation for building interconnected systems that are both flexible and scalable.

# Features
* Native
* Lightweight
* Minimal Configuration
* Service Discovery
* Inter-Service Communication
* Native HTTP Server

# Installation
* Install Service.
```sh
npm install @iprotechs/service --save
```

* Install Node.js and Babel.
```sh
npm install @babel/core @babel/node babel-preset-env --save
```

# Hero Service
Let's create your first service. It will be quick and painless.
* index.js
```javascript
import Service from '@iprotechs/service';

//Declare service.
const heroService = new Service('Hero');

//Start the service.
heroService.start(3000, 6000, 5000, '224.0.0.2');
heroService.on('start', () => {
    console.log('Hero service has started');
});
```

Run the service.
```sh
npm start
```

Lets update service with HTTP routes.
```javascript

```

## Versions:
| Version | Description               |
| ------- | ------------------------- |
| 1.0.0   | First release of Service. |