var AppDispatcher = require('../dispatchers/app');
var EventEmitter  = require('events').EventEmitter;
var assign        = require('object-assign');

var CHANGE_EVENT = 'change';

var _qlist = [];
var _count = null;

// Number of questions per page
var no = 10;
// Initial page Number
var page = 1;
// Search term
var term = '';

function getQotdData(no, page, term) {
  var url = '/api/wouso-qotd/list/' + no + '/' + page + '?search=' + term;
  $.get(url, function(res) {
    _qlist = res.questions;
    _count = res.count;
    QStore.emitChange();
  });
}

function getQuestData(no, page, term) {
  var url = '/api/wouso-quest/list/' + no + '/' + page + '?search=' + term;
  $.get(url, function(res) {
    _qlist = res.questions;
    _count = res.count;
    QStore.emitChange();
  });
}

var QStore = assign({}, EventEmitter.prototype, {

  getCurrent: function() {
    return _qlist;
  },

  getCount: function() {
    return _count;
  },

  getNumber: function() {
    return no;
  },

  getPage: function() {
    return page;
  },

  getTerm: function() {
    return term;
  },

  emitChange: function() {
    this.emit(CHANGE_EVENT);
  },

  addChangeListener: function(callback) {
    this.on(CHANGE_EVENT, callback);
  },

  removeChangeListener: function(callback) {
    this.removeListener(CHANGE_EVENT, callback);
  },

  dispatcherIndex: AppDispatcher.register(function(payload) {
    switch(payload.action.type) {
      case 'refreshQotd':
        if (typeof payload.action.no !== 'undefined')
          no = payload.action.no
        if (typeof payload.action.page !== 'undefined')
          page = payload.action.page
        getQotdData(no, page, term);
        break;

      case 'searchQotd':
        // Reset page on each new search
        page = 1;
        if (typeof payload.action.term !== 'undefined')
          term = payload.action.term
        getQotdData(no, page, term);
        break;

      case 'refreshQuest':
        if (typeof payload.action.no !== 'undefined')
          no = payload.action.no
        if (typeof payload.action.page !== 'undefined')
          page = payload.action.page
        getQuestData(no, page, term);
        break;

      case 'searchQuest':
        // Reset page on each new search
        page = 1;
        if (typeof payload.action.term !== 'undefined')
          term = payload.action.term
        getQuestData(no, page, term);
        break;
    }

    // No errors. Needed by promise in Dispatcher.
    return true;
  })
});

module.exports = QStore;
