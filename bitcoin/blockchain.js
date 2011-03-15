var winston = require('winston'); // logging
var Binary = require('binary');
var Util = require('./util');

var genesis_block = {
	'height': 1.0,
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
		'value': 5000000000,
		'script': Binary.put()
			.word8(65) // ???
			.put(new Buffer('04678AFDB0FE5548271967F1A67130B7105CD6A828E03909A67962E0EA1F61DEB649F6BC3F4CEF38C4F35504E51EC112DE5C384DF7BA0B8D578A4C702B6BF11D5F', 'hex'))
			.word8(0xAC)
			.buffer() // OP_CHECKSIG
	}],
	'lock_time': 0,
	'version': 1,
	'hash': null,
	'ins': [{
		'sequence': 4294967295,
		'outpoint': {
			'index': 4294967295,
			'hash': new Buffer(32).clear()
		},
		'script': Binary.put()
			.put(new Buffer('04FFFF001D010445', 'hex'))
			.put(new Buffer('The Times 03/Jan/2009 Chancellor on brink of second bailout for banks', 'ascii'))
			.buffer()
	}]
};

var BlockChain = exports.BlockChain = function (storage) {
	this.storage = storage;

	var self = this;

	var Block = this.storage.Block;
	var Transaction = this.storage.Transaction;

	var orphanBlockFutures = {};

	function createGenesisBlock(callback) {
		winston.info("Loading genesis block");

		var genesisBlock = new Block(genesis_block);

		// A sensible sanity check to make sure our constants are not
		// corrupted and our block hashing algorithm is working.
		if (!genesisBlock.checkHash()) {
			throw "Genesis block constants validation failed. There is something wrong with our constants or hash validation code.";
		}

		genesisBlock.save(function (err) {
			self.executeOrphanBlockFutures(genesisBlock);
			callback(err, genesisBlock);
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

	this.getGenesisBlock = function getGenesisBlock(callback) {
		this.getBlockByHash(genesis_block.hash, function (err, block) {
			if (err) {
				callback(err);
				return;
			}

			if (!block) createGenesisBlock(callback);
			else callback(err, block); // no action necessary
		});
	};

	this.getTopBlock = function getTopBlock(callback) {
		Block
			.find()
			.sort('height', -1)
			.limit(1)
			.exec(function (err, result) {
				if (err) return callback(err);

				callback(null, result[0]);
		});
	};

	this.add = function add(block, callback) {
		var self = this;

		if (!block instanceof Block) {
			block = this.makeBlockObject(block);
		}

		function connectBlockToParentAndSave(parent) {
			// Our parent block is there, let's attach ourselves
			block.height = parent.height + 1;

			block.save(function (err) {
				if (err) return callback(err);

				// Since we were able to connect into the chain, we should go
				// and find out if there are any lost children waiting for us.
				self.executeOrphanBlockFutures(block);

				callback(err, block);
			});
		};

		this.getBlockByHash(block.prev_hash, function (err, prevBlock) {
			// Let's see if we are able to connect into the chain
			if (!err && prevBlock && prevBlock.height >= 1) {
				// Our parent is in the chain, connect up and save
				connectBlockToParentAndSave(prevBlock);
			} else {
				// Our parent is not in the chain, create a future to be
				// executed when it is.
				var future = connectBlockToParentAndSave;
				if (orphanBlockFutures[block.prev_hash]) {
					orphanBlockFutures[block.prev_hash].push(future);
				} else {
					orphanBlockFutures[block.prev_hash] = [future];
				}
			}
		});
	};

	this.makeBlockObject = function (blockData) {
		return new Block(blockData);
	};

	this.executeOrphanBlockFutures = function (block) {
		var futures = orphanBlockFutures[block.hash];
		if (futures) {
			for (var i = 0; i < futures.length; i++) {
				futures[i](block);
			}
		}
	};
};
