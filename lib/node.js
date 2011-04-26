var sys = require('sys');
var logger = require('./logger'); // logging

var Peer = require('./peer').Peer;
var Settings = require('./settings').Settings;
var Storage = require('./storage').Storage;
var Connection = require('./connection').Connection;
var BlockChain = require('./blockchain').BlockChain;
var TransactionStore = require('./transactionstore').TransactionStore;
var Accounting = require('./accounting').Accounting;
var PeerManager = require('./peermanager').PeerManager;
var Util = require('./util');

var Node = function (cfg) {
	events.EventEmitter.call(this);

	if (!cfg) cfg = new Settings();

	this.cfg = cfg;
	this.peers = [];
	this.connections = [];
	this.nonce = Util.generateNonce();
	this.version = 32001;

	this.state = null;
	this.running = false;

	this.storage = new Storage(this.cfg.storage.uri);
	this.blockChain = new BlockChain(this.storage);
	this.txStore = new TransactionStore(this);
	this.accounting = new Accounting(this.storage, this.blockChain);
	this.peerManager = new PeerManager(this);

	this.addListener('stateChange', this.handleStateChange.bind(this));
	this.setupStateTransitions();
	this.setupCrossMessaging();
};

sys.inherits(Node, events.EventEmitter);

/**
 * Setup triggers for automatically switching states.
 *
 * The Node class automatically switches to different state if a certain
 * event happens while it is in a certain state.
 *
 * During startup this is what causes the Node to progress through its
 * various startup stages.
 */
Node.prototype.setupStateTransitions = function ()
{
	var self = this;

	// When the BlockChain object has finished initializing,
	// start connecting to peers
	this.blockChain.addListener('initComplete', function () {
		if (self.state == 'init') self.setState('netConnect');
	});

	// When the first peer is fully connected, start the block
	// chain download
	this.peerManager.addListener('netConnected', function () {
		if (self.state == 'netConnect') self.setState('blockDownload');
	});
};

/**
 * Setup cross component messaging.
 *
 * Some components of the node have to talk to one another. The node
 * sets up these channels using this function after all the components
 * have been instantiated.
 */
Node.prototype.setupCrossMessaging = function ()
{
	// When a transaction gets included into the block chain, conflicting
	// transactions must be removed from the memory pool.
	this.blockChain.addListener('txSpend', this.txStore.handleSpend.bind(this.txStore));
};

Node.prototype.start = function () {
	this.setState('init');
};

Node.prototype.setState = function (newState) {
	var oldState = this.state;

	// Don't allow switching to init state unless we are uninitialized
	if (newState == 'init' && oldState != null) return;

	this.state = newState;

	this.emit('stateChange', {oldState: oldState, newState: newState});
};

Node.prototype.handleStateChange = function (e) {
	// We consider the node to be "running" if it is in one of these states
	this.running = !!~['netConnect', 'blockDownload', 'default'].indexOf(e.newState);

	// Define what happens when we leave certain states
	switch (e.oldState) {}

	// Define what happens when we enter certain states
	switch (e.newState) {
	case 'init':
		this.blockChain.init();
		break;

	case 'netConnect':
		this.peerManager.enable();
		break;

	case 'blockDownload':
		this.startBlockChainDownload();
		break;
	}
};

Node.prototype.addPeer = function (peer) {
	this.peerManager.addPeer(peer);
};

Node.prototype.addConnection = function (conn) {
	conn.addListener('inv', this.handleInv.bind(this));
	conn.addListener('block', this.handleBlock.bind(this));
	conn.addListener('tx', this.handleTx.bind(this));
	conn.addListener('getdata', this.handleGetdata.bind(this));
};

Node.prototype.getPeerManager = function () {
	return this.peerManager;
};

Node.prototype.getStorage = function () {
	return this.storage;
};

Node.prototype.getBlockChain = function () {
	return this.blockChain;
};

Node.prototype.getAccounting = function () {
	return this.accounting;
};

Node.prototype.getTxStore = function () {
	return this.txStore;
};

Node.prototype.startBlockChainDownload = function (toHash, fromHash) {
	var genesisBlock = this.blockChain.getGenesisBlock();
	var topBlock = this.blockChain.getTopBlock();

	if (!toHash) toHash = new Buffer(32).clear();

	// TODO: Figure out a way to spread load across peers

	this.blockChain.getBlockLocator((function (err, locator) {
		if (err) {
			logger.error('Error while creating block locator: '+err);
			return;
		}

		locator.push(genesisBlock.hash);

		if (fromHash && fromHash.compare(locator[0]) != 0) {
			locator.unshift(fromHash);
		}

		var conn = this.peerManager.getActiveConnection();
		if (conn) {
			// Create some nicely formatted info about the chain height
			var heightInfo = '';
			if (topBlock.height < conn.bestHeight) {
				var curHeight = ""+topBlock.height;
				var maxHeight = ""+conn.bestHeight;
				while (curHeight.length < maxHeight.length) {
					curHeight = " "+curHeight;
				}
				heightInfo = ' '+curHeight+'/'+maxHeight;
			}

			var queueCount = this.blockChain.getQueueCount();

			logger.info('Downloading blocks'+heightInfo+
						' (top: '+Util.formatHash(locator[0])+
						', queued: '+queueCount+')');

			// We are very, very agressive in trying to download the block chain
			// as fast as possible. Usually our back-end won't be able to keep up,
			// so we need to slow down whenever too much is queueing up.
			if (queueCount > 800) {
				setTimeout(arguments.callee.bind(this, toHash, fromHash), 2000);
			} else {
				conn.sendGetBlocks(locator, toHash);
			}
		} else {
			this.setState('netConnect');
		}
	}).bind(this));
};

Node.prototype.handleInv = function (e) {
	var self = this;
	var invs = e.message.invs;
	var toCheck = invs.length;
	var unknownInvs = [];

	var lastBlock = null;
	for (var i = 0; i < invs.length; i++) {
		var method;
		switch (invs[i].type) {
		case 1: // Transaction
			toCheck--;

			// Check whether we know this transaction
			if (!this.txStore.isKnown(invs[i].hash)) {
				unknownInvs.push(invs[i]);
			}

			break;
		case 2: // Block
			lastBlock = i;

			// This will asynchronously check all the blocks and transactions. Finally,
			// the last callback will trigger the 'getdata' request.
			this.storage.knowsBlock(invs[i].hash, (function (err, known) {
				toCheck--;

				// Check if this is one of those "trigger" invs prompting us to
				// continue downloading blocks.
				var lastBlock = self.blockChain.getLastRecvBlock();
				if (invs.length == 1 && invs[0].type == 2) {
					if (lastBlock && !known) {
						self.startBlockChainDownload(invs[0].hash, lastBlock.getHash());
					}
				}

				if (err) {
					logger.error('Node.handleInv(): Could not check inv against storage',
								 invs[this]);
				} else {
					if (!known) unknownInvs.push(invs[this]);
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
			break;
		default: // Unknown type
			continue;
		}
	}

	if (toCheck == 0 && unknownInvs.length) {
		e.conn.sendGetData(unknownInvs);
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
	block.size = e.message.size;
	this.blockChain.add(block, txs, function (err, block) {
		if (err) {
			logger.error("Error while adding block to chain: "+err);
			return;
		}
		logger.bchdbg('Block added successfully ' + block);
	});
};

Node.prototype.handleTx = function (e) {
	var message = e.message;
	delete message.command;
	var tx = new this.storage.Transaction(message);

	if (this.txStore.isKnown(tx.getHash())) return;

	this.txStore.add(tx, function (err) {
		if (err) {
			logger.warn("Rejected tx " +
						Util.formatHash(tx.getHash()) + " " +
						err.message);
		} else {
			logger.info("Added tx " + Util.formatHash(tx.getHash()));
		}
	});
};

Node.prototype.handleGetdata = function (e) {
	var self = this;
	e.message.invs.forEach(function (inv) {
		switch (inv.type) {
		case 1: // MSG_TX
			var tx;
			if (tx = self.txStore.get(inv.hash)) {
				e.conn.sendTx(tx);
			}
			break;
		case 2: // MSG_BLOCK
			break;
		}
	});

	if (e.message.invs.length == 1) {
		logger.info("Received getdata for " +
					((e.message.invs[0].type == 1) ? "transaction" : "block") +
					" " + Util.formatHash(e.message.invs[0].hash));
	} else {
		logger.info("Received getdata for " + e.message.invs.length + " objects");
	}
};

/**
 * Broadcast a new transaction to the network.
 */
Node.prototype.sendTx = function (tx, callback) {
	this.txStore.add(tx, (function (err) {
		if (!err) {
			var conns = this.peerManager.getActiveConnections();
			conns.forEach(function (conn) {
				conn.sendInv(tx);
			});
		}
		callback(err);
	}).bind(this));
};


exports.Node = Node;
