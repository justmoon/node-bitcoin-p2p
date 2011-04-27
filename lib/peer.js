var net = require('net');

var Peer = function (host, port) {
	this.host = host;
	this.port = port ? port : 8333;
};

Peer.prototype.createConnection = function (callback) {
	try {
		var c = net.createConnection(this.port, this.host);
		callback(null,c);
	}
	catch(e) {
		callback(e,null);
	}
};

Peer.prototype.toString = function () {
	return this.host + ":" + this.port;
};

exports.Peer = Peer;
