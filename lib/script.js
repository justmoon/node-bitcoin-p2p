var logger = require('./logger');
var Util = require('./util');
var Binary = require('binary');
var Opcode = require('./opcode').Opcode;

// Make opcodes available as pseudo-constants
for (var i in Opcode.map) {
	eval(i + " = " + Opcode.map[i] + ";");
}


var Script = exports.Script = function (buffer) {
	if (buffer) {
		this.buffer = buffer;
	} else {
		this.buffer = new Buffer(0);
	}

	this.parse();
};

Script.prototype.parse = function () {
	this.chunks = [];

	var parser = Binary.parse(this.buffer)
	while (!parser.eof()) {
		var opcode = parser.word8('opcode').vars.opcode;
		if (opcode >= 0xF0) {
			// Two byte opcode
			opcode = (opcode << 8) | parser.word8('opcode2').vars.opcode2;
		}

		if (opcode > 0 && opcode < OP_PUSHDATA1) {
			// Read some bytes of data, opcode value is the length of data
			this.chunks.push(parser.buffer('data', opcode).vars.data);
		} else if (opcode == OP_PUSHDATA1) {
			parser.word8('len');
			this.chunks.push(parser.buffer('data', 'len').vars.data);
		} else if (opcode == OP_PUSHDATA2) {
			parser.word16le('len');
			this.chunks.push(parser.buffer('data', 'len').vars.data);
		} else if (opcode == OP_PUSHDATA4) {
			parser.word32le('len');
			this.chunks.push(parser.buffer('data', 'len').vars.data);
		} else {
			this.chunks.push(opcode);
		}
	}
};

Script.prototype.isSentToIP = function ()
{
	if (this.chunks.length != 2) return false;
	return this.chunks[1] == OP_CHECKSIG && this.chunks[0] instanceof Buffer;
};

Script.prototype.getOutType = function ()
{
	if (this.chunks.length == 5 &&
		this.chunks[0] == OP_DUP &&
		this.chunks[1] == OP_HASH160 &&
		this.chunks[3] == OP_EQUALVERIFY &&
		this.chunks[4] == OP_CHECKSIG) {

		// Transfer to Bitcoin address
		return 'Address';
	} else if (this.chunks.length == 2 &&
		this.chunks[1] == OP_CHECKSIG) {

		// Transfer to IP address
		return 'Pubkey';
	} else {
		return 'Strange';
	}
};

Script.prototype.simpleOutPubKeyHash = function ()
{
	switch (this.getOutType()) {
	case 'Address':
		return this.chunks[2];
	case 'Pubkey':
		return Util.sha256ripe160(this.chunks[0]);
	default:
		logger.info("Encountered non-standard scriptPubKey");
		logger.debug("Strange script was:" + this.toString());
		return null;
	}
};

Script.prototype.getInType = function ()
{
	if (this.chunks.length == 1) {
        // Direct IP to IP transactions only have the public key in their scriptSig.
		return 'Pubkey';
	} else if (this.chunks.length == 2 &&
			   this.chunks[0] instanceof Buffer &&
			   this.chunks[1] instanceof Buffer) {
		return 'Address';
	} else {
		logger.info("Encountered non-standard scriptSig");
		logger.debug("Strange script was:" + this.toString());
		return null;
	}
};

Script.prototype.simpleInPubKey = function ()
{
	switch (this.getInType()) {
	case 'Address':
		return this.chunks[1];
	case 'Pubkey':
		return this.chunks[0];
	default:
		logger.info("Encountered non-standard scriptSig");
		logger.debug("Strange script was:" + this.toString());
		return null;
	}
};

Script.prototype.getStringContent = function (truncate)
{
	if (truncate == null) truncate = true;

	var script = '';
	this.chunks.forEach(function (chunk, i) {
		script += " ";

		if (chunk instanceof Buffer) {
			script += Util.formatBuffer(chunk, truncate ? null : 0);
		} else {
			script += Opcode.reverseMap[chunk];
		}
	});
	return script;
};

Script.prototype.toString = function (truncate)
{
	var script = "<Script";
	script += this.getStringContent(truncate);
	script += ">";
	return script;
};

Script.verify = function (scriptSig, scriptPubKey, txTo, n, hashType) {
	// TODO: Implement

	// Create stack
	var stack = [];

	// DUMMY
	stack.unshift(true);

	// Evaluate scriptSig
	//scriptSig.eval(stack, txTo, n, hashType);

	// Evaluate scriptPubKey
	//scriptPubKey.eval(stack, txTo, n, hashType);

	// Check stack
	//if (stack.length == 0)
	//	throw new Error("Empty stack after script evaluation");

	return !!stack.shift();
};
