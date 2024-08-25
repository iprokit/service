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

# Configuration
Add the following .babelrc file to the root folder of the project.
```javascript
{
    "presets": [
        [
            "env",
            {
                "targets": {
                    "node": "current"
                }
            }
        ]
    ]
}
```

# Hero Service
Let's create your first service. The process is quick and straightforward.
### Index
```javascript
import Service from '@iprotechs/service';

//Declare service.
const heroService = new Service('Hero');

//Start the service.
heroService.start(3000, 6000, 5000, '224.0.0.2');
heroService.on('start', () => {
    console.log(`${heroService.identifier} has started!`);
});
```

### HTTP
```javascript
//Define Router
const router = heroService.Route()
    .all('/', (request, response, next) => {
        next();
    }).get('/', (request, response, next) => {
        response.writeHead(200, { 'Content-Type': 'text/plain' });
        response.end('Welcome to Hero Service!');
    }).post('/', async (request, response, next) => {
        //Implement POST request.
    }).put('/', async (request, response, next) => {
        //Implement PUT request.
    }).patch('/', async (request, response, next) => {
        //Implement PATCH request.
    }).delete('/', async (request, response, next) => {
        //Implement DELETE request.
    });

//Mount Router
heroService.mount('/hero', router);
```

### SCP
```javascript
//Define Remote Function
const executor = heroService.Execution()
    .func('get', (...args) => {
        return hero;
    });

//Attach Remote Function
heroService.attach('Hero', executor);

//Broadcast `Hero.created` to all the subscribed services.
heroService.broadcast('Hero.created', ...args);
```

# Sidekick Service
### SCP
```javascript
//Declare service
const sidekickService = new Service('Sidekick');

//Link Sidekick to Hero
sidekickService.linkTo('Hero');

//Get Hero Link
const linkToHeroService = sidekickService.linkOf('Hero');

//Execute 'Hero.get' on Hero service.
const returned = await linkToHeroService.execute('Hero.get');
console.log(returned);

//Listen to broadcasts from Hero service.
linkToHeroService.onBroadcast('Hero.created', (...args) => {
    console.log(args);
});
```

Run the service.
```sh
npm start
```

Congratulations!!! you have successfully created your first service.

## Versions:
| Version | Description               |
| ------- | ------------------------- |
| 1.0.0   | First release of Service. |