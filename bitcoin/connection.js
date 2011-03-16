var sys = require('sys');
var events = require('events');
var winston = require('winston'); // logging
var Binary = require('binary');
var Util = require('./util');

var magic = new Buffer('f9beb4d9', 'hex');

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

	// The version incoming packages are interpreted as
	this.recvVer = 0;
	// The version outgoing packages are sent as
	this.sendVer = 0;

	// Starting 20 Feb 2012, Version 0.2 is obsolete
	// This is the same behavior as the official client
	if (new Date().getTime() > 1329696000000) {
		this.recvVer = 209;
		this.sendVer = 209;
	}

	this.setupHandlers();
};

sys.inherits(Connection, events.EventEmitter);

Connection.prototype.setupHandlers = function () {
	this.socket.addListener('connect', this.handleConnect.bind(this));
	this.socket.addListener('data', function (data) {
		var dumpLen = 35;
		winston.debug('Recieved '+data.length+' bytes of data '+data.slice(0, dumpLen > data.length ? data.length : dumpLen).toString('hex') + (data.length > dumpLen ? '...' : ''));
	});

	var parser = Binary.stream(this.socket);
	this.setupParser(parser, this.handleMessage.bind(this));
};

Connection.prototype.handleConnect = function () {
	this.sendVersion();
	this.emit('connect', {
		conn: this,
		socket: this.socket,
		peer: this.peer
	});
};

Connection.prototype.handleMessage = function (message) {
	switch (message.command) {
	case 'version':
		if (message.version >= 209) {
			this.sendMessage('verack', new Buffer([]));
		}
		this.sendVer = Math.min(message.version, this.us.version);
		if (message.version < 209) {
			this.recvVer = Math.min(message.version, this.us.version);
		} else {
			// We won't start expecting a checksum until after we've received
			// the "verack" message.
			this.once('verack', (function () {
				this.recvVer = message.version;
			}).bind(this));
		}
		break;

	case 'verack':
		this.recvVer = Math.min(message.version, this.us.version);
	}

	this.emit(message.command, {
		conn: this,
		socket: this.socket,
		peer: this.peer,
		message: message
	});
};

Connection.prototype.sendVersion = function () {
	var put = Binary.put();
	put.word32le(this.us.version); // version
	put.word64le(1); // services
	put.word64le(Math.round(new Date().getTime()/1000)); // timestamp
	put.pad(26); // addr_me
	put.pad(26); // addr_you
	put.put(this.us.nonce);
	put.word8(0);
	put.word32le(10);

	this.sendMessage('version', put.buffer());
};

Connection.prototype.sendGetBlocks = function (starts, stop) {
	var put = Binary.put();
	put.word32le(this.sendVer);

	put.var_uint(starts.length);
	for (var i = 0; i < starts.length; i++) {
		var startBuffer = new Buffer(starts[i], 'binary');
		if (startBuffer.length != 32) throw 'Invalid hash length';
		put.put(startBuffer);
	}

	var stopBuffer = new Buffer(stop, 'binary');
	if (stopBuffer.length != 32) throw 'Invalid hash length';

	put.put(stopBuffer);

	this.sendMessage('getblocks', put.buffer());
};

Connection.prototype.sendGetData = function (invs) {
	var put = Binary.put();

	put.var_uint(invs.length);
	for (var i = 0; i < invs.length; i++) {
		put.word32le(invs[i].type);
		put.put(invs[i].hash);
	}

	this.sendMessage('getdata', put.buffer());
};

Connection.prototype.sendGetAddr = function (invs) {
	var put = Binary.put();

	this.sendMessage('getaddr', put.buffer());
};

Connection.prototype.sendMessage = function (command, payload) {
	var commandBuf = new Buffer(command, 'ascii');
	if (commandBuf.length > 12) throw 'Command name too long';

	var checksum;
	if (this.sendVer >= 209) {
		checksum = Util.twoSha256(payload).slice(0, 4);
	} else {
		checksum = new Buffer([]);
	}

	var message = Binary.put();           // -- HEADER --
	message.put(magic);                   // magic bytes
	message.put(commandBuf);              // command name
	message.pad(12 - commandBuf.length);  // zero-padded
	message.word32le(payload.length);     // payload length
	message.put(checksum);                // checksum
	                                      // -- BODY --
	message.put(payload);                 // payload data

	var buffer = message.buffer();

	winston.debug("Sending message "+command+" ("+payload.length+" bytes)");

	this.socket.write(buffer);
};

Connection.prototype.setupParser = function (parser, callback) {
	var self = this;

	parser.loop(function (end) {
		var vars = this.vars;

		this.scan('garbage', magic); // magic
		this.buffer('command', 12);
		this.word32le('payload_len');

		if (self.recvVer >= 209) {
			this.buffer('checksum', 4);
		}

		this.buffer('payload', 'payload_len');

		this.tap(function (vars) {
			if (vars.garbage.length) {
				winston.debug('Received '+vars.garbage.length+' bytes of inter-message garbage: ');
				winston.debug(vars.garbage);
			}

			// Convert command name to string and remove trailing \0
			var command = vars.command.toString('ascii').replace(/\0+$/,"");

			winston.debug("Received message "+command+" ("+vars['payload_len']+" bytes)");

			if (vars.payload.length != vars['payload_len']) {
				winston.error('Connection.setupParser(): Payload has incorrect length');
			}

			if ("undefined" !== typeof vars.checksum) {
				var checksum = (new Buffer(Util.twoSha256(vars.payload), 'binary'));
				if (vars.checksum[0] != checksum[0] ||
					vars.checksum[1] != checksum[1] ||
					vars.checksum[2] != checksum[2] ||
					vars.checksum[3] != checksum[3]) {
					winston.error('Connection.setupParser(): Checksum failed',
								  {cmd: command,
								   expected: checksum.parent.hexSlice(0,4),
								   actual: vars.checksum.parent.hexSlice(0,4)});
					throw 'Unable to validate checksum';
				}
			}

			self.parseMessage(command, vars.payload, callback);
		});
	});
};

Connection.prototype.parseMessage = function (command, payload, callback) {
	var parser = Binary.parse(payload);

	parser.vars.command = command;

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

	case 'inv':
		this.parseVarInt(parser, 'count');

		var invs = [];
		for (var i = 0; i < parser.vars.count; i++) {
			parser.word32le('type');
			parser.buffer('hash', 32);
			invs.push({type: parser.vars.type, hash: parser.vars.hash});
			delete parser.vars.type;
			delete parser.vars.hash;
		}

		parser.vars.invs = invs;
		break;

	case 'block':
		parser.word32le('version');
		parser.buffer('prev_hash', 32);
		parser.buffer('merkle_root', 32);
		parser.word32le('timestamp');
		parser.word32le('bits');
		parser.word32le('nonce');
		this.parseVarInt(parser, 'txn_count');

		// TODO: Parse tx
		break;

	case 'addr':
		// TODO: Parse
		break;

	case 'getaddr':
		// Empty message, nothing to parse
		break;

	case 'verack':
		// Empty message, nothing to parse
		break;

	case 'ping':
		// Empty message, nothing to parse
		break;

	default:
		winston.error('Connection.parseMessage(): Command not implemented',
					  {cmd: command});
		return;
	}

	var message = parser.vars;

	callback(message);
};

Connection.prototype.parseVarInt = function (parser, name) {
	// TODO: This function currently only supports reading from buffers, not streams

	parser.word8(name+'_byte');

	switch (parser.vars[name+'_byte']) {
	case 0xFD:
		parser.word16le(name);
		break;

	case 0xFE:
		parser.word32le(name);
		break;

	case 0xFF:
		parser.word64le(name);
		break;

	default:
		parser.vars[name] = parser.vars[name+'_byte'];
	}

	delete parser.vars[name+'_byte'];
};
