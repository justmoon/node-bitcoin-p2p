# node-bitcoin-p2p

This is a client library for the Bitcoin P2P network, written for
Node.js, using MongoDB as it's backend.

# Status

This is very much experimental/alpha software. Currently it can
connect to a single peer, download and parse the block chain and index
all transactions.

# Differences to official client

The official client contains the node, wallet, GUI and miner. This
library only contains the node, i.e. the P2P stuff. It indexes all
transaction inputs and outputs by public key (if the scripts are in
the standard format). Using this index it can serve any wallet without
rescanning the block chain.

