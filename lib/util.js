require('buffertools');
var crypto = require('crypto');
var bigint = require('bigint');
var Binary = require('./binary');
var logger = require('./logger');

// Native extensions
var ccmodule = require('../build-cc/default/native');

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

var encodeBase58 = exports.encodeBase58 = ccmodule.base58_encode;

var decodeBase58 = exports.decodeBase58 = ccmodule.base58_decode;

/**
 * Format a block hash like the official client does.
 */
var formatHash = exports.formatHash = function (hash) {
	// Make a copy, because reverse() and toHex() are destructive.
	var hashEnd = new Buffer(10);
	hash.copy(hashEnd, 0, 22, 32);
	return hashEnd.reverse().toHex();
};

/**
 * Display the whole hash, as hex, in correct endian order.
 */
var formatHashFull = exports.formatHashFull = function (hash) {
	// Make a copy, because reverse() and toHex() are destructive.
	var copy = new Buffer(hash.length);
	hash.copy(copy);
	var hex = copy.reverse().toHex();
	return hex;
};

/**
 * Format a block hash like Block Explorer does.
 *
 * Formats a block hash by removing leading zeros and truncating to 10 characters.
 */
var formatHashAlt = exports.formatHashAlt = function (hash) {
	var hex = formatHashFull(hash);
	hex = hex.replace(/^0*/, '');
	return hex.substr(0, 10);
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

var valueToBigInt = exports.valueToBigInt = function (valueBuffer) {
	if (valueBuffer instanceof bigint) return valueBuffer;
	return bigint.fromBuffer(valueBuffer, {endian: 'little', size: 8});
};

var formatValue = exports.formatValue = function (valueBuffer) {
	var value = valueToBigInt(valueBuffer).toString();
	var integerPart = value.length > 8 ? value.substr(0, value.length-8) : '0';
	var decimalPart = value.length > 8 ? value.substr(value.length-8) : value;
	while (decimalPart.length < 8) decimalPart = "0"+decimalPart;
	decimalPart = decimalPart.replace(/0*$/, '');
	while (decimalPart.length < 2) decimalPart += "0";
	return integerPart+"."+decimalPart;
};

var pubKeyHashToAddress = exports.pubKeyHashToAddress = function (pubKeyHash) {
	if (!pubKeyHash) return "";

	var put = Binary.put();
	// Version
	put.word8le(0);
	// Hash
	put.put(pubKeyHash);
	// Checksum (four bytes)
	put.put(twoSha256(put.buffer()).slice(0,4));
	return encodeBase58(put.buffer());
};

var addressToPubKeyHash = exports.addressToPubKeyHash = function (address) {
	// Trim
	var address = new String(address).replace(/\s/g, '');

	// Check sanity
	if (!address.match(/^[1-9A-HJ-NP-Za-km-z]{27,35}$/)) {
		logger.warn("Not a valid Bitcoin address");
		return null;
	}

	// Decode
	var buffer = decodeBase58(address);

	// Parse
	var parser = Binary.parse(buffer);
	parser.word8('version');
	parser.buffer('hash', 20);
	parser.buffer('checksum', 4);

	// Check checksum
	var checksum = twoSha256(buffer.slice(0, 21)).slice(0, 4);
	if (checksum.compare(parser.vars.checksum) != 0) {
		logger.warn("Checksum comparison failed");
		return null;
	}

	return parser.vars.hash;
};

// Utility that synchronizes function calls based on a key
var createSynchrotron = exports.createSynchrotron = function (fn) {
	var table = {};
	return function (key) {
		var args = Array.prototype.slice.call(arguments);
		var run = function () {
			// Function fn() will call when it finishes
			args[0] = function next() {
				if (table[key]) {
					if (table[key].length) {
						table[key].shift()();
					} else {
						delete table[key];
					}
				}
			};

			fn.apply(null, args);
		};

		if (!table[key]) {
			table[key] = [];
			run();
		} else {
			table[key].push(run);
		}
	};
};

/**
 * Generate a random 64-bit number.
 *
 * With ideas from node-uuid:
 * Copyright (c) 2010 Robert Kieffer
 * https://github.com/broofa/node-uuid/
 *
 * @returns Buffer random nonce
 */
var generateNonce = exports.generateNonce = function () {
	var b32 = 0x100000000, ff = 0xff;
	var b = new Buffer(8), i = 0;

	// Generate eight random bytes
	r = Math.random()*b32;
	b[i++] = r & ff;
	b[i++] = (r=r>>>8) & ff;
	b[i++] = (r=r>>>8) & ff;
	b[i++] = (r=r>>>8) & ff;
	r = Math.random()*b32;
	b[i++] = r & ff;
	b[i++] = (r=r>>>8) & ff;
	b[i++] = (r=r>>>8) & ff;
	b[i++] = (r=r>>>8) & ff;

	return b;
};

/**
 * Decode difficulty bits.
 */
var decodeCompactBits = exports.decodeCompactBits = function (diffBits) {
	var target = bigint(diffBits & 0xffffff);
	// TODO: Add bitwise shift in upstream node-bigint
	target = target.mul(bigint(2).pow(8*((diffBits >>> 24) - 3)));
	return target.toBuffer();
};
