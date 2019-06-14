//Import Model or Path
import bookModel from './book.model'
import httpStatus from 'http-status-codes'
import axios from 'axios'
//Create a Class
class Book {
    /**
     * @description : This Method is used for store the Book details
     * @param {Get the Book Details} req 
     * @param {Send data or error message} res 
     */
    addBook(req, res) {
        console.log('Book Details', req.body)
        try {
            bookModel.create(req.body)
                .then(() => { res.status(httpStatus.OK).send({ status: true, message: "Created Book" }) })
                .catch(err => {
                    res.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: err })
                })
        } catch (error) {
            console.log("Error is", error)
            res.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error })
        }
    }
    /**
     * @description: This method is used for Search by id
     * @param {Req for Find by id} req 
     * @param {Send Book Details or Error message} res 
     */
    findBookById(req, res) {
        try {
            bookModel.findById(req.params.id)
                .then(data => {
                    var results = {
                        book:data
                    }
                    axios.get("http://localhost:9001/api/customer").then((customerData) => {
                        results.customer = customerData.data.data
                        if(customerData){
                            res.status(httpStatus.OK).send({ status: true, data: results })
                        }
                        else{
                            res.status(httpStatus.OK).send({ status: true, data: [] })
                        }
                    }).catch(error => {
                        res.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message })
                    })
                })
                .catch(err => { res.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: err }) })
        } catch (error) {
            res.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error })
        }
    }
    /**
     * @description: This method is used for find all Book data
     * @param {req for all Books} req 
     * @param {Send all Book data or Error message} res 
     */
    findAll(req, res) {
        try {
            bookModel.findAll()
                .then(data => { res.status(httpStatus.OK).send({ status: true, data: data }) })
                .catch(err => { res.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: err }) })
        } catch (error) {
            res.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error })
        }
    }
    /**
     * @description : This Method is used for Update Book data based on Id
     * @param {Get _Id and Update details based on _Id} req 
     * @param {Send Updated data or Error message} res 
     */
    updateBook(req, res) {
        try {
            //First Find 
            bookModel.findById(req.body.id)
                .then(data => {
                    console.log(data)
                    if (data) {
                        //Update
                        bookModel.update(req.body, { where: { FEED_TYPE_ID: req.body.id } })
                            .then(() => { res.status(httpStatus.OK).send({ status: true, message: "Updated Successfully!" }) })
                            .catch(err => { res.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: err }) })
                    } else {
                        res.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: "Not updated,something went wrong" })
                    }
                })
                .catch(err => {
                    res.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: err })
                })
        } catch (error) {
            res.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error })
        }
    }
    /**
     * @description: This method is used for Delete Book data based on Id
     * @param {Get _id and destroy(Delete) Book row based on _Id} req 
     * @param {Send Success or Error message} res 
     */
    deleteBook(req, res) {
        try {
            //First Find 
            bookModel.findById(req.params.id)
                .then(data => {
                    if (data) {
                        //Delete
                        bookModel.destroy({ where: { FEED_TYPE_ID: req.params.id } })
                            .then(() => { res.status(httpStatus.OK).send({ status: true, message: "Deleted Successfully!" }) })
                            .catch(err => {
                                console.log(err)
                                res.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: err })
                            })
                    } else {
                        res.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: "Invalid id" })
                    }
                })
                .catch(err => {
                    res.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: err })
                })
        } catch (error) {
            console.log(error)
            res.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error })
        }
    }
}
//Export Book Controller Class
export default Book