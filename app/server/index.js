var express = require('express')
var app     = require('express')()
var server  = require('http').Server(app)
var path    = require('path')
var spawn   = require('child_process').spawn
var fs      = require('fs')
var ws      = require('websocket').server
var args    = require('yargs').argv
var port    = args.port || process.env.LINUX_DASH_SERVER_PORT || 80
var user    = args.user
var pass    = args.pass
var auth    = require('basic-auth');

server.listen(port, function() {
  console.log('Linux Dash Server Started on port ' + port + '!');
})

app.use(function(req, res, next) {
  if (user && pass) {
   var auth_req = auth(req);
   if (!auth_req || user !== auth_req.name || pass !== auth_req.pass) {
     res.set('WWW-Authenticate', 'Basic realm="Prohibited"');
     return res.status(401).send();
   }
  }
  return next();
});

app.use(express.static(path.resolve(__dirname + '/../')))

app.get('/', function (req, res) {
	res.sendFile(path.resolve(__dirname + '/../index.html'))
})

app.get('/websocket', function (req, res) {

  res.send({
    websocket_support: true,
  })

})

wsServer = new ws({
	httpServer: server
})

var nixJsonAPIScript = __dirname + '/linux_json_api.sh'

function getPluginData(pluginName, callback) {
  var command = spawn(nixJsonAPIScript, [ pluginName, '' ])
  var output  = []

  command.stdout.on('data', function(chunk) {
    output.push(chunk.toString())
  })

  command.on('close', function (code) {
    callback(code, output)
  })
}

wsServer.on('request', function(request) {

	var wsClient = request.accept('', request.origin)

  wsClient.on('message', function(wsReq) {

    var moduleName = wsReq.utf8Data
    var sendDataToClient = function(code, output) {
      if (code === 0) {
        var wsResponse = '{ "moduleName": "' + moduleName + '", "output": "'+ output.join('') +'" }'
        wsClient.sendUTF(wsResponse)
      }
    }

    getPluginData(moduleName, sendDataToClient)

  })

})

app.get('/server/', function (req, res) {

	var respondWithData = function(code, output) {
		if (code === 0) res.send(output.toString())
		else res.sendStatus(500)
	}

  getPluginData(req.query.module, respondWithData)
})
