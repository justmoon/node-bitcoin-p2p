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

		var len;
		if (opcode > 0 && opcode < OP_PUSHDATA1) {
			// Read some bytes of data, opcode value is the length of data
			len = opcode;
			this.chunks.push(parser.buffer('data', len).vars.data);
		} else if (opcode == OP_PUSHDATA1) {
			len = parser.word8('len').vars.len;
			this.chunks.push(parser.buffer('data', len).vars.data);
		} else if (opcode == OP_PUSHDATA2) {
			len = parser.word16le('len').vars.len;
			this.chunks.push(parser.buffer('data', len).vars.data);
		} else if (opcode == OP_PUSHDATA4) {
			len = parser.word32le('len').vars.len;
			this.chunks.push(parser.buffer('data', len).vars.data);
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

Script.prototype.simpleOutPubKeyHash = function ()
{
	if (this.chunks.length == 5 &&
		this.chunks[0] == OP_DUP &&
		this.chunks[1] == OP_HASH160 &&
		this.chunks[3] == OP_EQUALVERIFY &&
		this.chunks[4] == OP_CHECKSIG) {

		// Transfer to Bitcoin address
		return this.chunks[2];
	} else if (this.chunks.length == 2 &&
		this.chunks[1] == OP_CHECKSIG) {

		// Transfer to IP address
		return Util.sha256ripe160(this.chunks[0]);
	} else {
		throw "Script not in the standard scriptPubKey form:\n" +
			this;
	}

};

Script.prototype.simpleInPubKey = function ()
{
	if (this.chunks.length == 1) {
        // Direct IP to IP transactions only have the public key in their scriptSig.
		return this.chunks[0];
	} else if (this.chunks.length == 2 &&
			   this.chunks[0] instanceof Buffer &&
			   this.chunks[1] instanceof Buffer) {
		return this.chunks[1];
	} else {
		throw "Script not in the standard scriptSig form:\n" +
			this;
	}
};

Script.prototype.toString = function ()
{
	var script = "<Script";
	this.chunks.forEach(function (chunk, i) {
		script += " ";

		if (chunk instanceof Buffer) {
			script += Util.formatBuffer(chunk);
		} else {
			script += Opcode.reverseMap[chunk];
		}
	});
	script += ">";
	return script;
};
