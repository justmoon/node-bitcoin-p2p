
var crypto = require('crypto');

var sha256 = exports.sha256 = function (data) {
	return new Buffer(crypto.createHash('sha256').update(data).digest('binary'), 'binary');
};

var twoSha256 = exports.twoSha256 = function (data) {
	return sha256(sha256(data));
};
