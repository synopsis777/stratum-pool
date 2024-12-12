var crypto = require('crypto');
var big = require('big.js');

const bs58 = require('bs58');

exports.addressFromEx = function(exAddress, ripdm160Key){
    try {
        var versionByte = exports.getVersionByte(exAddress);
        var addrBase = Buffer.concat([versionByte, Buffer.from(ripdm160Key, 'hex')]);
        var checksum = exports.sha256d(addrBase).slice(0, 4);
        var address = Buffer.concat([addrBase, checksum]);
        return bs58.encode(address);
    }
    catch(e){
        return null;
    }
};

exports.getVersionByte = function(addr){
    return bs58.decode(addr).slice(0, 1);
};

exports.sha256 = function(buffer){
    let hash1 = crypto.createHash('sha256');
    hash1.update(buffer);
    return hash1.digest();
};

exports.sha256d = function(buffer){
    return exports.sha256(exports.sha256(buffer));
};

exports.reverseBuffer = function(buff){
    var reversed = Buffer.alloc(buff.length);
    for (var i = buff.length - 1; i >= 0; i--)
        reversed[buff.length - i - 1] = buff[i];
    return reversed;
};

exports.reverseHex = function(hex){
    return exports.reverseBuffer(Buffer.from(hex, 'hex')).toString('hex');
};

exports.reverseByteOrder = function(buff){
    for (var i = 0; i < 8; i++) buff.writeUInt32LE(buff.readUInt32BE(i * 4), i * 4);
    return exports.reverseBuffer(buff);
};

exports.uint256BufferFromHash = function(hex){
    let fromHex = Buffer.from(hex, 'hex');

    if (fromHex.length !== 32){
        const empty = Buffer.alloc(32);
        empty.fill(0);
        fromHex.copy(empty);
        fromHex = empty;
    }

    return exports.reverseBuffer(fromHex);
};

exports.hexFromReversedBuffer = function(buffer){
    return exports.reverseBuffer(buffer).toString('hex');
};

// For handling BigInt and Buffer conversion
exports.bufferToBigInt = function(buff) {
    return BigInt("0x" + buff.toString('hex'));
};

exports.bufferToCompactBits = function(startingBuff){
    console.log('bufferToCompactBits | startingBuff', startingBuff);

    const bigNum = exports.bufferToBigInt(startingBuff);
    let buff = Buffer.from(bigNum.toString(16), 'hex');

    buff = buff.readUInt8(0) > 0x7f ? Buffer.concat([Buffer.from([0x00]), buff]) : buff;

    buff = Buffer.concat([Buffer.from([buff.length]), buff]);

    return buff.slice(0, 4);
};

// Function for converting bits from the "compact bits" representation to a full-size buffer
exports.bignumFromBitsBuffer = function(bitsBuff){
    console.log('bignumFromBitsBuffer | bitsBuff', bitsBuff);

    const numBytes = bitsBuff.readUInt8(0);
    const bigBits = exports.bufferToBigInt(bitsBuff.slice(1));

    return bigBits * BigInt(2) ** BigInt(8 * (numBytes - 3));
};

// Helper function to convert BigInt back to Buffer (if needed)
exports.convertBitsToBuff = function(bitsBuff){
    const target = exports.bignumFromBitsBuffer(bitsBuff);
    const resultBuff = Buffer.from(target.toString(16), 'hex');
    const buff256 = Buffer.alloc(32);
    buff256.fill(0);
    resultBuff.copy(buff256, buff256.length - resultBuff.length);
    return buff256;
};

exports.getTruncatedDiff = function(shift) {
    return exports.convertBitsToBuff(exports.bufferToCompactBits(exports.shiftMax256Right(shift)));
};

// Function for shifting the max 256-bit value
exports.shiftMax256Right = function(shiftRight){
    let arr256 = Array(256).fill(1);
    let arrLeft = Array(shiftRight).fill(0);

    arr256 = arrLeft.concat(arr256).slice(0, 256);

    let octets = [];

    for (let i = 0; i < 32; i++){
        octets[i] = 0;
        const bits = arr256.slice(i * 8, i * 8 + 8);
        for (let f = 0; f < bits.length; f++){
            const multiplier = Math.pow(2, f);
            octets[i] += bits[f] * multiplier;
        }
    }

    return Buffer.from(octets);
};

// Function for converting buffer to compact bits representation
exports.bufferToCompactBits = function(startingBuff){
    console.log('bufferToCompactBits | startingBuff', startingBuff);

    // Convert the buffer to a BigInt
    const bigNum = exports.bufferToBigInt(startingBuff);
    
    // Convert BigInt back to Buffer
    let buff = Buffer.from(bigNum.toString(16), 'hex');

    // Ensure the first byte is signed properly for compact encoding
    buff = buff.readUInt8(0) > 0x7f ? Buffer.concat([Buffer.from([0x00]), buff]) : buff;

    // Prefix the length of the buffer
    buff = Buffer.concat([Buffer.from([buff.length]), buff]);

    // Return the compact view (first 4 bytes)
    return buff.slice(0, 4);
};

// Function for converting bits buffer to a bignum equivalent (target)
exports.bignumFromBitsBuffer = function(bitsBuff){
    console.log('bignumFromBitsBuffer | bitsBuff', bitsBuff);

    const numBytes = bitsBuff.readUInt8(0);
    
    // Convert the bits to a BigInt
    const bigBits = exports.bufferToBigInt(bitsBuff.slice(1));

    // Multiply by 2^(8 * (numBytes - 3)) for final target value
    return bigBits * BigInt(2) ** BigInt(8 * (numBytes - 3));
};

// Convert a hexadecimal string (bits) into the target BigInt
exports.bignumFromBitsHex = function(bitsString){
    const bitsBuff = Buffer.from(bitsString, 'hex');
    return exports.bignumFromBitsBuffer(bitsBuff);
};

// Convert bits buffer to 32-byte buffer
exports.convertBitsToBuff = function(bitsBuff){
    const target = exports.bignumFromBitsBuffer(bitsBuff);

    // Convert the BigInt result to a Buffer
    const resultBuff = Buffer.from(target.toString(16), 'hex');

    // Allocate a 32-byte buffer and copy the result into it
    const buff256 = Buffer.alloc(32);
    resultBuff.copy(buff256, buff256.length - resultBuff.length);

    return buff256;
};

// Get the truncated difference (shifted value) in compact bits
exports.getTruncatedDiff = function(shift) {
    return exports.convertBitsToBuff(exports.bufferToCompactBits(exports.shiftMax256Right(shift)));
};