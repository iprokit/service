//Import Model or Path
import CustomerModel from './customer.model'
import httpStatus from 'http-status-codes'
//Create a Class
class Customer {
    /**
     * @description : This Method is used for store the Customer details
     * @param {Get the Customer Details} req 
     * @param {Send data or error message} res 
     */
    addCustomer(req, res) {
        console.log('Customer Details', req.body)
        try {
            CustomerModel.create(req.body)
                .then(() => { res.status(httpStatus.OK).send({ status: true, message: "Created Customer" }) })
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
     * @param {Send Customer Details or Error message} res 
     */
    findCustomerById(req, res) {
        try {
            CustomerModel.findById(req.params.id)
                .then(data => { res.status(httpStatus.OK).send({ status: true, data: data }) })
                .catch(err => { res.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: err }) })
        } catch (error) {
            res.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error })
        }
    }
    /**
     * @description: This method is used for find all Customer data
     * @param {req for all Customers} req 
     * @param {Send all Customer data or Error message} res 
     */
    findAll(req, res) {
        try {
            CustomerModel.findAll()
                .then(data => { res.status(httpStatus.OK).send({ status: true, data: data }) })
                .catch(err => { res.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: err }) })
        } catch (error) {
            res.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error })
        }
    }
    /**
     * @description : This Method is used for Update Customer data based on Id
     * @param {Get _Id and Update details based on _Id} req 
     * @param {Send Updated data or Error message} res 
     */
    updateCustomer(req, res) {
        try {
            //First Find 
            CustomerModel.findById(req.body.id)
                .then(data => {
                    console.log(data)
                    if (data) {
                        //Update
                        CustomerModel.update(req.body, { where: { FEED_TYPE_ID: req.body.id } })
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
     * @description: This method is used for Delete Customer data based on Id
     * @param {Get _id and destroy(Delete) Customer row based on _Id} req 
     * @param {Send Success or Error message} res 
     */
    deleteCustomer(req, res) {
        try {
            //First Find 
            CustomerModel.findById(req.params.id)
                .then(data => {
                    if (data) {
                        //Delete
                        CustomerModel.destroy({ where: { FEED_TYPE_ID: req.params.id } })
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
//Export Customer Controller Class
export default Customer