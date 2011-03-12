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
};

Connection.prototype.sendGetBlocks = function (starts, stop) {
	var put = Binary.put();
	put.word32le(this.version);

	put.var_uint(starts.length);
	for (var i in starts) {
		put.put(new Buffer(start, 'binary'));
	}

	put.put(new Buffer(stop, 'binary'));

	console.log(put.buffer());

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

	message.word16le(payload.length);

	if (checksum) {
		message.put(checksum);
	}

	message.put(payload);

	console.log(message.buffer());

	this.socket.write(message.buffer());
};
