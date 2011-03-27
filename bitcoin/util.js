var crypto = require('crypto');
var bigint = require('bigint');

var NULL_HASH = exports.NULL_HASH = new Buffer(32).clear();

// How much of Bitcoin's internal integer coin representation makes 1 BTC
var COIN = 100000000;

var sha256 = exports.sha256 = function (data) {
	return new Buffer(crypto.createHash('sha256').update(data).digest('binary'), 'binary');
};

var ripe160 = exports.ripe160 = function (data) {
	return new Buffer(crypto.createHash('rmd160').update(data).digest('binary'), 'binary');
};

var twoSha256 = exports.twoSha256 = function (data) {
	return sha256(sha256(data));
};

var sha256ripe160 = exports.sha256ripe160 = function (data) {
	return ripe160(sha256(data));
};

var formatHash = exports.formatHash = function (hash) {
	// We make a copy of the data we want to display, because a lot of Buffer
	// methods are destructive.
	var hashEnd = new Buffer(10);
	hash.copy(hashEnd, 0, 22, 32);
	return hashEnd.reverse().toHex();
};

var formatBuffer = exports.formatBuffer = function (buffer, maxLen) {
	// Calculate amount of bytes to display
	maxLen = maxLen || 10;
	if (maxLen > buffer.length) maxLen = buffer.length;

	// Copy those bytes into a temporary buffer
	var temp = new Buffer(maxLen);
	buffer.copy(temp, 0, 0, maxLen);

	// Format as string
	var output = temp.toHex();
	if (temp.length < buffer.length) output += "...";
	return output;
};

var formatValue = exports.formatValue = function (valueBuffer) {
	var value = bigint.fromBuffer(valueBuffer, {endian: 'little', size: 8}).toString();
	var integerPart = value.length > 8 ? value.substr(0, value.length-8) : '0';
	var decimalPart = value.length > 8 ? value.substr(value.length-8) : value;
	while (decimalPart.length < 8) decimalPart = "0"+decimalPart;
	decimalPart = decimalPart.replace(/0*$/, '');
	while (decimalPart.length < 2) decimalPart += "0";
	return integerPart+"."+decimalPart;
};
