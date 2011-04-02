var path = require('path');
require.paths.unshift(path.join(__dirname, '..'));

var vows = require('vows'),
    assert = require('assert');

var Util = require('lib/util');

var suite = vows.describe('util');

suite.addBatch({
	'Bitcoin addresses': {
		'decode a bitcoin address': {
			topic: "12c6DSiU4Rq3P4ZxziKxzrL5LmMBrzjrJX",

			'and check the result': function (topic) {
				var addrHash = Util.addressToPubKeyHash(topic);
				assert.equal(Util.pubKeyHashToAddress(addrHash), topic);
			}
		},
		'encode a bitcoin address': {
			topic: new Buffer("119b098e2e980a229e139a9ed01a469e518e6f26", 'hex'),

			'and check the result': function (topic) {
				var addrHash = Util.pubKeyHashToAddress(topic);
				assert.equal(Util.addressToPubKeyHash(addrHash).compare(topic), 0);
			}
		}
	},

	'difficulty': {
		'calculate target from bits': {
			topic: 0x1b0404cb,

			'and check the result': function (topic) {
				var target = Util.decodeDiffBits(topic);
				assert.equal(target.toHex(),
							"00000000000404cb000000000000000000000000000000000000000000000000");
			}
		}
	}
});

suite.run();
