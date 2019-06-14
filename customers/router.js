//Import modules or path's
import Router from 'express'
import customerRoutes from './customer/customer.routes'
//Create Router Instance
const router = new Router()
customerRoutes(router)
//Export router
export default router