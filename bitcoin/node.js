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
		winston.info('Connecting to peer '+peer);
		this.addConnection(new Connection(this, peer.createConnection(), peer));
	} else if ("string" == typeof peer) {
		this.addPeer(new Peer(peer));
	} else {
		winston.log('error', 'Node.addPeer(): Invalid value provided for peer', {val: peer});
		throw 'Node.addPeer(): Invalid value provided for peer.';
	}
};

Node.prototype.addConnection = function (conn) {
	this.connections.push(conn);
	conn.addListener('version', this.handleConnect.bind(this));
};

Node.prototype.handleConnect = function (e) {
	this.storage.getEnds(function (err, heads, tails) {
		e.conn.sendGetBlocks(heads, '\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0');
	});
};

exports.Node = Node;
