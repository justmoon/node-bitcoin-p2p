var mongoose = require('../../vendor/mongoose/lib/mongoose/index'); // database
var Script = require('../script').Script;
var Util = require('../util');
var Binary = require('../binary');

var Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId;

var TransactionIn = new Schema({
	script: Buffer, // scriptSig
	sequence: Number,
	outpoint: {
		hash: Buffer,
		index: Number
	}
});

TransactionIn.method('getScript', function () {
	return new Script(this.script);
});

TransactionIn.method('isCoinBase', function () {
	return this.outpoint.hash.compare(Util.NULL_HASH) == 0;
});

TransactionIn.method('serialize', function () {
	var bytes = Binary.put();

	bytes.put(this.outpoint.hash);
	bytes.word32le(this.outpoint.index);
	bytes.var_uint(this.script.length);
	bytes.put(this.script);
	bytes.word32le(this.sequence);

	return bytes.buffer();
});

var TransactionOut = new Schema({
	value: Buffer,
	script: Buffer, // scriptPubKey
	spent: {type: Boolean, default: false}
});

TransactionOut.method('getScript', function () {
	return new Script(this.script);
});

TransactionOut.method('serialize', function () {
	var bytes = Binary.put();

	bytes.put(this.value);
	bytes.var_uint(this.script.length);
	bytes.put(this.script);

	return bytes.buffer();
});

var Transaction = new Schema({
	hash: { type: Buffer, unique: true },
	block: Buffer,
	sequence: Number,
	version: String,
	lock_time: String,
	ins: [TransactionIn],
	outs: [TransactionOut]
});

Transaction.method('isCoinBase', function () {
	return this.ins.length == 1 && this.ins[0].isCoinBase();
});

Transaction.method('isStandard', function () {
	var i;
	for (i = 0; i < this.ins.length; i++) {
		if (this.ins[i].getScript().getInType() == "Strange") {
			return false;
		}
	}
	for (i = 0; i < this.outs.length; i++) {
		if (this.outs[i].getScript().getOutType() == "Strange") {
			return false;
		}
	}
	return true;
});

Transaction.method('serialize', function () {
	var bytes = Binary.put();

	bytes.word32le(this.version);
	bytes.var_uint(this.ins.length);
	this.ins.forEach(function (txin) {
		bytes.put(txin.serialize());
	});

	bytes.var_uint(this.outs.length);
	this.outs.forEach(function (txout) {
		bytes.put(txout.serialize());
	});

	bytes.word32le(this.lock_time);

	return bytes.buffer();
});

Transaction.method('calcHash', function () {
	return Util.twoSha256(this.serialize());
});

Transaction.method('checkHash', function () {
	if (!this.hash) return false;

	return this.calcHash().compare(this.hash) == 0;
});

Transaction.method('getHash', function () {
	if (!this.hash) {
		this.hash = this.calcHash();
	}
	return this.hash;
});

Transaction.method('verify', function (callback) {
	var self = this;

	if (this.isCoinBase()) return true;

	// Get list of transactions required for verification
	var txList = [];
	this.ins.forEach(function (txin) {
		if (txin.isCoinBase()) return;
		var hash = txin.outpoint.hash.toString('base64');
		if (txList.indexOf(hash) == -1) txList.push(hash);
	});

	this.model.find({hash: {$in: txList}}, function (err, txs) {
		if (err) {
			callback(err);
			return;
		}

		try {
			// Index transactions
			var txIndex = {};
			txs.forEach(function (tx) {
				txIndex[tx.hash.toString('base64')] = tx;
			});

			this.ins.forEach(function (txin, n) {
				var fromTx = txIndex[txin.outpoint.hash.toString('base64')];

				if (!fromTx)
					throw new Error("Source transaction for input "+n+" not found");

				self.verifyInput(n, fromTx);
			});
		} catch (e) {
			callback(err);
		}
	});
});

Transaction.method('verifyInput', function (n, fromTx) {
	var txin = this.ins[n];

	if (txin.outpoint.index >= fromTx.outs.length)
		throw new Error("Source output index "+txin.outpoint.index+
						" for input "+n+" out of bounds");

	var txout = fromTx.outs[txin.outpoint.index];

	return Script.verify(txin.getScript(), txout.getScript(), this, n, 1);
});

mongoose.model('Transaction', Transaction);
