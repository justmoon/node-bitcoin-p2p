var sys = require('sys');
var winston = require('winston'); // logging
var Util = require('./util');

var Accounting = exports.Accounting = function (storage, blockChain) {
	events.EventEmitter.call(this);

	this.storage = storage;

	var self = this;

	var Block = this.storage.Block;
	var Transaction = this.storage.Transaction;
	var Account = this.storage.Account;

	var addTxSynchro = Util.createSynchrotron(function (next, pubKey, tx, index) {
		Account.findOne({ pubKeyHash: pubKey }, function (err, row) {
			if (err) {
				winston.warn("Error while getting accounting information");
				next();
				return;
			}
			if (!row) row = new Account({ pubKeyHash: pubKey });

			var prevTxHash = row.txs && row.txs.length ?
				row.txs[row.txs.length-1].chainHash :
				Util.NULL_HASH;

			row.txs.push({
				tx: tx.getHash().toString('base64'),
				n: index,
				chainHash: Util.sha256(prevTxHash.concat(tx.getHash())).toString('base64')
			});

			row.save(function (err) {
				if (err) {
					winston.error("Error while registering tx for " +
								  "pub key " + Util.formatBuffer(pubKey) +
								  ": " + err);
				}

				next();
			});
		});
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

		if (e.tx.isCoinBase()) return;

		e.tx.ins.forEach(function (txin, j) {
			var script = txin.getScript();

			var inPubKey = Util.sha256ripe160(script.simpleInPubKey());

			if (inPubKey) {
				affectedAccounts[inPubKey.toString('base64')] = inPubKey;
			}
		});

		for (var i in affectedAccounts) {
			addTxSynchro(i, affectedAccounts[i], e.tx, e.index);
		}
	};

	blockChain.addListener('txAdd', this.handleTransaction.bind(this));
};

sys.inherits(Accounting, events.EventEmitter);
