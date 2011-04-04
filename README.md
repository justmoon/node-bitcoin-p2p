# node-bitcoin-p2p

This is a client library for the Bitcoin P2P network, written for
Node.js, using MongoDB as its back end.

# Differences to official client

The official client contains the node, wallet, GUI and miner. This
library only contains the node, i.e. the P2P part of Bitcoin. Its
intended use is as a server component to allow lighter clients
(real-time) access to the data in the block chain.

# Usage

Several examples on how to start up the library are provided in the
`examples/` folder. To run an example simply call it with node:

    node examples/simple.js

The most basic way to start node-bitcoin-p2p in your own code  goes
like this:

    var Bitcoin = require('bitcoin-p2p');

    node = new Bitcoin.Node();
    node.start();

All the other examples presuppose you've already started a node using
this code.

Once the node is running it will automatically connect to the Bitcoin
network and begin downloading blocks. There are two major ways to get
information from the library: Events and Storage.

## Events

Get a reference to the BlockChain object to start listening to block
chain changes:

    var chain = node.getBlockChain();
    // Log each block as it's added to the block chain
    chain.addListener('blockSave', function (e) {
        console.log(e.block);
    });

BlockChain emits the following events:

**`blockAdd`** - Triggered right before a block is saved to storage
- `block` The Block object for the block in question
- `txs` The transactions attached to the block
- `chain` The BlockChain object

**`blockSave`** - Triggered right after a block is saved to storage
- `block` The Block object for the block in question
- `txs` The transactions attached to the block
- `chain` The BlockChain object

**`blockCommit`** - Triggered when a block is attached to the main
  chain *(not yet implemented)*
- `block` The Block object for the block in question
- `txs` The transactions attached to the block
- `chain` The BlockChain object

**`blockRevoke`** - Triggered as the main chain is rolled back due to
a split *(not yet implemented)*
- `block` The Block object for the block in question
- `txs` The transactions attached to the block
- `chain` The BlockChain object

**`txAdd`** - Triggered right before a transaction is saved to storage
- `block` Containing Block object
- `index` The index of the transaction in question
- `tx` The Transaction object
- `chain` The BlockChain object

**`txSave`** - Triggered right after a transaction is saved to storage
- `block` Containing Block object
- `index` The index of the transaction in question
- `tx` The Transaction object
- `chain` The BlockChain object

**`txCommit`** - Triggered when a transaction is confirmed for the
first time *(not yet implemented)*
- `block` Containing Block object
- `index` The index of the transaction in question
- `tx` The Transaction object
- `chain` The BlockChain object

**`txRevoke`** - Triggered when a confirmed transaction is reverted as
the containing block is no longer in the main chain *(not yet
implemented)*
- `block` Containing Block object
- `index` The index of the transaction in question
- `tx` The Transaction object
- `chain` The BlockChain object

## Storage

`node-bitcoin-p2p` uses the Mongoose ORM layer. You can find the
schemas for the database objects in the source code under lib/schema/.

All the models are instantiated by the `Storage` class, so all you
need to do is get a reference to that from the Bitcoin `Node` and
you're good to go:

    var storage = node.getStorage();
    storage.Transaction.findOne({hash: hash}, function (err, tx) {
        // In real code, you'd handle the error of course
        if (err) return;

        storage.Block.findOne({_id: tx.block}, function (err, block) {
            if (err) return;

            // Do something fancy here...
        });
    });

There are also some convenience functions you can use:

    var chain = node.getBlockChain();
    chain.getBlockByHash(hash, function (err, block) {
        if (err) return;

        // Do something with the Block
        console.log(block);
    });

## Logging

`node-bitcoin-p2p` logs using the winston library. Currently, it
defaults to logging anything on the `debug` log level and higher. Here
are the available log levels:

- `netdbg` - Networking events (sending/receiving messages)
- `bchdbg` - Block chain events (adding blocks)
- `debug` - Other verbose logging
- `info` - General information and status messages
- `warn` - Something rare happened (e.g. strange pubKeyScript)
- `error` - Something bad happened

If you run node-bitcoin-p2p from a compatible shell, you should get a
fairly nice series of log messages as it is booting up.

# Status

The library is currently alpha quality. Here are some things it
currently lacks:

- Correct handling of block chain splits
- Verify outpoints for transaction inputs
- Verify difficulty transitions
- Accept incoming Bitcoin connections (optionally)
- Store hashes etc. as MongoDB BinData instead of base64

On top of that, it could use a lot more documentation, test
cases and general bug fixing across the board.

You can find more information on the Issues tab on Github.
