var Settings = require('../config/models/settings')
var express  = require('express')
var router   = express.Router()


router.get('/login', function (req, res, next) {
  Settings.find({'key': /login-.*/}).exec(gotSettings)

  function gotSettings(err, all) {
    if (err) return next(err)

    // User already authenticated
    if (req.user) return res.redirect('/profile')

    // Use settings to determine which login methods to use
    mysettings = {}
    all.forEach(function(set) {
      mysettings[set.key] = set.val
    })

    res.render('login', {
      'mysettings' : mysettings,
      'error'      : req.flash('error')
    })
  }
})


module.exports = router
