var winston = require('winston'); // logging
var mongoose = require('mongoose'); // database
require('./schema');

var genesis_block = {
	'height': 1.0,
	'nonce': '\x1d\xac+|',
	'version': 1,
	'hash': 'o\xe2\x8c\n\xb6\xf1\xb3r\xc1\xa6\xa2F\xaec\xf7O\x93\x1e\x83e\xe1Z\x08\x9ch\xd6\x19\x00\x00\x00\x00\x00',
	'txs': [{
		'outs': [{
			'script': "A\x04g\x8a\xfd\xb0\xfeUH'\x19g\xf1\xa6q0\xb7\x10\\\xd6\xa8(\xe09\t\xa6yb\xe0\xea\x1fa\xde\xb6I\xf6\xbc?L\xef8\xc4\xf3U\x04\xe5\x1e\xc1\x12\xde\\8M\xf7\xba\x0b\x8dW\x8aLp+k\xf1\x1d_\xac",
			'value': 5000000000
		}],
		'lock_time': 0,
		'version': 1,
		'hash': null,
		'ins': [{
			'sequence': 4294967295,
			'outpoint': {
				'index': 4294967295,
				'hash': '\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00'
			},
			'script': '\x04\xff\xff\x00\x1d\x01\x04EThe Times 03/Jan/2009 Chancellor on brink of second bailout for banks'}]}],
	'prev_hash': '\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00',
	'timestamp': 1231006505,
	'merkle_root': ';\xa3\xed\xfdz{\x12\xb2z\xc7,>gv\x8fa\x7f\xc8\x1b\xc3\x88\x8aQ2:\x9f\xb8\xaaK\x1e^J',
	'bits': 486604799
};

var Storage = exports.Storage = function (uri) {
	this.connection = mongoose.createConnection(uri);

	var Block = this.connection.model('Block');

	function ensureGenesisBlock(callback) {
		Block.find({hash: genesis_block.hash}, function (err, docs) {
			if (err) return callback(err);

			if (!docs.length) createGenesisBlock(callback);
			else callback(); // no action necessary
		});
	};

	function createGenesisBlock(callback) {
		winston.info("Loading genesis block");

		var g = new Block(genesis_block);
		g.save(callback);
	};

	function difficulty(bits) {

	};

	this.getEnds = function (callback) {
		ensureGenesisBlock(function (err) {
			if (err) return callback(err);

			callback(null, [genesis_block.hash], []); // success
		});
	};

	this.knowsBlock = function (hash, callback) {
		if (hash instanceof Buffer) {
			hash = hash.toString('binary');
		} else if (typeof hash !== "string") {
			callback('Invalid value for hash');
			return;
		}

		Block.find({'hash': hash.toString('binary')}).count(function (err, count) {
			callback(err, !!count);
		});
	};
};
