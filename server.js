var Node = require('./bitcoin/node').Node;

var static_peers = ['192.168.0.17'];

node = new Node();
node.start();

for (var i in static_peers) {
	node.addPeer(static_peers[i]);
}

