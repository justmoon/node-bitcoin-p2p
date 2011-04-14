var assert = require('assert');
var sys = require('sys');

var TransactionStore = exports.TransactionStore = function (node) {
	events.EventEmitter.call(this);

	this.node = node;
	this.txIndex = {};
};

sys.inherits(TransactionStore, events.EventEmitter);

/**
 * Add transaction to memory pool.
 *
 * Note that transaction verification is asynchronous, so for proper error
 * handling you need to provide a callback.
 *
 * @return Boolean Whether the transaction was new.
 */
TransactionStore.prototype.add = function (tx, callback) {
	var txHash = tx.getHash().toString('base64');

	// Transaction is currently being verified, add callback to queue
	if (Array.isArray(this.txIndex[txHash])) {
		this.txIndex[txHash].push(callback);
		return false;
	}

	try {
		if (tx.isCoinBase())
			throw new Error("Coinbase transactions are only allowed as part of a block");

		if (!tx.isStandard())
			throw new Error("Non-standard transactions are currently not accepted");

		tx.verify((function (err) {
			var callbackQueue = this.txIndex[txHash];
			if (err) {
				delete this.txIndex[txHash];
				callbackQueue.forEach(function (cb) { cb(err); });
				return;
			}

			// TODO: Check conflicts with other in-memory transactions

			this.txIndex[txHash] = tx;
			callbackQueue.forEach(function (cb) { cb(); });
		}).bind(this));

		this.txIndex[txHash] = [callback];
	} catch (e) {
		callback(e);
		return true;
	}

	return true;
};

TransactionStore.prototype.get = function (hash) {
	if (hash instanceof Buffer) {
		hash = hash.toString('base64');
	}

	assert.equal(typeof hash, 'string');

	return this.txIndex[hash];
};
