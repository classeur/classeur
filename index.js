var connect = require('connect')
var http = require('http')
var path = require('path')
var serveStatic = require('serve-static')

var app = connect()
app.use('/assets', serveStatic(path.join(path.dirname(require.resolve('classets/package')), 'public')))
app.use(serveStatic(path.join(__dirname, 'public')))

var port = process.env.PORT || 11583
var addr = process.env.BINDING_ADDR || 'localhost'
http.createServer(app).listen(port, addr, function() {
	console.log('Server started http://' + addr + ':' + port) // eslint-disable-line no-console
})
