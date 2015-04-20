var fs           = require('fs')
var express      = require('express')
var mongoose     = require('mongoose')
var bodyParser   = require('body-parser')
var cookieParser = require('cookie-parser')
var exprSession  = require('express-session')
var passport     = require('passport')
var i18n         = require('i18n-2')
var flash        = require('connect-flash')
var app = module.exports = express()

// Read config file
var data = (JSON.parse(fs.readFileSync('./config.json', 'utf8')))

// List of enabled and available modules
var available_modules = []

// Used theme
var used_theme = null
for (theme in data.themes) {
  if (data.themes[theme])
    used_theme = theme
}

// Connect to database
var configDB = require('./config/database.js')
mongoose.connect(configDB.url)


// Require settings schema
var Settings = require('./config/models/settings')

// Ensure superuser exists
var User = require('./config/models/user')
// Get first superuser from config dict
root = Object.keys(data.superuser)[0]
pass = data.superuser[root]
// Add to users collection only if does not already exist
User.findOne({'local.username': root}).exec(function(err, him) {
  if (!him) new User({'local.username': root, 'password': pass}).save()
})


// PATCH to used multiple view directories in express 3.0
// URL: http://stackoverflow.com/questions/11315351/multiple-view-paths-on-node-js-express
function enable_multiple_view_folders() {
    // Monkey-patch express to accept multiple paths for looking up views.
    // this path may change depending on your setup.
    var View = require("./node_modules/express/lib/view"),
        lookup_proxy = View.prototype.lookup;

    View.prototype.lookup = function(viewName) {
        var context, match;
        if (this.root instanceof Array) {
            for (var i = 0; i < this.root.length; i++) {
                context = {root: this.root[i]};
                match = lookup_proxy.call(context, viewName);
                if (match) {
                    return match;
                }
            }
            return null;
        }
        return lookup_proxy.call(this, viewName);
    };
}
enable_multiple_view_folders();



// Localization
i18n.expressBind(app, {
  // setup some locales
  locales: ['ro', 'en'],
  // set the default locale
  defaultLocale: 'en',
  // set the cookie name
  directory: 'locales',
  extension: '.json'
})

// Transfer variables to view
app.use(function(req, res, next) {
  // Save selected role
  if (req.query.role) {
    res.locals.ROLE = req.query.role
  }

  res.locals.URL = req.url.split('?')[0]

  // Set preferred locale
  req.i18n.setLocale('en')

  next()
})


app.use(exprSession({
  cookie: { maxAge: 1800000 }, //30 min
  secret: 'mySecretKey',
  resave: true,
  saveUninitialized: true
}))
app.use(cookieParser())
app.use(bodyParser.urlencoded({
  extended: true
}))
app.use(flash())
app.use(bodyParser.json())
app.use('/public',  express.static(__dirname + '/public'))
app.use('/modules', express.static(__dirname + '/modules'))
app.use(passport.initialize())
app.use(passport.session())


// Configuring Passport
require('./config/passport')(passport)
// Load authentication routes from external file
require('./auth.js')(app, passport)


// Store available views
views = ['views']

// Load enabled modules
for (module in data.modules) {
  if (data.modules[module]) {
    // Build list of enabled modules
    available_modules.push(module)
    // Load module shema
    require(module + '/model.js')
    // Load module routes
    require(module)(app)
    // Load module views
    views.push('node_modules/' + module)
  }
}


// Set app settings
app.set('views', views)
app.set('view engine', 'jade')
app.set('modules', available_modules)
app.set('theme', used_theme)


// Load main routes
views_dir = './routes'
var views = fs.readdirSync(views_dir);
for (i in views) {
  view = views_dir + '/' + views[i]
  require(view)(app)
}


// Base routes
app.get('/', function (req, res, next) {
  User.find().exec(function (err, users) {
    res.render('index', {
      modules: Object.keys(data.modules),
      users:   users
    })
  })
})

app.use(app.router)

// 404 page
app.use(function(req, res, next){
  res.status(404).type('txt').send('Not found')
})


// Launch server
if (process.env.NODE_ENV != 'test') {
  app.listen(process.env.PORT || 4000, function() {
    console.log('Server listening on port 4000.')
  })
}
