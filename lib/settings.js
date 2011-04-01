var Settings = exports.Settings = function () {
	this.init();
	this.setStorageDefaults();
	this.setLivenetDefaults();
};

Settings.prototype.init = function () {
	this.storage = {};
	this.network = {};
};

Settings.prototype.setStorageDefaults = function () {
	this.storage.uri = 'mongodb://localhost/bitcoin';
};

Settings.prototype.setLivenetDefaults = function () {
	this.network.type = 'livenet';
	this.network.magicBytes = new Buffer('f9beb4d9', 'hex');
	this.network.initialPeers = ['localhost'];
};

Settings.prototype.setTestnetDefaults = function () {
	this.network.type = 'testnet';
	this.network.magicBytes = new Buffer('fabfb5da', 'hex');
	this.network.initialPeers = ['localhost'];
};
