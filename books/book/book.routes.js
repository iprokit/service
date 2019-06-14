//Import Controllers
import bookController from '../book/book.controller'
//Create a Controllers
const book = new bookController()
//Export Router
export default function (router) {
    //FeedType Table Services
    router.post('/book', book.addBook)
    router.get('/book/:id', book.findBookById)
    router.get('/book', book.findAll)
    router.put('/book', book.updateBook)
    router.delete('/book/:id', book.deleteBook)
}