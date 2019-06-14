//Import modules or path's
import Router from 'express'
import bookRoutes from './book/book.routes'
//Create Router Instance
const router = new Router()
bookRoutes(router)
//Export router
export default router