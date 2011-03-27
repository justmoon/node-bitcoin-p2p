require('buffertools');
var Storage = require('./bitcoin/storage').Storage;
var Node = require('./bitcoin/node').Node;

var static_peers = ['localhost'];

var storage = new Storage('mongodb://localhost/bitcoin');

node = new Node(storage);

for (var i in static_peers) {
	node.addPeer(static_peers[i]);
}

node.start();
