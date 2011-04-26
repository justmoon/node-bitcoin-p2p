var IrcBootstrapper = require('./bootstrap/irc.js').IrcBootstrapper
var DnsBootstrapper = require('./bootstrap/dns.js').DnsBootstrapper
var Util = require('./util');

var Settings = exports.Settings = function () {
	this.init();
	this.setStorageDefaults();
	this.setLivenetDefaults();
	this.setFeatureDefaults();
};

Settings.prototype.init = function () {
	this.storage = {};
	this.network = {};
	this.feature = {};
};

Settings.prototype.setStorageDefaults = function () {
	this.storage.uri = 'mongodb://localhost/bitcoin';
};

Settings.prototype.setLivenetDefaults = function () {
	this.network.type = 'livenet';
	this.network.magicBytes = new Buffer('f9beb4d9', 'hex');
	this.network.initialPeers = [];
	this.network.bootstrap = [
		new DnsBootstrapper([
			"bitseed.xf2.org",
			"bitseed.bitcoin.org.uk",
		]),
		new IrcBootstrapper('irc.lfnet.org', '#bitcoin')
	];
};

Settings.prototype.setTestnetDefaults = function () {
	this.network.type = 'testnet';
	this.network.magicBytes = new Buffer('fabfb5da', 'hex');
	this.network.initialPeers = [];
	this.network.bootstrap = [
		new IrcBootstrapper('irc.lfnet.org', '#bitcoinTEST')
	];
};

Settings.prototype.setFeatureDefaults = function () {
	// Live accounting means the memory pool will create events containing
	// the individual pubKeyHash of a Bitcoin address. This allows wallets
	// to update themselves live by registering their pubKeys as event
	// listeners.
	this.feature.liveAccounting = true;
};
