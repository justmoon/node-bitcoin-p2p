var Connection = exports.Connection = function (us, socket, peer) {
	this.us = us;
	this.socket = socket;
	this.peer = peer;

	this.setupHandlers();
};

Connection.prototype.setupHandlers = function () {
	
};
