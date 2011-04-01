var profiler = require("v8-profiler");
var Bitcoin = require('../lib/bitcoin');

// Settings
// -----------------------------------------------------------------------------

var settings = new Bitcoin.Settings();

// Connect to live Bitcoin network
settings.setLivenetDefaults();

// Add peers to connect to
settings.network.initialPeers.push('localhost');

// MongoDB URI
settings.storage.uri ='mongodb://localhost/bitcoin';

node = new Bitcoin.Node(settings);

node.addPeer('localhost');

// Profile each state in the startup routine
node.addListener('stateChange', function (e) {
	// Start profiling for the state that just started
	if (e.newState) {
		profiler.startProfiling(e.newState);
	}

	// Stop profiling for the state that just ended
	if (e.oldState) {
		profiler.stopProfiling(e.newState);
	}
});

node.start();
