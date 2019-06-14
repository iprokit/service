//ENVIRNOMENT VARIABLES IMPORT
//Import Modules or Paths
import express from 'express'
import logger from 'morgan'
import createError from 'http-errors'
import cookieParser from 'cookie-parser'
//Routes
import router from './router'
//express
var app = express();   
//Express 
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.set('view engine', 'jade');
//Services
app.use('/api/customers',router)
// catch 404 and forward to error handler
app.use(function(req, res, next) {
    next(createError(404));
});
// error handler
app.use(function(err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};
    // render the error page
    res.status(err.status || 500);
    res.render('error');
});
const port = process.env.NODE_PORT || 3000;
app.listen(port, () => {
    console.log("Customer micro service running on",port);
});
//Export app object
export default app;