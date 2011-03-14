require('buffertools');
var Storage = require('./bitcoin/storage').Storage;
var Node = require('./bitcoin/node').Node;

var static_peers = ['192.168.0.17'];

var storage = new Storage('mongodb://localhost/bitcoin');

node = new Node(storage);
node.start();

for (var i in static_peers) {
	node.addPeer(static_peers[i]);
}
