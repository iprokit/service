//Import Controllers
import customerController from './customer.controller'
//Create a Controllers
const customer = new customerController()
//Export Router
export default function (router) {
    //FeedType Table Services
    router.post('/customer', customer.addCustomer)
    router.get('/customer/:id', customer.findCustomerById)
    router.get('/customer', customer.findAll)
    router.put('/customer', customer.updateCustomer)
    router.delete('/customer/:id', customer.deleteCustomer)
}