var net = require('net');

var Peer = function (host, port) {
	this.host = host;
	this.port = port ? port : 8333;
};

Peer.prototype.createConnection = function () {
	var c = net.createConnection(this.port, this.host);
	return c;
};

Peer.prototype.toString = function () {
	return this.host;
};

exports.Peer = Peer;
