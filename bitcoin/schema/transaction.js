var mongoose = require('../../vendor/mongoose/lib/mongoose/index'); // database

var Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId;

var TransactionIn = new Schema({
	script: Buffer,
	sequence: Number,
	outpoint: {
		hash: Buffer,
		index: Number
	}
});

var TransactionOut = new Schema({
	value: Number,
	script: Buffer
});

var Transaction = new Schema({
	hash: { type: Buffer, unique: true },
	block: ObjectId,
	sequence: Number,
	version: String,
	lock_time: String,
	ins: [TransactionIn],
	outs: [TransactionOut]
});

mongoose.model('Transaction', Transaction);
