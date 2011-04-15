var mongoose = require('../../vendor/mongoose/lib/mongoose/index'); // database
var Script = require('../script').Script;
var Util = require('../util');
var bigint = require('bigint');
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
	script: Buffer // scriptPubKey
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

// This index allows us to quickly find out whether an out is spent
Transaction.index({ "ins.outpoint.hash": 1 });

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

	if (this.isCoinBase())
		callback(new Error("Coinbase transaction are invalid unless part of a block"));

	// Get list of transactions required for verification
	var txList = [];
	this.ins.forEach(function (txin) {
		if (txin.isCoinBase()) return;
		var hash = txin.outpoint.hash.toString('base64');
		if (txList.indexOf(hash) == -1) txList.push(hash);
	});

	this.db.model("Transaction").find({hash: {$in: txList}}, function (err, txs) {
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

			var valueIn = bigint(0);
			var valueOut = bigint(0);
			self.ins.forEach(function (txin, n) {
				var fromTx = txIndex[txin.outpoint.hash.toString('base64')];

				if (!fromTx)
					throw new Error("Source transaction for input "+n+" not found");

				if (!self.verifyInput(n, fromTx))
					throw new Error("Script did not evaluate to true");

				valueIn = valueIn.add(Util.valueToBigInt(fromTx.outs[txin.outpoint.index].value));
			});

			self.outs.forEach(function (txout) {
				valueOut = valueOut.add(Util.valueToBigInt(txout.value));
			});

			if (valueIn.cmp(valueOut) < 0)
				throw new Error("Transaction output value exceeds inputs");

			var fees = valueIn.sub(valueOut);

			callback(null, fees);
		} catch (e) {
			callback(e);
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
