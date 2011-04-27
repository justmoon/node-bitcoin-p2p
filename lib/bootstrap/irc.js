var irc = require('irc');
var util = require('util');

var Binary = require('../binary');
var Util = require('../util');
var logger = require('../logger');

var IrcBootstrapper = exports.IrcBootstrapper = function (host, channel) {
	this.nick = null;
	this.client = null;
	this.host = host;
	this.channel = channel;
};

IrcBootstrapper.prototype.bootstrap = function (node, peermanager) {
	if (this.client) return;

	this.node = node;
	this.peermanager = peermanager;

	this.nick = "x"+Math.floor(Math.random()*1000000000);
	this.client = new irc.Client(this.host, this.nick);
	this.client.addListener('registered', this.handleConnect.bind(this));
	this.client.addListener('names', this.handleNames.bind(this));
	this.client.addListener('join', this.handleJoin.bind(this));
	this.client.addListener('error', this.handleError.bind(this));
};

IrcBootstrapper.prototype.handleConnect = function () {
	// TODO: Calculate and advertise own address before joining

	this.client.join(this.channel);
};

IrcBootstrapper.prototype.handleNames = function (chan, nicks) {
	var count = 0;
	for (var i in nicks) {
		var addr = this.decodeAddress(i);
		if (addr == null) continue;
		this.peermanager.addPeer(addr.ip, addr.port);
		count++;
	}

	logger.info('IRC Bootstrap found '+count+' peers');
};

IrcBootstrapper.prototype.handleJoin = function (chan, nick) {
	if (nick == this.nick) return;

	var addr = this.decodeAddress(nick);
	if (addr == null) return;
	this.peermanager.addPeer(addr.ip, addr.port);
};

IrcBootstrapper.prototype.handleError = function (message) {
	logger.error("IRC Bootstrap received error: "+util.inspect(message));
};

IrcBootstrapper.prototype.encodeAddress = function (addr) {
	// TODO
};

IrcBootstrapper.prototype.decodeAddress = function (addr) {
	if (!addr.match(/^u[1-9A-HJ-NP-Za-km-z]+$/)) return null;
	var addrBin = Util.decodeBase58(addr.substr(1));

	var parser = Binary.parse(addrBin);
	parser.buffer('ip', 4);
	parser.word16be('port');

	var ip = parser.vars.ip;

	return {
		ip: ip[0]+'.'+ip[1]+'.'+ip[2]+'.'+ip[3],
		port: parser.vars.port
	};
};

