var mongoose = require('../../vendor/mongoose/lib/mongoose/index'); // database
var Util = require('../util');
var Binary = require('binary');

var Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId;

var Block = new Schema({
	hash: { type: Buffer, unique: true },
	prev_hash: { type: Buffer, index: true },
	merkle_root: Buffer,
	timestamp: Number,
	bits: Number,
	nonce: Number,
	version: String,
	height: { type: Number, index: true, default: 0 }
});

Block.method('getHeader', function () {
	put = Binary.put();
	put.word32le(this.version);
	put.put(this.prev_hash);
	put.put(this.merkle_root);
	put.word32le(this.timestamp);
	put.word32le(this.bits);
	put.word32le(this.nonce);
	return put.buffer();
});

Block.method('calcHash', function () {
	var header = this.getHeader();

	return Util.twoSha256(header);
});

Block.method('checkHash', function () {
	if (!this.hash) return false;

	return this.calcHash().compare(this.hash) == 0;
});

Block.method('toString', function () {
	return "<Block " + Util.formatHash(this.hash) + " height="+this.height+">";
});

mongoose.model('Block', Block);
