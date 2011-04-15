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

	// Write down when we first noticed this transaction
	tx.first_seen = new Date();

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

			this.emit("txNotify", {
				store: this,
				tx: tx
			});
		}).bind(this));

		this.txIndex[txHash] = [callback];
	} catch (e) {
		callback(e);
		return true;
	}

	return true;
};

TransactionStore.prototype.get = function (hash, callback) {
	if (hash instanceof Buffer) {
		hash = hash.toString('base64');
	}

	assert.equal(typeof hash, 'string');

	// If the transaction is currently being verified, we'll return null.
	if (Array.isArray(this.txIndex[hash])) {
		return null;
	}

	return this.txIndex[hash];
};

TransactionStore.prototype.isKnown = function (hash) {
	if (hash instanceof Buffer) {
		hash = hash.toString('base64');
	}

	assert.equal(typeof hash, 'string');

	// Note that a transaction will return true here even is it is still
	// being verified.
	return !!this.txIndex[hash];
};

/**
 * Handles a spend entering the block chain.
 *
 * If a transaction spend enters the block chain, we have to remove any
 * conflicting transactions from the memory pool.
 */
TransactionStore.prototype.handleSpend = function (e) {
	// TODO: Implement

	// 1. Find transaction depending on this output
	// If there is none, we're done, otherwise:
	// 2. Remove it from the pool
	// 3. Issue txCancel messages
};
