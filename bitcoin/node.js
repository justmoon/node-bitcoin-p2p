var winston = require('winston'); // logging

var Peer = require('./peer').Peer;

var peers = [];

var Node = function () {

};

Node.prototype.start = function () {
	
};

Node.prototype.addPeer = function (peer) {
	if (peer instanceof Peer) {
		peers.push(peer);
		winston.log('Connecting to peer '+peer);
		peer.createConnection(this);
	} else if ("string" == typeof peer) {
		this.addPeer(new Peer(peer));
	} else {
		throw 'Node.addPeer(): Invalid value provided for peer: "'+peer+'"';
	}
};

exports.Node = Node;
