# Pro-Micro

ProMicro is blazing fast, modern and powerful lightweight microservices framework. It helps you build efficient, reliable & scalable services that can talk to each other; quickly out of the box with very few lines of code. ProMicro provides many other features for building and managing your microservices.

The underyling API is built on `Express` and the database managment is done by `Sequelize`(RDB) and `Mongoose`(NoSQL). The service to service communication is fulfilled by STSCP.

# Features
* Fast & Lightweight
* High Availability
* Fault Tolerance(Retry, Timeout, Crash)
* Zero-dependency
* Zero-configuration
* API Server
* API Gateway
* Dynamic Route Mapping
* Proxy and Load-balancing
* API for Health Monitoring and Reporting
* Native Middlewear Support
* Dynamic Service Discovery
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
* Generic Controller, Model, Publisher
* Autowire & Inject Classes and Objects
* Supports Versioned Services
* Master-less Architecture
* Docker Compatible
* Decorators Support
* ES6 & ES7 Support
* Typescript Support

# Installation

* Install ProMicro.
```sh
npm install @iprotechs/pro-micro --save
```

* Install Node.js and Babel.
```sh
npm install @babel/core @babel/node babel-preset-env --save-dev
```

* Install Decorators Support.
```sh
npm install @babel/plugin-proposal-decorators @babel/plugin-proposal-class-properties --save-dev
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
Let's create your first microservice with ProMicro. It will be quick and painless.

```javascript
/**
 * index.js
 */
import MicroService from '@iprotechs/promicro';

//Declare microservice.
const helloMicroService = new MicroService();

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

| name | version | baseURL | NODE_ENV | API_PORT | STSCP_PORT
| --- | --- | --- | --- | --- | --- |
| `npm_package_name` | `npm_package_version` | `/$name` | `production` | `3000` | `6000` |

`Health`, `Report` and `Shutdown` endpoints are also created. Let's take a look, Open up *postman* or any other http client and call the below endpoints.

`Health` Endpoint: 
```sh
GET: http://localhost:$apiPort/$name/health
```

`Report` Endpoint: 
```sh
GET: http://localhost:$apiPort/$name/report
```

`Shutdown` Endpoint: 
```sh
POST: http://localhost:$apiPort/$name/shutdown
```

You can override the service variables by assigning options to service constructor like so.
```javascript
const baseURL = '/hello';
const options = {
    name: 'Hello Service',
    version: '1.0.0'
}
const helloMicroService = new MicroService(baseURL, options);
```

You can also override the environment variables by adding the following optional environment variables to .env file to the root folder of the project.
```sh
NODE_ENV=development
API_PORT=3001
STSCP_PORT=6001
```

Congratulations!!! you have successfully created your first Hello ProMicro Service.

# Hero Service
Lets create a hero service with CRUD API that responds to HTTP client and queries data from RDB(MySQL) Database.

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
import MicroService from '@iprotechs/promicro';

//Declare microservice.
const heroMicroService = new MicroService('/heroApi');

//Declare the database you want to use.
heroMicroService.useDB('mysql', true);

//Start the microservice.
heroMicroService.start(() => {
    console.log('Hero Microservice has started');
});
```

* hero.model.js
```javascript
import { Entity, RDBModel, RDBDataTypes } from '@iprotechs/promicro';

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
    //This model extends all the RDB properties. The model should only extend the database type declared with `service.useDB()` at the index.js;

    /**
     * Define pre/post hooks. 
     */
    static hooks(){

    }

    /**
     * Define relations(associations) to other models.
     */
    static associate(){

    }

    //Define additional DAO operations.
}
```

* hero.controller.js
```javascript
import { Controller, Get, Post, Put, Delete } from '@iprotechs/promicro';
import HeroModel from './hero.model';

/**
 * Define and extend the generic controller.
 * 
 * - You can override any function.
 * - By removing the decorator the endpoint will not be exposed.
 */
export default class HeroController extends Controller {
    @Post('/')
    async create(request, response) {
        await super.create(HeroModel, request, response);
    }

    @Put('/')
    async updateOneByID(request, response) {
        await super.updateOneByID(HeroModel, request, response);
    }

    @Delete('/:id')
    async deleteOneByID(request, response) {
        await super.deleteOneByID(HeroModel, request, response);
    }

    @Get('/')
    async getAll(request, response) {
        await super.getAll(HeroModel, request, response);
    }

    @Get('/id/:id')
    async getOneByID(request, response) {
        await super.getOneByID(HeroModel, request, response);
    }
    
    @Get('/orderBy/:orderType')
    async getAllOrderByCreatedAt(request, response) {
        await super.getAllOrderByCreatedAt(HeroModel, request, response);
    }

    //Define additional endpoints to handle business logic.
}
```

Great!!! Now lets test it, run the service and call the `Report` endpoint.

As you can see from the `Report` endpoint, The Service has **magically** found the `Model` and `Controller` files and injected them into the service and mapped them.

* You can configure the injection and auto wire to find files as per your criteria.
```javascript
//Example 1: Exclude all the models in the project.
heroMicroService.setAutoWireModelOptions({excludes: ['*']});

//Example 2: Include all the controllers in the project.
heroMicroService.setAutoInjectControllerOptions({includes: ['*']});

//Example 3: Include only the hero controller in the project.
heroMicroService.setAutoInjectControllerOptions({includes: ['hero']});

//Example 4: Exclude only the hero model in the project.
heroMicroService.setAutoWireModelOptions({excludes: ['hero']});
```

# Hero & Sidekick Service
Lets create a hero service and a sidekick service that can talk to each other through (STSCP)service to service communication protocol.

## HeroService
* index.js
```javascript
import MicroService from '@iprotechs/promicro';

//Declare microservice.
const heroMicroService = new MicroService();

heroMicroService.defineNode('localhost:6002', 'sidekickSvc');

//Start the microservice.
heroMicroService.start(() => {
    console.log('Hero Microservice has started.');
});
```

* hero.publisher.js
```javascript
import { Publisher, Reply } from '@iprotechs/promicro';

export default class HeroPublisher extends Publisher {
    @Reply()
    async introduction(message, reply){
        reply.send({intro: 'I am Hero Service.'});
    }
}
```

* hero.controller.js
```javascript
import { Controller, HttpCodes, Get, Mesh } from '@iprotechs/promicro';

export default class HeroController extends Controller {
    @Get('/')
    async callSidekick(request, response) {
        try {
            const data = await Mesh.sidekickSvc.Sidekick.introduction({});
            response.status(HttpCodes.OK).send({ status: true, data: data });
        } catch(error) {
            response.status(HttpCodes.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message });
        }
    }
}
```

## SidekickService
* index.js
```javascript
import MicroService from '@iprotechs/promicro';

//Declare microservice.
const sidekickMicroService = new MicroService();

sidekickMicroService.defineNode('localhost:6001', 'heroSvc');

//Start the microservice.
sidekickMicroService.start(() => {
    console.log('Sidekick Microservice has started.');
});
```

* sidekick.publisher.js
```javascript
import { Publisher, Reply } from '@iprotechs/promicro';

export default class SidekickPublisher extends Publisher {
    @Reply()
    async introduction(message, reply){
        reply.send({intro: 'I am Sidekick Service.'});
    }
}
```

* sidekick.controller.js
```javascript
import { Controller, HttpCodes, Get, Mesh } from '@iprotechs/promicro';

export default class SidekickController extends Controller {
    @Get('/')
    async callHero(request, response) {
        try {
            const data = await Mesh.heroSvc.Hero.introduction({});
            response.status(HttpCodes.OK).send({ status: true, data: data });
        } catch(error) {
            response.status(HttpCodes.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message });
        }
    }
}
```

Ok, that was a fun little project.

# Gateway Service
In this example we will implement a gateway service that will proxy requests to User and Hero services from the client.

* index.js
```javascript
import { Gateway } from '@iprotechs/promicro';

//Declare gateway.
const gatewayService = new Gateway();

//Forward the request directly.
gatewayService.all('/user/*', this.proxy('localhost:3001'));
gatewayService.all('/hero/*', this.proxy('localhost:3002'));

//Rewrite the reqest url to '/user/report'.
gatewayService.get('/user/help', this.proxy('localhost:3001', '/user/report'));

//Start the gateway service.
gatewayService.start(() => {
    console.log('Gateway Service has started.');
});
```