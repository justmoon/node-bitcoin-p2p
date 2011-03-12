var mongoose = require('mongoose'); // database

var Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId;

var TransactionIn = new Schema({
	script: String,
	sequence: Number,
	outpoint: {
		hash: String,
		index: Number
	}
});

var TransactionOut = new Schema({
	value: Number,
	script: String
});

var Transaction = new Schema({
	hash: { type: String, unique: true },
	block: ObjectId,
	sequence: Number,
	version: String,
	lock_time: String,
	ins: [TransactionIn],
	outs: [TransactionOut]
});

var Block = new Schema({
	hash: { type: String, unique: true },
	prev_hash: { type: String, index: true },
	merkle_root: String,
	timestamp: Number,
	bits: Number,
	nonce: String,
	version: String,
	height: { type: Number, index: true },
	txs: [Transaction]
});

mongoose.model('Block', Block);
