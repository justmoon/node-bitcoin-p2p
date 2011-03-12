var sys = require('sys');
var events = require('events');
var crypto = require('crypto');
var winston = require('winston'); // logging
var Binary = require('binary');

var magic = '\xF9\xBE\xB4\xD9';

function sha256(data) {
	return crypto.createHash('sha256').update(data).digest('binary');
};

Binary.put.prototype.var_uint = function (i) {
	if (i < 0xFD) {
		// unsigned char
		this.word8(i);
	} else if (i <= 1<<16) {
		this.word8(0xFD);
		// unsigned short (LE)
		this.word16le(i);
	} else if (i <= 1<<32) {
		this.word8(0xFE);
		// unsigned int (LE)
		this.word32le(i);
    } else {
		this.word8(0xFF);
		// unsigned long long (LE)
		this.word64le(i);
    }
};

var Connection = exports.Connection = function (us, socket, peer) {
	events.EventEmitter.call(this);

	this.us = us;
	this.socket = socket;
	this.peer = peer;
	this.version = 3;

	this.setupHandlers();
};

sys.inherits(Connection, events.EventEmitter);

Connection.prototype.setupHandlers = function () {
	this.socket.addListener('connect', this.handleConnect.bind(this));
	this.socket.addListener('data', this.handleData.bind(this));
};

Connection.prototype.handleConnect = function () {
	this.emit('connect', {
		conn: this,
		socket: this.socket,
		peer: this.peer
	});
};

Connection.prototype.handleData = function (data) {
	// data is a Buffer
	winston.info('Received '+data.length+' bytes of data');

	var message = this.parseMessage(data);

	switch (message.command) {
	case 'version':
		this.sendMessage('verack', new Buffer([]));
		this.sendMessage('getaddr', new Buffer([]));
		break;
	}

	this.emit(message.command, {
		conn: this,
		socket: this.socket,
		peer: this.peer,
		message: message
	});
};

Connection.prototype.sendGetBlocks = function (starts, stop) {
	var put = Binary.put();
	put.word32le(this.version);

	put.var_uint(starts.length);
	for (var i in starts) {
		var startBuffer = new Buffer(starts[i], 'binary');
		if (startBuffer.length != 32) throw 'Invalid hash length';
		put.put(startBuffer);
	}

	var stopBuffer = new Buffer(stop, 'binary');
	if (stopBuffer.length != 32) throw 'Invalid hash length';

	put.put(stopBuffer);

	this.sendMessage('getblocks', put.buffer());
};

Connection.prototype.sendMessage = function (command, payload) {
	if (command.length > 12) throw 'Command name too long';

	var checksum;
	if (command == 'version' || command == 'verack') {
		checksum = null;
	} else {
		checksum = (new Buffer(sha256(sha256(payload)), 'binary')).slice(0, 4);
	}

	var message = Binary.put();
	message.put(new Buffer(magic, 'binary'));
	message.put(new Buffer(command, 'ascii'));
	message.pad(12 - command.length);

	message.word32le(payload.length);

	if (checksum) {
		message.put(checksum);
	}

	message.put(payload);

	console.log("Sending message "+command);

	console.log(message.buffer());

	this.socket.write(message.buffer());
};

Connection.prototype.parseMessage = function (data) {
	if (data.slice(0,4).toString('binary') != magic)
		throw "Message did not start with magic sequence"

	var parser = Binary.parse(data);
	parser.skip(4); // magic
	parser.buffer('command', 12);
	parser.word32le('payload_len');
	parser.buffer('payload', 'payload_len');

	// Convert command name to string and remove trailing \0
	var command = parser.vars.command.toString('ascii').replace(/\0+$/,"");

	console.log("Received message "+command);

	parser = Binary.parse(parser.vars.payload);
	switch (command) {
	case 'version': // https://en.bitcoin.it/wiki/Protocol_specification#version
		parser.word32le('version');
		parser.word64le('services');
		parser.buffer('addr_me', 26);
		parser.buffer('addr_you', 26);
		parser.word64le('nonce');
		parser.scan('sub_version_num', '\0');
		parser.word32le('start_height');
		break;
	default:
		winston.error('Connection.parseMessage(): Command not implemented', {cmd: command});
		throw 'Command not implemented';
	}

	var message = parser.vars;

	message.command = command;

	return message;
};
