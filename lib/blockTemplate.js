var big = require('big.js');
var merkleTree = require('./merkleTree.js');
var transactions = require('./transactions.js');
var util = require('./util.js');

var BlockTemplate = module.exports = function BlockTemplate(jobId, rpcData, poolAddressScript, extraNoncePlaceholder, reward, txMessages, recipients) {
    var submits = new Set();  // Using Set for faster lookups

    function getMerkleHashes(steps) {
        return steps.map(function(step) {
            return step.toString('hex');
        });
    }

    function getTransactionBuffers(txs) {
        if (!Array.isArray(txs)) throw new Error('Txs must be an array');
        var txHashes = txs.map(function(tx) {
            if (tx.txid !== undefined) {
                return util.uint256BufferFromHash(tx.txid);
            }
            return util.uint256BufferFromHash(tx.hash);
        });
        return [null].concat(txHashes);
    }

    function getVoteData() {
        if (!rpcData.masternode_payments) return Buffer.from([]);
        return Buffer.concat(
            [util.varIntBuffer(rpcData.votes.length)].concat(
                rpcData.votes.map(function(vt) {
                    return Buffer.from(vt, 'hex');
                })
            )
        );
    }

    this.rpcData = rpcData;
    this.jobId = jobId;

    this.target = rpcData.target ?
        big(rpcData.target, 16) :
        util.bignumFromBitsHex(rpcData.bits);

    this.difficulty = big(rpcData.difficulty || 1).div(this.target).toFixed(9);
    this.prevHashReversed = util.reverseByteOrder(Buffer.from(rpcData.previousblockhash, 'hex')).toString('hex');
    this.transactionData = Buffer.concat(rpcData.transactions.map(function(tx) {
        return Buffer.from(tx.data, 'hex');
    }));
    this.merkleTree = new merkleTree(getTransactionBuffers(rpcData.transactions));
    this.merkleBranch = getMerkleHashes(this.merkleTree.steps);

    this.serializeHeader = function(merkleRoot, nTime, nonce) {
        var header = Buffer.from(new Array(80));
        var position = 0;
        header.write(nonce, position, 4, 'hex');
        header.write(rpcData.bits, position += 4, 4, 'hex');
        header.write(nTime, position += 4, 4, 'hex');
        header.write(merkleRoot, position += 4, 32, 'hex');
        header.write(rpcData.previousblockhash, position += 32, 32, 'hex');
        header.writeUInt32BE(rpcData.version, position + 32);
        return util.reverseBuffer(header);
    };

    this.serializeBlock = function(header, coinbase) {
        return Buffer.concat([
            header,
            util.varIntBuffer(this.rpcData.transactions.length + 1),
            coinbase,
            this.transactionData,
            getVoteData(),
            Buffer.from(reward === 'POS' ? [0] : [])
        ]);
    };

    this.registerSubmit = function(extraNonce1, extraNonce2, nTime, nonce) {
        var submission = extraNonce1 + extraNonce2 + nTime + nonce;
        if (!submits.has(submission)) {
            submits.add(submission);
            return true;
        }
        return false;
    };

    this.getJobParams = function() {
        if (!this.jobParams) {
            this.jobParams = [
                this.jobId,
                this.prevHashReversed,
                this.generationTransaction[0].toString('hex'),
                this.generationTransaction[1].toString('hex'),
                this.merkleBranch,
                util.packInt32BE(this.rpcData.version).toString('hex'),
                this.rpcData.bits,
                util.packUInt32BE(this.rpcData.curtime).toString('hex'),
                true
            ];
        }
        return this.jobParams;
    };
};
