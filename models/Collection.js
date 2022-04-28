'use strict';
const mongoose = require( 'mongoose' );
const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;

var collectionSchema = Schema({
    userId:ObjectId,
    gifId:ObjectId,
});

module.exports = mongoose.model( 'Collection', collectionSchema );