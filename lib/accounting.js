var sys = require('sys');
var logger = require('./logger');
var Util = require('./util');

var Accounting = exports.Accounting = function (storage, blockChain) {
	events.EventEmitter.call(this);

	this.storage = storage;

	var self = this;

	var Block = this.storage.Block;
	var Transaction = this.storage.Transaction;
	var Account = this.storage.Account;

	var addTxSynchro = Util.createSynchrotron(function (next, pubKey, tx, height, index) {
		Account.collection.update(
			// Find the account index for this public key
			{ pubKeyHash: pubKey.toString('base64') },
			// Atomically push this transaction
			{ $addToSet : { "txs" : {
				tx: tx.getHash().toString('base64'),
				height: height,
				n: index
			} } },
			// Insert if not exists
			{ upsert : true },
			// Callback
			function (err) {
				if (err) {
					logger.error("Error while registering tx for " +
								  "pub key " + Util.formatBuffer(outPubKey) +
								  ": " + err);
				}

				next();
			}
		);
	});

	this.handleTransaction = function (e) {
		var affectedAccounts = {};

		for (var i = 0; i < e.tx.outs.length; i++) {
			var txout = e.tx.outs[i];
			var script = txout.getScript();

			var outPubKey = script.simpleOutPubKeyHash();

			if (outPubKey) {
				affectedAccounts[outPubKey.toString('base64')] = outPubKey;
			}
		};

		if (!e.tx.isCoinBase()) {
			e.tx.ins.forEach(function (txin, j) {
				var script = txin.getScript();

				var inPubKey = Util.sha256ripe160(script.simpleInPubKey());

				if (inPubKey) {
					affectedAccounts[inPubKey.toString('base64')] = inPubKey;
				}
			});
		}

		for (var i in affectedAccounts) {
			addTxSynchro(i, affectedAccounts[i], e.tx, e.block.height, e.index);

			// Notify anybody listening to this pubkey
			this.emit('txAdd:'+i, e);
		}
	};

	blockChain.addListener('txAdd', this.handleTransaction.bind(this));
};

sys.inherits(Accounting, events.EventEmitter);
