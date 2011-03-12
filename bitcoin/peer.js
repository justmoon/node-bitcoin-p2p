var net = require('net');

var Peer = function (host) {
	this.host = host;
	this.port = 5900;
};

Peer.prototype.createConnection = function () {
	var c = net.createConnection(this.port, this.host);
	return c;
};

Peer.prototype.toString = function () {
	return this.host;
}

exports.Peer = Peer;
