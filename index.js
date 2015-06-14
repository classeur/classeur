var connect = require('connect');
var http = require('http');
var serveStatic = require('serve-static');

var app = connect();
app.use('/assets', serveStatic(__dirname + '/bower_components/classets'));
app.use(serveStatic(__dirname + '/public'));

var port = process.env.PORT || 11583;
http.createServer(app).listen(port, function() {
	console.log('Server started http://localhost:' + port);
});

