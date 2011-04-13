var assert = require('assert');

var TransactionStore = exports.TransactionStore = function (node) {
	this.node = node;
	this.txIndex = {};
};

TransactionStore.prototype.add = function (tx) {
	this.txIndex[tx.getHash().toString('base64')] = tx;
};

TransactionStore.prototype.get = function (hash) {
	if (hash instanceof Buffer) {
		hash = hash.toString('base64');
	}

	assert.equal(typeof hash, 'string');

	return this.txIndex[hash];
};
