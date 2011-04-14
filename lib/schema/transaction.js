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

mongoose.model('Transaction', Transaction);
