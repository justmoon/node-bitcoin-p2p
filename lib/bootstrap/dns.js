var dns = require('dns');
var logger = require('../logger');

var DnsBootstrapper = exports.DnsBootstrapper = function (hosts) {
	this.hosts = hosts;
};

DnsBootstrapper.prototype.bootstrap = function (node, peermanager) {
	this.node = node;
	this.peermanager = peermanager;

	var self = this;

	this.hosts.forEach(function (host) {
		dns.resolve4(host, function (err, addresses) {
			if (err) {
				logger.warn('DNS bootstrap for '+host+' failed');
				return;
			}

			addresses.forEach(function (addr) {
				peermanager.addPeer(addr);
			});

			logger.info('DNS Bootstrap for '+host+' found '+
						 addresses.length+' peers');
		})
	});
};
