// load the things we need
var mongoose = require('mongoose')
var ObjectId = mongoose.Schema.Types.ObjectId

// define the schema for settings
var eventSchema = mongoose.Schema({
  'date'  : {
    type     : Date,
    required : true,
    default  : Date.now()
  },
  'game'    : {
    type     : String,
    required : true
  },
  'public'  : {
    type     : Boolean,
    required : true,
    default  : false
  },
  'message' : {
    type     : String,
    required : true
  }
})

module.exports = mongoose.model('Event', eventSchema)
