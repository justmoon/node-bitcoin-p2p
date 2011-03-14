var winston = require('winston'); // logging
var Binary = require('binary');
var Util = require('./util');

var genesis_block = {
	'height': 1.0,
	'nonce': 2083236893,
	'version': 1,
	'hash': new Buffer('o\xe2\x8c\n\xb6\xf1\xb3r\xc1\xa6\xa2F\xaec\xf7O\x93\x1e\x83e\xe1Z\x08\x9ch\xd6\x19\x00\x00\x00\x00\x00', 'binary'),
	'prev_hash': new Buffer('\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00', 'binary'),
	'timestamp': 1231006505,
	'merkle_root': new Buffer(';\xa3\xed\xfdz{\x12\xb2z\xc7,>gv\x8fa\x7f\xc8\x1b\xc3\x88\x8aQ2:\x9f\xb8\xaaK\x1e^J', 'binary'),
	'bits': 486604799
};

var genesis_block_tx = {
	'outs': [{
		'script': new Buffer("A\x04g\x8a\xfd\xb0\xfeUH'\x19g\xf1\xa6q0\xb7\x10\\\xd6\xa8(\xe09\t\xa6yb\xe0\xea\x1fa\xde\xb6I\xf6\xbc?L\xef8\xc4\xf3U\x04\xe5\x1e\xc1\x12\xde\\8M\xf7\xba\x0b\x8dW\x8aLp+k\xf1\x1d_\xac", 'binary'),
		'value': 5000000000
	}],
	'lock_time': 0,
	'version': 1,
	'hash': null,
	'ins': [{
		'sequence': 4294967295,
		'outpoint': {
			'index': 4294967295,
			'hash': new Buffer('\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00', 'binary')
		},
		'script': new Buffer('\x04\xff\xff\x00\x1d\x01\x04EThe Times 03/Jan/2009 Chancellor on brink of second bailout for banks', 'binary')
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
