import IproMicro from '../mico_sdk/index'

var micro = new IproMicro();

micro.start({
    serviceName: 'customer',
    serviceVersion: '1.0',
    serviceType: 'api'},
    'dev');