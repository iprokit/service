# Micro

Micro is blazing fast, modern and powerful lightweight microservices framework. It helps you build efficient, reliable and scalable services that can discover and talk to each other quickly out of the box with very few lines of code. Micro provides many other features for building and managing your microservices.

The underyling API is built on `Express` and the database managment is done by `Sequelize`(RDB) and `Mongoose`(NoSQL). The service to service communication is fulfilled by SCP.

# Features
* Fast & Lightweight
* High Availability
* Fault Tolerance(Retry, Timeout, Crash)
* Modular & Customizable
* Zero-dependency
* Zero-configuration
* Service-Discovery
* Plugable components & middlewares
* HTTP Server
* SCP Server
* Gateway Support
    * Proxy
* Dynamic Route Mapping
* Endpoints for Health Monitoring and Reporting
* Native Middlewear Support
* Service to service communication Support
    * Asynchronous message/reply
    * Event Broadcasts
* (NoSQL)ODM Support
    * Mongo Database
* (RDB)ORM Support
    * MySQL Database
    * PostgresSQL Database
    * SQLite Database
    * Maria Database
    * Microsoft SQL Database
* Auto Sync Tables/Collections
* Generic/Customizable Controllers, Models, Messengers
* Autowire & Inject Classes and Objects
* Auto Create Endpoints
* Auto Create Actions
* Production Ready Logging
* Supports Versioned Services
* Master-less Architecture
* Docker Compatible
* Decorators Support
* Typescript Support
* ES6 & ES7 Support

# Installation

* Install Micro.
```sh
npm install @iprotechs/micro --save
```

* Install Node.js and Babel.
```sh
npm install @babel/core @babel/node babel-preset-env --save
```

* Install Decorators Support.
```sh
npm install @babel/plugin-proposal-decorators @babel/plugin-proposal-class-properties --save
```

# Configuration

* Add the following .babelrc file to the root folder of the project. To enable decorators support during transpiling.
```json
{
  "presets": [
      ["env", {
          "targets": { "node": "current"}
      }]
  ],
  "plugins": [
    ["@babel/plugin-proposal-decorators", { "legacy": true}],
    ["@babel/plugin-proposal-class-properties", { "loose": true}]
  ]
}
```

* Add the following jsconfig.json file to the root/src folder of the project. To enable decorators support during compilation.
```json
{
    "compilerOptions": {
        "experimentalDecorators": true
    }
}
```

# Hello Microservice
Let's create your first microservice with Micro. It will be quick and painless.

```javascript
/**
 * index.js
 */
import Micro from '@iprotechs/micro';

//Declare microservice.
const helloMicroService = Micro();

//Start the microservice.
helloMicroService.start(() => {
    console.log('Hello Microservice has started');
});
```

Run the service.

```sh
npm start
```

By default the service is assigned the following service and environment variables.

## Service Variables

| name               | version               |
|--------------------|-----------------------|
| `npm_package_name` | `npm_package_version` |

## Environment Variables

| NODE_ENV     | HTTP_PORT | SCP_PORT | DISCOVERY_PORT | DISCOVERY_IP | LOG_PATH |
|--------------|-----------|----------|----------------|--------------|----------|
| `production` | `3000`    | `6000`   | `5000`         | `224.0.0.1`  | `/logs`  |

`Health` and `Report` endpoints are also created. Let's take a look, Open up *postman* or any other http client and call the below endpoints.

`Health` Endpoint: 
```sh
GET: http://localhost:${httpPort}/health
```

`Report` Endpoint: 
```sh
GET: http://localhost:${httpPort}/report
```

You can override the service variables by assigning options like so.
```javascript
const helloMicroService = Micro({ name: 'Hello-Service', version: '1.0.0' });
```

You can also override the environment variables by adding the following optional environment variables to .env file to the root folder of the project.
```sh
NODE_ENV='development'
HTTP_PORT=3001
SCP_PORT=6001
DISCOVERY_PORT=5001
DISCOVERY_IP='224.0.0.2'
LOG_PATH='/user/logs'
```

Congratulations!!! you have successfully created your first Hello Micro Service.

# Hero Service
Lets create a hero service with CRUD operations that responds to HTTP client and queries data from RDB(MySQL) Database.

Add the following optional environment variables to .env file to the root folder of the project to configure the database.

* .env
```sh
DB_HOST=
DB_NAME=
DB_USERNAME=
DB_PASSWORD=
```

* index.js
```javascript
import Micro from '@iprotechs/micro';

//Declare microservice.
const heroMicroService = Micro({ db: { type: 'mysql', paperTrail: true } });

//Start the microservice.
heroMicroService.start(() => {
    console.log('Hero Microservice has started');
});
```

* hero.model.js
```javascript
import { Entity, RDBModel, RDBDataTypes } from '@iprotechs/micro';

/**
 * Define the ORM entity by calling the decorator and declaring its attributes.
 */
@Entity({
    name: 'heros',
    attributes: {
        firstName: {
            type: RDBDataTypes.STRING(30),
            allowNull: false
        },
        lastName: {
            type: RDBDataTypes.STRING(30),
            allowNull: false
        },
        email: {
            type: RDBDataTypes.STRING(40),
            allowNull: true,
            unique: true
        }
    }
})
export default class HeroModel extends RDBModel {
    //This model extends all the RDB properties. The model should only extend the database type declared in index.js;

    /**
     * Define pre/post hooks. 
     */
    static hooks() {
        //Add Hooks
    }

    /**
     * Define relations(associations) to other models.
     */
    static associate() {
        //Define associations
    }

    //Define additional DAO operations.
}
```

* hero.controller.js
```javascript
import { Controller, Get, Post, Put, Delete } from '@iprotechs/micro';
import HeroModel from './hero.model';

/**
 * Define and extend the generic controller.
 * 
 * - You can override any function.
 * - By removing the decorator the endpoint will not be exposed.
 */
export default class HeroController extends Controller {
    constructor() {
        super(HeroModel);
    }

    @Post('/')
    async create(request, response) {
        await super.create(request, response);
    }

    @Get('/')
    async getAll(request, response) {
        await super.getAll(request, response);
    }

    @Put('/:id')
    async updateOneByID(request, response) {
        await super.updateOneByID(request, response);
    }

    @Delete('/:id')
    async deleteOneByID(request, response) {
        await super.deleteOneByID(request, response);
    }

    @Get('/id/:id')
    async getOneByID(request, response) {
        await super.getOneByID(request, response);
    }

    //Define additional endpoints to handle business logic.
}
```

Great!!! Now lets test it, run the service and call the `Report` endpoint.

As you can see from the `Report` endpoint, The Service has **magically** found the `Model` and `Controller` files and injected them into the service and mapped them.

* You can configure the injection and auto wire to find files as per your criteria.
```javascript
//Default for models.
let autoWireModel = { include: { endsWith: ['.model'] } };

//Default for Controllers.
let autoInjectController = { include: { endsWith: ['.controller'] } };

Micro({ autoWireModel: autoWireModel, autoInjectController: autoInjectController });
```

# Hero & Sidekick Service
Lets create a hero service and a sidekick service that can talk to each other through (SCP)service communication protocol.

## HeroService
* index.js
```javascript
import Micro from '@iprotechs/micro';

//Declare microservice.
const heroMicroService = Micro();

/**
 * Discover `sidekickSvc` as `sidekick`.
 * sidekick: is the name of the `Node`.
 */
heroMicroService.discover('sidekickSvc', 'sidekick');

/**
 * Define broadcast names.
 */
heroMicroService.defineBroadcast('hero.poke');

//Start the microservice.
heroMicroService.start(() => {
    console.log('Hero Microservice started.');

    //Send a broadcast every 5 seconds.
    for (let i = 0; i <= 10; i++) {
        setTimeout(() => {
            const body = { message: 'Poke' };
            Micro.broadcast('hero.poke', body);
        }, 5 * 1000);
    }
});
```

* introduction.messenger.js
```javascript
import { Messenger, Reply } from '@iprotechs/micro';

export default class IntroductionMessenger extends Messenger {
    @Reply()
    async hello(message, reply) {
        try {
            reply.send({ intro: 'I am Hero Service.' });
        } catch (error) {
            reply.sendError(error);
        }
    }
}
```

* hero.controller.js
```javascript
import { Controller, HttpStatusCodes, Get, Mesh, SocketError, ErrorReply } from '@iprotechs/micro';

export default class HeroController extends Controller {
    @Get('/')
    async callSidekick(request, response) {
        try {
            //Call: Mesh.NodeName.MessengerName.functionName();
            const hello = await Mesh.sidekick.Introduction.hello({});
            response.status(HttpStatusCodes.OK).send({ status: true, data: hello });
        } catch (error) {
            //When node is unavailable.
            if (error instanceof SocketError) {
                response.status(HttpStatusCodes.SERVICE_UNAVAILABLE).send({ status: false, message: error.message });
                return;
            }
            //When error reply is received.
            if (error instanceof ErrorReply) {
                response.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message });
                return;
            }
            response.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message });
        }
    }
}
```

## Sidekick Service
* index.js
```javascript
import Micro, { Mesh } from '@iprotechs/micro';

//Declare microservice.
const sidekickMicroService = Micro();

/**
 * Discover `heroSvc` as `hero`.
 * hero: is the name of the `Node`.
 */
sidekickMicroService.discover('heroSvc', 'hero');

//Listen to broadcast from heroSvc.
Mesh.hero.on('hero.poke', (body) => {
    console.log(`HeroSvc has poked me: ${body}`);
});

//Start the microservice.
sidekickMicroService.start(() => {
    console.log('Sidekick Microservice has started.');
});
```

* introduction.messenger.js
```javascript
import { Messenger, Reply } from '@iprotechs/micro';

export default class IntroductionMessenger extends Messenger {
    @Reply()
    async hello(message, reply) {
        try {
            reply.send({ intro: 'I am Sidekick Service.' });
        } catch (error) {
            reply.sendError(error);
        }
    }
}
```

* sidekick.controller.js
```javascript
import { Controller, HttpStatusCodes, Get, Mesh, SocketError, ErrorReply } from '@iprotechs/micro';

export default class SidekickController extends Controller {
    @Get('/')
    async callHero(request, response) {
        try {
            //Call: Mesh.NodeName.MessengerName.functionName();
            const hello = await Mesh.hero.Introduction.hello({});
            response.status(HttpStatusCodes.OK).send({ status: true, data: hello });
        } catch (error) {
            //When node is unavailable.
            if (error instanceof SocketError) {
                response.status(HttpStatusCodes.SERVICE_UNAVAILABLE).send({ status: false, message: error.message });
                return;
            }
            //When error reply is received.
            if (error instanceof ErrorReply) {
                response.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message });
                return;
            }
            response.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message });
        }
    }
}
```

Ok, that was a fun little project.

# Gateway Service
In this example we will implement a gateway service that will proxy requests to Sidekick and Hero services from the client.

* index.js
```javascript
import Micro, { Proxy } from '@iprotechs/micro';

//Declare gateway.
const gatewayService = Micro();

//Discover.
gatewayService.discover('sidekickSvc', 'sidekick');
gatewayService.discover('heroSvc', 'hero');

//Proxy to sidekick.
const sidekickRouter = gatewayService.createRouter('/sidekick');
sidekickRouter.all('/help', Proxy.sidekick('/report')); //Forward /sidekick/help -> /report
sidekickRouter.all('/*', Proxy.sidekick()); //Forward all

//Proxy to hero.
const heroRouter = gatewayService.createRouter('/hero');
heroRouter.all('/help', Proxy.hero('/report')); //Forward /hero/help -> /report
heroRouter.all('/*', Proxy.hero()); //Forward all

//Start the gateway service.
gatewayService.start(() => {
    console.log('Gateway Service has started.');
});
```

## Versions:
| Version | Description             |
|---------|-------------------------|
| 1.0.0   | First release of Micro. |