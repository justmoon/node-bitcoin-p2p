var assert = require('assert');
var sys = require('sys');
var logger = require('./logger'); // logging
var Util = require('./util');

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
		if ("function" == typeof callback) {
			this.txIndex[txHash].push(callback);
		}
		return false;
	} else if (this.txIndex[txHash]) {
		if ("function" == typeof callback) {
			callback(null, tx);
		}
		return false;
	}

	// Write down when we first noticed this transaction
	tx.first_seen = new Date();

	// TODO: Support orphan memory transactions (if an input is missing, keep
	//       the transaction in a separate pool in case the input is fulfilled
	//       later on.

	try {
		if (tx.isCoinBase()) {
			throw new Error("Coinbase transactions are only allowed as part of a block");
		}
		if (!tx.isStandard()) {
			throw new Error("Non-standard transactions are currently not accepted");
		}
		tx.verify(this, (function (err) {
			var callbackQueue = this.txIndex[txHash];

			if (!Array.isArray(callbackQueue)) {
				// This should never happen and if it does indicates an error in
				// this library.
				logger.error("Transaction store verification callback misfired");
				return;
			}
			if (err) {
				delete this.txIndex[txHash];
				callbackQueue.forEach(function (cb) { cb(err, tx); });
				return;
			}

			// TODO: Check conflicts with other in-memory transactions

			this.txIndex[txHash] = tx;
			callbackQueue.forEach(function (cb) { cb(null, tx); });

			var eventData = {
				store: this,
				tx: tx
			};

			this.emit("txNotify", eventData);

			// Create separate events for each address affected by this tx
			if (this.node.cfg.feature.liveAccounting) {
				var affectedAccounts = tx.getAffectedAccounts();

				for (var i in affectedAccounts) {
					if(affectedAccounts.hasOwnProperty(i)) {
						this.emit('txNotify:'+i, eventData);
					}
				}
			}
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
		// But if there is a callback we'll return the transaction as soon as
		// it's ready.
		if ("function" == typeof callback) {
			this.txIndex[hash].push(callback);
		}
		return null;
	} else {
		if ("function" == typeof callback) {
			callback(null, this.txIndex[hash]);
		}
		return this.txIndex[hash];
	}
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


TransactionStore.prototype.find = function (hashes, callback) {
	var self = this;
	var callbacks = hashes.length;
	var disable = false;

	var result = [];
	hashes.forEach(function (hash) {
		self.get(hash, function (err, tx) {
			if (disable) {
				return;
			}

			if (err) {
				callback(err);
				disable = true;
			}

			callbacks--;

			if (tx) {
				result.push(tx);
			}

			if (callbacks === 0) {
				callback(null, result);
			}
		});
	});
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
