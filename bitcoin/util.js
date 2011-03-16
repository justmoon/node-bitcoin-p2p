
var crypto = require('crypto');

var sha256 = exports.sha256 = function (data) {
	return new Buffer(crypto.createHash('sha256').update(data).digest('binary'), 'binary');
};

var twoSha256 = exports.twoSha256 = function (data) {
	return sha256(sha256(data));
};

var formatHash = exports.formatHash = function (hash) {
	// We make a copy of the data we want to display, because a lot of Buffer
	// methods are destructive.
	var hashEnd = new Buffer(10);
	hash.copy(hashEnd, 0, 22, 32);
	return hashEnd.reverse().toHex();
};
