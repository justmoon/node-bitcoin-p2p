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

	var Block = this.storage.Block;

	function createGenesisBlock(callback) {
		winston.info("Loading genesis block");

		Block.create(genesis_block, callback);
	};

	this.getGenesisBlock = function getGenesisBlock(callback) {
		Block.findOne({hash: genesis_block.hash}, function (err, docs) {
			if (err) return callback(err);

			if (!docs) createGenesisBlock(callback);
			//else callback(err, docs); // no action necessary
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

	this.getHeader = function (block) {
		put = Binary.put();
		put.word32le(block.version);
		put.put(block.prev_hash);
		put.put(block.merkle_root);
		put.word32le(block.timestamp);
		put.word32le(block.bits);
		put.word32le(block.nonce);
		return put.buffer();
	};

	this.calcHash = function (block) {
		var header = this.getHeader(block);

		return Util.twoSha256(header);
	};

	this.add = function add(block, callback) {
		Block.create(block, function (err, block) {
			if (err) return callback(err);

			
		});
	};
};
