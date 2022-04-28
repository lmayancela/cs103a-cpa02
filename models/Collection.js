'use strict';
const mongoose = require( 'mongoose' );
const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;

var collectionSchema = Schema({
    userId:ObjectId,
    gifLink:String,
});

module.exports = mongoose.model( 'Collection', collectionSchema );