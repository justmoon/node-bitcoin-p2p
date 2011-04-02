var Bitcoin = require('../lib/bitcoin');

node = new Bitcoin.Node();
node.cfg.network.bootstrap = [];
node.addPeer('localhost');
node.start();
