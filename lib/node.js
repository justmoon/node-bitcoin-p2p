var winston = require('winston'); // logging

var Peer = require('./peer').Peer;
var Connection = require('./connection').Connection;
var BlockChain = require('./blockchain').BlockChain;
var Util = require('./util');

var Node = function (storage) {
	this.peers = [];
	this.connections = [];
	this.storage = storage;
	this.nonce = new Buffer('a8deb8a83928aff8', 'hex');
	this.version = 32001;

	this.running = false;

	this.blockChain = new BlockChain(storage);
};

Node.prototype.start = function () {
	this.blockChain.init((function () {
		this.running = true;
		for (var i = 0; i < this.peers.length; i++) {
			var peer = this.peers[i];
			this.addConnection(new Connection(this, peer.createConnection(), peer));
		}
	}).bind(this));
};

Node.prototype.addPeer = function (peer) {
	if (peer instanceof Peer) {
		this.peers.push(peer);
		winston.info('Connecting to peer '+peer);

		// TODO: This should be moved to a scheduled task that checks whether we have
		// the desired number of connections.
		if (this.running) {
			this.addConnection(new Connection(this, peer.createConnection(), peer));
		}
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

Node.prototype.getBlockChain = function () {
	return this.blockChain;
};

Node.prototype.startBlockChainDownload = function (toHash) {
	var genesisBlock = this.blockChain.getGenesisBlock();
	var topBlock = this.blockChain.getTopBlock();

	if (!toHash) toHash = new Buffer(32).clear();

	// TODO: Figure out a way to spread load across peers

	var starts = [];

	if (topBlock.hash.compare(genesisBlock.hash) != 0) {
		starts.push(topBlock.hash);
	}

	starts.push(genesisBlock.hash);

	this.connections[0].sendGetBlocks(starts, toHash);
};

Node.prototype.handleInv = function (e) {
	var self = this;
	var invs = e.message.invs;
	var toCheck = invs.length;
	var unknownInvs = [];

	var topBlock = this.blockChain.getTopBlock();

	if (invs.length == 1 && invs[0].type == 2) {
		if (topBlock && topBlock.hash.compare(invs[0].hash) != 0) {
			self.startBlockChainDownload(invs[0].hash);
		}
	}

	// An inv with a single hash containing our most recent unconnected block is
	// a special inv, it's kind of like a tickle from the peer telling us that it's
	// time to download more blocks to catch up to the block chain. We could just
	// ignore this and treat it as a regular inv but then we'd download the head
    // block over and over again after each batch of 500 blocks, which is wasteful.
	/*if (invs.length == 1 && invs[0].type == 2 &&
		topBlock && topBlock.hash.compare(invs[0].hash) == 0) {
		this.startBlockChainDownload(invs[0].hash);
		return;
	}*/

	var lastBlock = null;
	for (var i = 0; i < invs.length; i++) {
		var method;
		switch (invs[i].type) {
		case 1: // Transaction
			method = 'knowsTransaction';
			break;
		case 2: // Block
			method = 'knowsBlock';
			lastBlock = i;
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
				else {
					winston.info('Known inv: '+Util.formatHash(invs[this].hash));
				}
			}

			// This is the last block we'll request. When it comes back, we want to check
			// again if there is more to download still.
			// TODO: Do we need this or should we just rely on the "tickle inv"?
			/*if (lastBlock != null && this.index == (this.len - 1)) {
				e.conn.once('block', function () {

				});
			}*/

			if (toCheck == 0 && unknownInvs.length) {
				e.conn.sendGetData(unknownInvs);
			}
		}).bind(i));
	}
};

Node.prototype.handleBlock = function (e) {
	var txs = e.message.txs;
	var block = this.blockChain.makeBlockObject({
		"version": 1,
		"prev_hash": e.message.prev_hash,
		"merkle_root": e.message.merkle_root,
		"timestamp": e.message.timestamp,
		"bits": e.message.bits,
		"nonce": e.message.nonce
	});

	block.hash = block.calcHash();
	this.blockChain.add(block, txs, function (err, block) {
		if (err) {
			winston.error("Error while adding block to chain: "+err);
			return;
		}
		winston.info('Block added successfully ' + block);
	});
};

exports.Node = Node;
