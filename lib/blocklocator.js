var BlockLocator = exports.BlockLocator = function () {
};

BlockLocator.createFromBlockChain = function (blockChain, callback) {
	var height = blockChain.getTopBlock().height;
	var step = 1;
	var heights = [];
	while (height > 0) {
		heights.push(height);
		if (heights.length > 10) step *= 2;
		height -= step;
	}
	blockChain.storage.Block.find({"height": {"$in": heights}}, function (err, result) {
		if (err) {
			callback(err);
			return;
		}

		var locator = result.map(function (v) {
			return v.getHash();
		}).reverse();

		callback(null, locator);
	});
};
