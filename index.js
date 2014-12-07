var cluster = require('cluster');
var express = require('express');
var serveStatic = require('serve-static');

var app = express();
app.use(serveStatic(__dirname + '/public'));

if(!process.env.NO_CLUSTER && cluster.isMaster) {
	var count = require('os').cpus().length;
	for(var i = 0; i < count; i++) {
		cluster.fork();
	}
	cluster.on('exit', function() {
		console.log('Worker died. Spawning a new process...');
		cluster.fork();
	});
}
else {
	var port = process.env.PORT || 11583;
	app.listen(port, null, function() {
		console.log('Server started: http://localhost:' + port);
	});
}

