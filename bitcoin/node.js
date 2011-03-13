var winston = require('winston'); // logging

var Peer = require('./peer').Peer;
var Connection = require('./connection').Connection;

var Node = function (storage) {
	this.peers = [];
	this.connections = [];
	this.storage = storage;
	this.nonce = new Buffer('a8deb8a83928aff8', 'hex');
	this.version = 32001;
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
	conn.addListener('verack', this.handleConnect.bind(this));
	conn.addListener('inv', this.handleInv.bind(this));
	conn.addListener('block', this.handleBlock.bind(this));
};

Node.prototype.handleConnect = function (e) {
	this.storage.getEnds(function (err, heads, tails) {
		e.conn.sendGetBlocks(heads, '\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0');
		//e.conn.sendGetAddr();
	});
};

Node.prototype.handleInv = function (e) {
	var invs = e.message.invs;
	var toCheck = invs.length;
	var unknownInvs = [];
	for (var i = 0; i < invs.length; i++) {
		var method;
		switch (invs[i].type) {
		case 1: // Transaction
			method = 'knowsTransaction';
			break;
		case 2: // Block
			method = 'knowsBlock';
			break;
		default: // Unknown type
			continue;
		}

		// This will asynchronously check all the blocks and transactions. Finally,
		// the last callback will trigger the 'getdata' request.
		this.storage[method](invs[i].hash, (function (err, known) {
			toCheck--;

			if (err) {
				winston.error('Node.handleInv(): Could not check inv against storage',
							  invs[this]);
			} else {
				if (!known) unknownInvs.push(invs[this]);
			}

			if (toCheck == 0 && unknownInvs.length) e.conn.sendGetData(unknownInvs);
		}).bind(i));
	}
};

Node.prototype.handleBlock = function (e) {
	winston.info('TODO handle block');
};

exports.Node = Node;
