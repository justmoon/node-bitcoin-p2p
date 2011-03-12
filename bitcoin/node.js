var winston = require('winston'); // logging

var Peer = require('./peer').Peer;
var Connection = require('./connection').Connection;

var Node = function (storage) {
	this.peers = [];
	this.connections = [];
	this.storage = storage;
};

Node.prototype.start = function () {
	
};

Node.prototype.addPeer = function (peer) {
	if (peer instanceof Peer) {
		this.peers.push(peer);
		winston.log('Connecting to peer '+peer);
		this.addConnection(new Connection(this, peer.createConnection(), peer));
	} else if ("string" == typeof peer) {
		this.addPeer(new Peer(peer));
	} else {
		throw 'Node.addPeer(): Invalid value provided for peer: "'+peer+'"';
	}
};

Node.prototype.addConnection = function (conn) {
	this.connections.push(conn);
};

exports.Node = Node;
