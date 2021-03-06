var mongoose = require('mongoose');
var express  = require('express');
var util     = require('util');

var qotd     = mongoose.model('Qotd');
var QOption  = mongoose.model('QOption');
var settings = mongoose.model('Settings');
var Tag      = mongoose.model('Tag');
var Event    = mongoose.model('Event');
var Badges   = mongoose.model('Badge');
var User     = mongoose.model('User');

var login    = require('../../core/login');
var log      = require('../../core/logging')('wouso-qotd');
var router   = express.Router();


/*
* ENDPOINT: /wouso-qotd
*
* DESCRIPTION: Serves main qotd page
*
*/
router.get('/wouso-qotd', function (req, res, next) {
  var _self = {};
  qotd.find().exec(gotQuestions);

  function gotQuestions(err, all) {
    if (err) return next(err);

    _self.questions = all;
    Tag.find({'type': 'wouso-qotd'}).exec(gotTags);
  }

  function gotTags(err, tags) {
    if (err) return next(err);

    _self.qtags = tags;
    settings.find().exec(gotSettings);
  }

  function gotSettings(err, settings) {
    if (err) return next(err);

    var mysettings = {};
    settings.forEach(function(option) {
      mysettings[option.key] = option.val;
    });

    res.render('wouso-qotd', {
      'questions'  : _self.questions,
      'mysettings' : mysettings,
      'qtags'      : _self.qtags,
      'user'       : req.user
    });
  }
});

/*
* ENDPOINT: /api/wouso-qotd/settings
*
* DESCRIPTION: Saves settings for qotd
*
* REDIRECT: /wouso-qotd
*
* TODO: Remove final redirect so it can be a proper API endpoint
*/
router.post('/api/wouso-qotd/settings', login.isAdmin, function (req, res) {
  for (var key in req.body) {
    var query = {'key': 'qotd-' + key};
    var update = {$set: {'val': req.body[key]}};
    settings.update(query, update, {upsert: true}).exec();
  }

  return res.redirect('/wouso-qotd');
});

/*
* ENDPOINT: /api/wouso-qotd/list
*
* DESCRIPTION: Lists one qotd by ID, including tags
*
* OUTPUT: one qotd
*
* PARAMS:
*     id (required): question _id to look for
*/
router.get('/api/wouso-qotd/list', login.isContributor, function (req, res) {
  if (!req.query.id) return res.send({});

  var _self = {};
  qotd.findOne({_id: req.query.id}).exec(gotQotd);

  function gotQotd(err, qotd) {
    _self.qotd = qotd;
    Tag.find({'type': 'wouso-qotd'}).exec(gotTags);
  }

  function gotTags(err, tags) {
    // Replace tag ids with tag names
    tags.forEach(function(tag) {
      var i = _self.qotd.tags.indexOf(tag._id);
      if (i > -1) {
        _self.qotd.tags[i] = tag.name;
      }
    })
    res.send(_self.qotd);
  }
});

/*
* ENDPOINT: /api/wouso-qotd/list/:perPage/:page
*
* DESCRIPTION: Paginated lists of 'qotd's
*
* OUTPUT: List of qotd, including tags
*
* PARAMS:
*     id: question _id to look for
*     tags: list of tags to filter results by
*     search: term to filter results by
*     start: date marking the beginning of the time interval to search within
*     end: date marking the ending of the time interval to search within
*/
router.get('/api/wouso-qotd/list/:perPage/:page', login.isContributor, function (req, res, next) {
  var _self = {};
  var show = parseInt(req.params.perPage);
  var skip = (req.params.page - 1) * show;

  // Handle query params
  var query = {};
  if (req.query.id) {
    query['_id'] = req.query.id;
  }
  if (req.query.tags) {
    query['tags'] = {$in: req.query.tags.split(',')};
  }
  if (typeof req.query.search !== 'undefined') {
    query['question'] = { '$regex': req.query.search, '$options': 'i' };
  }
  if (typeof req.query.start !== 'undefined') {
    var start = new Date(req.query.start);
    var end   = new Date();
    // Use provided end date
    if (typeof req.query.end !== 'undefined') {
      end = new Date(req.query.end);
    }
    // Build date query
    query['date'] = { '$gt': start, '$lt': end };
  }

  // Get 'qotd's
  _self.query = query;
  qotd.find(query).skip(skip).limit(show).exec(getTags);

  function getTags(err, all) {
    if (err) return next(err)

    _self.questions = all;
    Tag.find({'type': 'wouso-qotd'}).exec(useTags);
  }

  function useTags(err, tags) {
    // Replace tag ids with tag names
    _self.questions.forEach(function(q) {
      tags.forEach(function(tag) {
        var i = q.tags.indexOf(tag._id);
        if (i > -1) {
          q.tags[i] = tag.name;
        }
      })
    })
    // Get total count
    qotd.count(_self.query).exec(sendResponse);
  }

  function sendResponse(err, count) {
    res.send({
      questions : _self.questions,
      count     : count
    });
  }
});

/*
* ENDPOINT: /api/wouso-qotd/list/dates
*
* DESCRIPTION: Qotd dates list
*
* OUTPUT: List of qotd dates
*
*/
router.get('/api/wouso-qotd/list/dates', login.isContributor, function (req, res, next) {
  qotd.find().select({'date': 1, '_id': 0}).exec(filterAvailableDates);

  function filterAvailableDates(err, dates) {
    if (err) return next(err);

    var dates_list = [];
    dates.forEach(function(qotd) {
      if (qotd.date) {
        dates_list.push(qotd.date.toISOString());
      }
    });
    res.send(dates_list);
  }
});

/*
* ENDPOINT: GET /api/wouso-qotd/play
*
* DESCRIPTION: Qotd Game
*
* OUTPUT: One qotd; includes response if user already answered
*
*/
router.get('/api/wouso-qotd/play', login.isUser, function (req, res, next) {

  var start = new Date().setHours(0,0,0,0);
  var end   = new Date().setHours(23,59,59,999);
  var query = {'date': {$gte: start, $lt: end}};

  qotd.find(query).exec(function (err, today) {
    // No question for today, send empty response
    if (!today.length) return res.send({});

    var sent = false;
    today.forEach(function (question) {
      // Convert result from mongoose object to JSON
      question = question.toJSON();

      // Check if user already saw a question and deliver the same one
      question.answers.forEach(function (ans) {
        if (ans.user == req.user._id.toString()) {
          sent = true;

          // Compute remaining time
          var diff = Math.abs(Date.now() - ans.date);
          var mins = Math.ceil(diff / (1000 * 60));
          question['diff'] = diff;

          if (ans.res != null) {
            // Provide answer contains response
            question['answer'] = [];
            question.choices.forEach(function(ans) {
              if (ans.val == true) question['answer'].push(ans.text);
            });
          }

          return res.send(shuffleAnswers(question));
        }
      });
    });

    if (!sent && today.length) {
      // Else, choose a random question from today's poll
      var rand = Math.floor(Math.random() * today.length);
      // Deep copy selected qotd
      var question = JSON.parse(JSON.stringify(today[rand]));

      // Update question viewer
      var query  = {'_id': question._id};
      var update = {$push: {'answers': {
        'user' : req.user._id,
        'date' : Date.now(),
        'res'  : null
      }}};
      qotd.update(query, update).exec(function(err) {
        if (err) return next(err);
      });

      return res.send(shuffleAnswers(question));
    }
  });

  function shuffleAnswers(question) {
    // Process question answers
    var answers = [];
    question.choices.forEach(function(ans) {
      answers.push(ans.text);
    });

    // Shuffle answers
    question.options = answers.sort(function() { return 0.5 - Math.random() });
    return question;
  }
});


/*
* ENDPOINT: POST /api/wouso-qotd/play
*
* DESCRIPTION: Qotd Game Response
*
* REDIRECT: /wouso-qotd
*
*/
router.post('/api/wouso-qotd/play', login.isUser, function (req, res, next) {
  var ObjectId = mongoose.Types.ObjectId;

  var query = {'_id': new ObjectId(req.body.question_id)};
  qotd.findOne(query).exec(gotQuestion);

  function gotQuestion(err, question) {
    if (err) return next(err)

    var update = {};
    var right = 0;
    var wrong = 0;
    var rightCount = 0;

    question.answers.forEach(function (ans) {
      if (ans.user == req.user._id.toString() && ans.res == null) {
        // User did not answer yet, check his answers
        var given_answers = [];

        if (req.body.ans) {
          question.choices.forEach(function(ans) {
            if (ans.val == true) rightCount++;

            var found = 0;
            // Convert single answer to array
            if (typeof req.body.ans === 'string') {
              req.body.ans = req.body.ans.split();
            }
            // Count right/wrong answers
            req.body.ans.forEach(function (response) {
              if (ans.text == response) {
                given_answers.push(ans);
                found++;
                right++;
              }
            });

            if (!found) wrong++;
          })
        }

        // Save user response
        query = {
          '_id'          : new ObjectId(req.body.question_id),
          'answers.user' : req.user._id
        };
        update = {$set: {'answers.$.res': given_answers}};
        qotd.update(query, update).exec(function (err) {
          if (err) log.error('Could not save response from user');
        })

        // Reward user if necessary
        if (right) {
          // Update qotd-streak for correct answer
          update_badges(req, right, rightCount);
          // Update user points
          update_points(req, right, rightCount);
        }
      }
    })
    return res.redirect('/wouso-qotd');
  }
})


/*
* ENDPOINT: POST /api/wouso-qotd/add
*
* DESCRIPTION: Add Qotd
*
* REDIRECT: /wouso-qotd
*
*/
router.post('/api/wouso-qotd/add', login.isContributor, function (req, res, next) {

  var options = [];
  for (var i in req.body.answer) {
    var validity = false;
    // Ignore empty answers
    if (req.body.answer[i] != '') {
      if (req.body.valid[i] == 'true') validity = true;

      options.push(new QOption({
        'text' : req.body.answer[i],
        'val'  : validity
      }))
    }
  }

  // Format received date
  if (req.body.date) {
    var formatted_date = util.format('%d.%d.%d',
      req.body.date.split('/')[1],
      req.body.date.split('/')[0],
      req.body.date.split('/')[2]
    );
  } else {
    formatted_date = null;
  }

  // Get tags
  var tags = req.body.tags.split(' ')
  Tag.find({'name': {$in: tags}, 'type': 'wouso-qotd'}).exec(gotTags)

  function gotTags(err, all) {
    var tag_ids = []
    all.forEach(function(tag) {
      // Increment tag count
      Tag.update({'_id': tag._id}, {$inc: {'count': 1}}).exec(function (err) {
        if (err) return next(err)
      })

      // Save to list
      tag_ids.push(tag._id)
    })

    var new_qotd = {
      'question'  : req.body.question,
      'choices'   : options,
      'date'      : formatted_date,
      'tags'      : tag_ids
    }

    // If id is provided, we are in edit mode; else we create a new object
    if (req.body.id) {
      qotd.update({'_id': req.body.id}, new_qotd, {upsert: true}).exec(qotdSaved)
    } else {
      new qotd(new_qotd).save(qotdSaved)
    }
  }

  function qotdSaved(err) {
    if (err) return next(err)
    res.redirect('/wouso-qotd')
  }
});


/*
* ENDPOINT: DELETE /api/wouso-qotd/delete
*
* DESCRIPTION: Delete Qotd
*
* OUTPUT:
*   OK - qotd sucessfully removed
*   NOK - failed to remove qotd
*
*/
router.delete('/api/wouso-qotd/delete', login.isContributor, function (req, res) {
  if (!req.query.id) return res.send('NOK');

  var del_list = req.query.id.split(',');
  qotd.remove({'_id': {$in: del_list}}).exec(removedQotd);

  function removedQotd(err) {
    if (err) {
      log.error('Could not remove qotd: ' + del_list);
      return res.send('NOK');
    } else {
      log.info('Removed qotd: ' + del_list);
      del_list.forEach(function (element_id) {
        new Event({
          game    : 'qotd',
          who     : req.user._id,
          action  : 'remove',
          what    : element_id
        }).save(savedEvent)
      });

      return res.send('OK');
    }
  }

  function savedEvent(err) {
    if (err) log.error('Could not save qotd remove event')
  }
});


/*
* ENDPOINT: GET /api/wouso-qotd/events
*
* DESCRIPTION: Get Qotd Events
*
* OUTPUT: Events list
*
*/
router.get('/api/wouso-qotd/events', login.isContributor, function (req, res) {

  Event.find({'game': 'qotd'}).exec(gotEvents);

  function gotEvents(err, events) {
    if (err) {
      log.error('Could not get qotd events');
    }

    res.send(events);
  }
});


// Utils
function update_badges(req, right, rightCount) {
  if (right != rightCount) return

  var query = {
    'name'           : 'qotd-streak',
    'history.userId' : req.user._id
  }
  Badges.findOne(query).exec(function(err, user) {
    if (!user) {
      // Init user to badge db
      var query = {'name': 'qotd-streak'}
      var update = {$push: {'history': {
        'userId'      : req.user._id,
        'count'       : 1,
        'lastUpdate'  : Date.now(),
        'data'        : ''
      }}}
      Badges.update(query, update, {upsert: true}).exec(function (err) {
        if (err) log.error('Could not init badge')
      })
    } else {
      // Increment badge count
      query = {'name': 'qotd-streak', 'history.userId': req.user._id}
      update = {$inc: {'history.$.count': 1}}
      Badges.update(query, update, {upsert: true}).exec(function (err) {
        if (err) log.error('Could not increment badge count')
      })
    }
  })
}

function update_points(req, right, rightCount) {
  // Get points for qotd
  settings.findOne({'key': 'qotd-points'}).exec(gotPoints);

  function gotPoints(err, points) {
    // Update user points
    points = points.val / rightCount * right;
    var query  = {'_id': req.user._id};
    var update = {$inc: {'points': points}};

    User.update(query, update).exec(updatedPoints);
  }

  function updatedPoints(err) {
    if (err) log.error('Could not update points');
  }
}


module.exports = router;
