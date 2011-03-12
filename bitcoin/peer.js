var net = require('net');

var Peer = function (host) {
	this.host = host;
	this.port = 8332;
};

Peer.prototype.createConnection = function () {
	var c = net.createConnection(this.port, this.host);
};

Peer.toString = function () {
	return this.host;
}

exports.Peer = Peer;
