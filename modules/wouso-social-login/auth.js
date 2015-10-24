var FacebookStrategy = require('passport-facebook').Strategy
var TwitterStrategy  = require('passport-twitter').Strategy
var GoogleStrategy   = require('passport-google-plus')
var GitHubStrategy   = require('passport-github').Strategy
var util             = require('util')


var DEFAULT_ROUTE = 'http://%s/wouso-social-login/auth/%s/callback'

// Load up core db models
var User = require('../../config/models/user')
var Settings = require('../../config/models/settings')


module.exports = function(app, passport) {
  passport.use(new FacebookStrategy({
    clientID          : app.data.credentials.facebook.clientID,
    clientSecret      : app.data.credentials.facebook.clientSecret,
    callbackURL       : util.format(DEFAULT_ROUTE, app.data.hostname, 'facebook'),
    passReqToCallback : true

  }, function(req, token, refreshToken, profile, done) {
    process.nextTick(function() {
      Settings.find({'key': /login-.*/}, function (err, settings) {
        if (err) return done(null, false, req.flash('error', err))

        User.findOne({'facebook.id': profile.id}, function(err, user) {
          if (err) return done(null, false, req.flash('error', err))

          // Check user privilege and if login is enabled
          settings.forEach(function (set) {
            if (set.key == 'login-level' && user && user.role > set.val)
              return done(null, false, req.flash('error', req.i18n.__('login-level-disabled')))
            if (set.key == 'login-fb' && set.val == 'false')
              return done(null, false, req.flash('error', req.i18n.__('login-fb-disabled')))
          })

          // User is not logged in, but found in db
          if (!req.user && user) {
            user.facebook.token = token
            user.facebook.name  = profile.name.givenName + ' ' + profile.name.familyName
            user.facebook.email = profile.emails[0].value

            user.save(function(err) {
              if (err)
                log.error('Could not login Facebook user.')
            })

          // User is not logged in and not found in db
          } else if (!req.user && !user) {
            user                = new User()
            user.facebook.id    = profile.id
            user.facebook.token = token
            user.facebook.name  = profile.name.givenName + ' ' + profile.name.familyName
            user.facebook.email = profile.emails[0].value

            user.save(function(err) {
              if (err)
                log.error('Could not register new Facebook user.')
            })

          // User is logged in and connected an account
          } else {

            // If that accound was already in db, remove it and add detailes to the new one
            if (user) User.remove({'_id': user._id}).exec()

            user                = req.user
            user.facebook.id    = profile.id
            user.facebook.token = token
            user.facebook.name  = profile.name.givenName + ' ' + profile.name.familyName
            user.facebook.email = profile.emails[0].value

            user.save(function(err) {
              if (err)
                log.error('Could not connect Facebook user.')
            })
          }

          // Return one happy user
          return done(null, user)
        })
      })
    })
  }))


  // TWITTER
  passport.use(new TwitterStrategy({
    consumerKey       : app.data.credentials.twitter.clientID,
    consumerSecret    : app.data.credentials.twitter.clientSecret,
    callbackURL       : util.format(DEFAULT_ROUTE, app.data.hostname, 'twitter'),
    passReqToCallback : true

  }, function(req, token, tokenSecret, profile, done) {
    process.nextTick(function() {
      Settings.find({'key': /login-.*/}, function (err, settings) {
        if (err) return done(null, false, req.flash('error', err))

        User.findOne({'twitter.id': profile.id}, function(err, user) {
          if (err) return done(null, false, req.flash('error', err))

          // Check user privilege and if login is enabled
          settings.forEach(function (set) {
            if (set.key == 'login-level' && user && user.role > set.val)
              return done(null, false, req.flash('error', req.i18n.__('login-level-disabled')))
            if (set.key == 'login-tw' && set.val == 'false')
              return done(null, false, req.flash('error', req.i18n.__('login-tw-disabled')))
          })

          // User is not logged in, but found in db
          if (!req.user && user) {
            user.twitter.token       = token
            user.twitter.username    = profile.username
            user.twitter.displayName = profile.displayName

            user.save(function(err) {
              if (err)
                log.error('Could not login Twitter user.')
            })

          // User is not logged in and not found in db
          } else if (!req.user && !user) {
            user                     = new User()
            user.twitter.id          = profile.id
            user.twitter.token       = token
            user.twitter.username    = profile.username
            user.twitter.displayName = profile.displayName

            user.save(function(err) {
              if (err)
                log.error('Could not register new Twitter user.')
            })

          // User is logged in and connected an account
          } else {

            // If that accound was already in db, remove it and add detailes to the new one
            if (user) User.remove({'_id': user._id}).exec()

            user                     = req.user
            user.twitter.id          = profile.id
            user.twitter.token       = token
            user.twitter.username    = profile.username
            user.twitter.displayName = profile.displayName

            user.save(function(err) {
              if (err)
                log.error('Could not connect Twitter user.')
            })
          }

          // Return one happy user
          return done(null, user)
        })
      })
    })
  }))


  // GOOGLE
  passport.use(new GoogleStrategy({
    clientId          : app.data.credentials.google.clientID,
    clientSecret      : app.data.credentials.google.clientSecret,
    callbackURL       : util.format(DEFAULT_ROUTE, app.data.hostname, 'google'),
    passReqToCallback : true

  }, function(req, tokens, profile, done) {
    process.nextTick(function() {
      Settings.find({'key': /login-.*/}, function (err, settings) {
        if (err) return done(null, false, req.flash('error', err))

        User.findOne({'google.id': profile.id}, function(err, user) {
          if (err) return done(null, false, req.flash('error', err))

          // Check user privilege and if login is enabled
          settings.forEach(function (set) {
            if (set.key == 'login-level' && user && user.role > set.val)
              return done(null, false, req.flash('error', req.i18n.__('login-level-disabled')))
            if (set.key == 'login-gp' && set.val == 'false')
              return done(null, false, req.flash('error', req.i18n.__('login-gp-disabled')))
          })

          // User is not logged in, but found in db
          if (!req.user && user) {
            user.google.token  = tokens.access_token
            user.google.name   = profile.displayName
            user.google.email  = profile.email
            user.google.avatar = profile.image.url.split('?')[0]

            user.save(function(err) {
              if (err)
                log.error('Could not login Google user.')
            })

          // User is not logged in and not found in db
          } else if (!req.user && !user) {
            user               = new User()
            user.google.id     = profile.id
            user.google.token  = tokens.access_token
            user.google.name   = profile.displayName
            user.google.email  = profile.email
            user.google.avatar = profile.image.url.split('?')[0]

            user.save(function(err) {
              if (err)
                log.error('Could not register new Google user.')
            })

          // User is logged in and connected an account
          } else {

            // If that accound was already in db, remove it and add detailes to the new one
            if (user) User.remove({'_id': user._id}).exec()

            user               = req.user
            user.google.id     = profile.id
            user.google.token  = tokens.access_token
            user.google.name   = profile.displayName
            user.google.email  = profile.email
            user.google.avatar = profile.image.url.split('?')[0]

            user.save(function(err) {
              if (err)
                log.error('Could not connect Google user.')
            })
          }

          // Return one happy user
          return done(null, user)
        })
      })
    })
  }))


  // GITHUB
  passport.use(new GitHubStrategy({
    clientID          : app.data.credentials.github.clientID,
    clientSecret      : app.data.credentials.github.clientSecret,
    callbackURL       : util.format(DEFAULT_ROUTE, app.data.hostname, 'github'),
    passReqToCallback : true

  }, function(req, token, refreshToken, profile, done) {
    process.nextTick(function() {
      Settings.find({'key': /login-.*/}, function (err, settings) {
        if (err) return done(null, false, req.flash('error', err))

        User.findOne({'github.id': profile.id}, function(err, user) {
          if (err) return done(null, false, req.flash('error', err))

          // Check user privilege and if login is enabled
          settings.forEach(function (set) {
            if (set.key == 'login-level' && user && user.role > set.val)
              return done(null, false, req.flash('error', req.i18n.__('login-level-disabled')))
            if (set.key == 'login-gh' && set.val == 'false')
              return done(null, false, req.flash('error', req.i18n.__('login-gh-disabled')))
          })

          // User is not logged in, but found in db
          if (!req.user && user) {
            user.github.id          = profile.id
            user.github.token       = token
            user.github.username    = profile.username
            user.github.name        = profile.displayName
            user.github.email       = profile.emails[0].value

            user.save(function(err) {
              if (err)
                log.error('Could not login GitHub user.')
            })

          // User is not logged in and not found in db
          } else if (!req.user && !user) {
            user                    = new User()
            user.github.id          = profile.id
            user.github.token       = token
            user.github.username    = profile.username
            user.github.name        = profile.displayName
            user.github.email       = profile.emails[0].value

            user.save(function(err) {
              if (err)
                log.error('Could not register new GitHub user.')
            })

          // User is logged in and connected an account
          } else {

            // If that accound was already in db, remove it and add detailes to the new one
            if (user) User.remove({'_id': user._id}).exec()

            user                    = req.user
            user.github.id          = profile.id
            user.github.token       = token
            user.github.username    = profile.username
            user.github.name        = profile.displayName
            user.github.email       = profile.emails[0].value

            user.save(function(err) {
              if (err)
                log.error('Could not connect GitHub user.')
            })
          }

          // Return one happy user
          return done(null, user)
        })
      })
    })
  }))
}
