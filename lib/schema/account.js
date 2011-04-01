var mongoose = require('../../vendor/mongoose/lib/mongoose/index'); // database

var Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId;

var Account = new Schema({
	pubKeyHash: { type: Buffer, unique: true },
	balance: Number,
	txs: Array
}, {
  use$SetOnSave: false
});

mongoose.model('Account', Account);
