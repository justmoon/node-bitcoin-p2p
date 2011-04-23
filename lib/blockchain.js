var sys = require('sys');
var logger = require('./logger');
var Binary = require('binary');
var Util = require('./util');
var BlockLocator = require('./blocklocator').BlockLocator;

var genesis_block = {
	'height': 0,
	'nonce': 2083236893,
	'version': 1,
	'hash': new Buffer('6FE28C0AB6F1B372C1A6A246AE63F74F931E8365E15A089C68D6190000000000', 'hex'),
	'prev_hash': new Buffer(32).clear(),
	'timestamp': 1231006505,
	'merkle_root': new Buffer('3BA3EDFD7A7B12B27AC72C3E67768F617FC81BC3888A51323A9FB8AA4B1E5E4A', 'hex'),
	'bits': 486604799
};

var genesis_block_tx = {
	'outs': [{
		'value': new Buffer('00F2052A01000000', 'hex'), // 50 BTC
		'script': Binary.put()
			.word8(65) // ???
			.put(new Buffer('04678AFDB0FE5548271967F1A67130B7105CD6A828E03909A67962E0EA1F61DEB649F6BC3F4CEF38C4F35504E51EC112DE5C384DF7BA0B8D578A4C702B6BF11D5F', 'hex'))
			.word8(0xAC)
			.buffer() // OP_CHECKSIG
	}],
	'lock_time': 0,
	'version': 1,
	'hash': new Buffer('3BA3EDFD7A7B12B27AC72C3E67768F617FC81BC3888A51323A9FB8AA4B1E5E4A', 'hex'),
	'ins': [{
		'sequence': 0xFFFFFFFF,
		'outpoint': {
			'index': 0xFFFFFFFF,
			'hash': new Buffer(32).clear()
		},
		'script': Binary.put()
			.put(new Buffer('04FFFF001D010445', 'hex'))
			.put(new Buffer('The Times 03/Jan/2009 Chancellor on brink of second bailout for banks', 'ascii'))
			.buffer()
	}]
};

var BlockChain = exports.BlockChain = function (storage) {
	events.EventEmitter.call(this);

	this.storage = storage;

	var self = this;

	var Block = this.storage.Block;
	var Transaction = this.storage.Transaction;
	var Account = this.storage.Account;

	var genesisBlock = null;
	var currentTopBlock = null;
	var lastRecvBlock = null;
	var orphanBlockFutures = {};
	var queueCount = 0;

	function createGenesisBlock(callback) {
		logger.info("Loading genesis block");

		try {
			genesisBlock = currentTopBlock = new Block(genesis_block);
			genesisBlock.active = true;
			genesisBlock.setChainWork(genesisBlock.getWork());

			// A simple sanity check to make sure our constants are not
			// corrupted and our block hashing algorithm is working.
			if (!genesisBlock.checkHash()) {
				logger.error("Genesis block hash validation failed. There is something wrong with our constants or block hash validation code.");
				return;
			}

			var genesisTransaction = new Transaction(genesis_block_tx);

			self.emit('blockAdd', {block: genesisBlock, txs: [genesisTransaction]});
		} catch (e) {
			logger.error("Error while adding genesis block: "+(e.stack ? e.stack : e));
			return;
		}

		genesisBlock.save(function (err) {
			// It's faster to just ignore the duplicate key error than to
			// check beforehand
			if (err && err.message.indexOf("E11000") == -1) {
				logger.error(err);
				callback(err);
				return;
			}

			if (!genesisTransaction.checkHash()) {
				logger.error("Genesis tx hash validation failed. There is something wrong with our constants or tx hash validation code.");
				return;
			}

			genesisTransaction.block = genesisBlock.getHash();

			self.emit('txAdd', {block: genesisBlock, index: 0, tx: genesisTransaction, chain: self});

			genesisTransaction.save(function (err) {
				// It's faster to just ignore the duplicate key error than to
				// check beforehand
				if (err && err.message.indexOf("E11000") == -1) {
					logger.error(err);
					callback(err);
					return;
				}

				self.emit('txAdd', {block: genesisBlock, index: 0, tx: genesisTransaction, chain: self});
			});

			self.emit('blockSave', {block: genesisBlock, txs: [genesisTransaction]});
			callback();
		});
	};

	function loadTopBlock(callback) {
		Block.find().sort('height', -1).limit(1).exec(function (err, block) {
			if (err) {
				logger.error("Error while initializing block chain", err);
				return;
			}
			currentTopBlock = block[0];
			callback();
		});
	};

	this.getBlockByHash = function getBlockByHash(hash, callback) {
		Block.findOne({hash: hash}, function (err, block) {
			if (err) {
				callback(err);
				return;
			}

			callback(err, block);
		});
	};

	this.getBlockByPrev = function getBlockByPrev(block, callback) {
		if ("object" == typeof block && block.hash) {
			block = block.hash;
		}

		Block.findOne({prev_hash: block}, function (err, block) {
			if (err) {
				callback(err);
				return;
			}

			callback(err, block);
		});
	};

	this.getGenesisBlock = function getGenesisBlock() {
		return genesisBlock;
	};

	this.getTopBlock = function getTopBlock() {
		return currentTopBlock;
	};

	this.getBlockLocator = function getBlockLocator(callback) {
		BlockLocator.createFromBlockChain(this, callback);
	};

	/**
	 * Get the last block we received.
	 *
	 * Very untrusted! This is only meant for continuously requesting
	 * blocks during a block chain download. Otherwise always use
	 * getTopBlock().
	 */
	this.getLastRecvBlock = function getLastRecvBlock () {
		return lastRecvBlock;
	};

	this.getQueueCount = function () {
		return queueCount;
	};

	this.add = function add(block, txs, callback) {
		var self = this;

		if (!block instanceof Block) {
			block = this.makeBlockObject(block);
		}

		function connectBlockToParentAndSave(parent) {
			// Our parent block is there, let's attach ourselves
			block.height = parent.height + 1;
			block.setChainWork(parent.getChainWork().add(block.getWork()));

			// Update top block field if this block is a child of it
			if (currentTopBlock.hash.compare(parent.hash) == 0) {
				currentTopBlock = block;
				block.active = true;
			} else {
				// Block belongs to a side chain, switch chains if side
				// chain has more work.
				block.active = false;
				if (block.moreWorkThan(currentTopBlock)) {
					logger.info('New block '+Util.formatHash(block.hash)+
								' belongs to better chain, reorganizing');
					// TODO: Implement reorganization
					//self.reorganize(currentTopBlock, block);
					currentTopBlock = block;
				} else {
					logger.info('Adding block '+Util.formatHash(block.hash)+
								' on side chain');
				}
			}

			self.emit('blockAdd', {block: block, txs: txs, chain: self});

			block.save(function (err) {
				queueCount--;

				if (err) {
					// TODO: Handle if block is a duplicate
					return callback(err);
				}

				// Asynchronously store all of this block's transactions to the database
				self.addTransactions(block, txs);

				// This event will also trigger us saving all child blocks that
				// are currently waiting.
				self.emit('blockSave', {block: block, txs: txs, chain: self});

				callback(err, block);
			});
		};

		// Static checks
		try {
			block.checkBlock();
		} catch (e) {
			callback('Check failed: '+e, null);
		}

		lastRecvBlock = block;

		queueCount++;

		this.getBlockByHash(block.prev_hash, function (err, prevBlock) {
			// Let's see if we are able to connect into the chain
			if (!err && prevBlock && prevBlock.height >= 0) {
				// Our parent is in the chain, connect up and save
				connectBlockToParentAndSave(prevBlock);
			} else {
				// Our parent is not in the chain, create a future to be
				// executed when it is.
				var future = connectBlockToParentAndSave;
				if (!orphanBlockFutures[block.prev_hash]) {
					orphanBlockFutures[block.prev_hash] = {}
				}
				orphanBlockFutures[block.prev_hash][block.hash] = future;
			}
		});
	};

	this.addTransactions = function addTransactions(block, txs) {
		txs.forEach(function (tx, i) {
			var tx = new Transaction(txs[i]);

			tx.block = block.getHash();
			tx.active = block.active;

			// Calculate hash
			tx.getHash();

			self.emit('txAdd', {block: block, index: i, tx: tx, chain: self});

			tx.save(function (err) {
				if (err) {
					logger.warn(err);
					return;
				}

				self.emit('txSave', {block: block, index: i, tx: tx, chain: self});

				// Notify other components about spent inputs
				if (!tx.isCoinBase()) {
					tx.ins.forEach(self.broadcastSpend);
				}
			});
		});
	};

	this.broadcastSpend = function (txin) {
		self.emit('txSpend', {
			hash: txin.outpoint.hash,
			index: txin.outpoint.index
		});
	};

	this.makeBlockObject = function (blockData) {
		return new Block(blockData);
	};

	this.executeOrphanBlockFutures = function (block) {
		var futures = orphanBlockFutures[block.hash];
		if (futures) {
			for (var i in futures) {
				futures[i](block);
			}
			delete orphanBlockFutures[block.hash];
		}
	};

	this.init = function () {
		createGenesisBlock(function () {
			loadTopBlock(function () {
				self.emit('initComplete');
			});
		});
	}

	// We can execute block futures as early as the blockAdd, but we have to
	// make sure we catch futures that are added later as well, by listening to
	// blockSave.
	function handleBlockEvent(e) {
		self.executeOrphanBlockFutures(e.block);
	}
	this.on('blockAdd', handleBlockEvent);
	this.on('blockSave', handleBlockEvent);
};

sys.inherits(BlockChain, events.EventEmitter);
