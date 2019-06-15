
import mosca from 'mosca'
//mosca server option
var options = {
    id: 'AQU_MQTT',
    port: 1884,//Number(process.env.NODE_PORT) || 1883,
    keepalive: 30,
    protocolId: 'MQTT',
    protocolVersion: 4,
    clean: true,                  //set to false to receive QoS 1 and 2 messages while offline
    reconnectPeriod: 1000,
    connectTimeout: 30 * 1000,
    will: {                       //in case of any abnormal client close this message will be fired
        topic: 'ErrorMsg',
        payload: 'Connection Closed abnormally..!',
        qos: 0,
        retain: false
    }
}
//Create mqtt mosca server instance
const mqtt = new mosca.Server(options)
class CustomMQTT {
    constructor() {
        
    }
    //Initialization of MQTT server
    intiMQTTServer() {
        mqtt.on('ready', () => {
            console.log("MQTT server running on port: " + options.port)
        })

        mqtt.on('clientConnected', (client) => {
            //Write to Database
            console.log('Connected to: %s', client.id)
        })

        mqtt.on('clientDisconnecting', (client) => {
            //Write to Database
            console.log('Disconnecting: %s', client.id)
        })

        mqtt.on('clientDisconnected', (client) => {
            //Write to Database
            console.log('Disconnected: %s', client.id)
        })

        mqtt.on('subscribed', (topic, client) => {
            //write logic to publish(that device is disconnected) if the client id is last know disconnected
            console.log('%s subscribed to topic: %s', client.id, topic)
        })

        mqtt.on('unsubscribed', (topic, client) => {
            console.log('%s unsubscribed to topic %s', client.id, topic)
        })

        mqtt.on('published', (packet, client) => {
            var topic = packet.topic
            if (!topic.includes('$SYS/')) { //Ignoring all default $SYS/ topics.
                var payload = packet.payload.toString()
                console.log('%s published a message: %o on topic: %s', client.id, payload, topic)
            }
        })

        mqtt.on('error', (error) => {
            console.log('Error on Server: ', error)
        })
    }
}
//Export the CustomMQTT class
export default CustomMQTT