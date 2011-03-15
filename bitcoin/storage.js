var winston = require('winston'); // logging
var mongoose = require('../vendor/mongoose/lib/mongoose/index'); // database
require('./schema/index');

var Storage = exports.Storage = function (uri) {
	this.connection = mongoose.createConnection(uri);

	var Block = this.Block = this.connection.model('Block');
	var Transaction = this.Transaction = this.connection.model('Transaction');

	function difficulty(bits) {

	};

	this.knowsBlock = function (hash, callback) {
		if (hash instanceof Buffer) {
			hash = hash.toString('binary');
		} else if (typeof hash !== "string") {
			callback('Invalid value for hash');
			return;
		}

		Block.find({'hash': hash}).count(function (err, count) {
			callback(err, !!count);
		});
	};

	this.knowsTransaction = function (hash, callback) {
		// TODO: Implement
		callback(null, true);
	};
};
