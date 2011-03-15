var winston = require('winston'); // logging

var Peer = require('./peer').Peer;
var Connection = require('./connection').Connection;
var BlockChain = require('./blockchain').BlockChain;

var Node = function (storage) {
	this.peers = [];
	this.connections = [];
	this.storage = storage;
	this.nonce = new Buffer('a8deb8a83928aff8', 'hex');
	this.version = 32001;

	this.blockChain = new BlockChain(storage);
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
	this.startBlockChainDownload();
};

Node.prototype.startBlockChainDownload = function () {
	// TODO: Figure out a way to spread load across peers
	this.blockChain.getGenesisBlock((function (err, genesisBlock) {
		if (err) {
			winston.error(err);
			return;
		}

		this.blockChain.getTopBlock((function (err, topBlock) {
			if (err) {
				winston.error(err);
				return;
			}

			var starts = [];

			if (topBlock.hash.compare(genesisBlock.hash) !== 0) {
				console.log('using top block');
				starts.push(topBlock.hash);
			}

			starts.push(genesisBlock.hash);

			this.connections[0].sendGetBlocks(starts, genesisBlock.hash);
		}).bind(this));
	}).bind(this));
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
	var block = this.blockChain.makeBlockObject({
		"version": 1,
		"prev_hash": e.message['prev_hash'],
		"merkle_root": e.message['merkle_root'],
		"timestamp": e.message.timestamp,
		"bits": e.message.bits,
		"nonce": e.message.nonce
	});

	block.hash = block.calcHash();
	this.blockChain.add(block, function (err, block) {
		if (err) {
			winston.error("Error while adding block to chain: "+err);
			return;
		}
		winston.info('Block added successfully ' + block);
	});
};

exports.Node = Node;
