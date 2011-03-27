require('buffertools');
var Bitcoin = require('../lib/bitcoin');
var Storage = Bitcoin.Storage;
var Node = Bitcoin.Node;

var static_peers = ['localhost'];

var storage = new Storage('mongodb://localhost/bitcoin');

node = new Node(storage);

for (var i in static_peers) {
	node.addPeer(static_peers[i]);
}

node.start();
