var sys = require('sys');
var winston = require('winston'); // logging
var Peer = require('./peer').Peer;
var Connection = require('./connection').Connection;

var PeerManager = exports.PeerManager = function (node) {
	events.EventEmitter.call(this);

	this.node = node;
	this.enabled = false;
	this.timer = null;

	this.peers = [];
	this.connections = [];
	this.activeConnections = [];

	// Move these to the Node's settings object
	this.interval = 5000;
	this.minConnections = 8;
};

sys.inherits(PeerManager, events.EventEmitter);

PeerManager.prototype.enable = function ()
{
	this.enabled = true;

	if (!this.timer) {
		this.checkStatus();
	}
};

PeerManager.prototype.disable = function ()
{
	this.enabled = false;
};

PeerManager.prototype.addPeer = function (peer) {
	if (peer instanceof Peer) {
		this.peers.push(peer);
	} else if ("string" == typeof peer) {
		this.addPeer(new Peer(peer));
	} else {
		winston.log('error', 'Node.addPeer(): Invalid value provided for peer', {val: peer});
		throw 'Node.addPeer(): Invalid value provided for peer.';
	}
};

PeerManager.prototype.checkStatus = function ()
{
	if (!this.enabled) return;

	console.log("checking");

	// Find peers that we think are valid, but aren't connected to
	var connectablePeers = [];
	outerloop:for (var i = 0; i < this.peers.length; i++) {
		for (var j = 0; j < this.connections.length; j++) {
			if (this.connections[j].peer == this.peers[i]) continue outerloop;
		}
		connectablePeers.push(this.peers[i]);
	}
	console.log(connectablePeers);

	while (this.connections.length < this.minConnections &&
		   connectablePeers.length) {
		var peer = connectablePeers.shift();
		this.connect(peer);
	}
	this.timer = setTimeout(this.checkStatus.bind(this), this.interval);
};

PeerManager.prototype.connect = function (peer)
{
	winston.info('Connecting to peer '+peer);
	var conn = new Connection(this.node, peer.createConnection(), peer);
	this.connections.push(conn);
	this.node.addConnection(conn);

	conn.addListener('verack', this.handleReady.bind(this));
};

PeerManager.prototype.handleReady = function (e) {
	this.activeConnections.push(e.conn);

	if (this.activeConnections.length == 1) this.emit('netConnected');
};

PeerManager.prototype.getActiveConnection = function () {
	if (this.activeConnections.length) {
		var randomIndex = Math.floor(Math.random()*this.activeConnections.length);
		return this.activeConnections[randomIndex];
	} else {
		return null;
	}
};
