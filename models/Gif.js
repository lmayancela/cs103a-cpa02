'use strict';
const mongoose = require( 'mongoose' );
const Schema = mongoose.Schema;

var gifSchema = Schema({
    title: String,
    url: String,
    mp4: String,
    slug: String,
});

module.exports = mongoose.model( 'Gif', gifSchema );