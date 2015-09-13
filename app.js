var fs           = require('fs')
var express      = require('express')
var bodyParser   = require('body-parser')
var cookieParser = require('cookie-parser')
var exprSession  = require('express-session')
var passport     = require('passport')
var flash        = require('connect-flash')
var app = module.exports = express()

// Set up logger
var Logger = require('pretty-logger')
Logger.setLevel('info')
log = new Logger()

// Read config file
app.data = (JSON.parse(fs.readFileSync('./config.json', 'utf8')))

// List of enabled and available modules
var available_modules = []

// Used theme
var used_theme = null
for (theme in app.data.themes) {
  if (app.data.themes[theme])
    used_theme = theme
}

// Init db connection
var Mongoose = require('mongoose')
var configDB = require('./config/database.js')
Mongoose.connection.on('error', configDB.check)
// Connect to proper db
if (process.env.NODE_ENV == 'production') {
  Mongoose.connect(app.data.mongo_url.prod)
} else if (process.env.NODE_ENV == 'testing'){
  Mongoose.connect(app.data.mongo_url.test)
} else {
  Mongoose.connect(app.data.mongo_url.dev)
}


// Require db schemas
var Settings = require('./config/models/settings')
var Tag      = require('./config/models/tag')
var Badges   = require('./config/models/badges')

// Ensure superuser exists
var User = require('./config/models/user')
// Get first superuser from config dict
root = Object.keys(app.data.superuser)[0]
pass = app.data.superuser[root]
// Add to users collection only if does not already exist
update = {$set: {
  'role'           : 0,
  'local.username' : 'root',
  'local.email'    : root,
  'local.password' : new User().generateHash(pass)
}}
User.update({'local.email': root}, update, {upsert: true}).exec(function() {})
// Enable local login by default
Settings.findOne({'key': 'login-local'}).exec(function (err, num) {
  if (!num) new Settings({
    'key': 'login-local',
    'val': true
  }).save()
})

// Init badges
query = {'name': 'qotd-streak'}
update = {$set: {'levels': [{
  'name'   : 'I',
  'limit'  : 5
}, {
  'name'   : 'II',
  'limit'  : 20
}]}}
Badges.update(query, update, {upsert: true}).exec(function (err) {
  if (err) log.error('Could not init badges.')
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

app.use(express.cookieParser('MySecret'))
app.use(express.cookieSession({
  cookie: {
    maxAge: 1800000 //30 min
  }
}))
app.use(bodyParser.urlencoded({
  extended: true
}))
app.use(flash())
app.use(bodyParser.json())
app.use('/public',  express.static(__dirname + '/public'))
app.use('/modules', express.static(__dirname + '/modules'))
app.use('/themes', express.static(__dirname + '/themes'))
app.use(express.favicon('public/img/favicon.ico'))
app.use(passport.initialize())
app.use(passport.session())


// Localization
var i18n = require('i18n-2')
i18n.expressBind(app, {
  // setup some locales
  locales: ['ro', 'en'],
  // set the default locale
  defaultLocale: 'en',
  // set location
  directory: 'locales',
  extension: '.json',
  // do not automatically resolve unknown strings
  devMode: false
})

// Store available views
// Views in the themes directory have the highest priority and can overwrite
// core or module views
views = ['./themes/' + used_theme, 'views']

// Load middleware
require('./routes/base.js')(app)

// Load enabled modules
for (module in app.data.modules) {
  if (app.data.modules[module]) {
    // Build list of enabled modules
    available_modules.push(module)
    // Load module shema
    require(module + '/model.js')
    // Load module routes
    require(module + '/routes.js')(app)
    // Load module views
    views.push('node_modules/' + module)
  }
}


// Configuring Passport
require('./config/passport')(passport)
// Load authentication routes from external file
require('./auth.js')(app, passport)


// Set app settings
app.set('views', views)
app.set('view engine', 'jade')
app.set('modules', available_modules)
app.set('theme', used_theme)
// Pretty print html rendered with Jade
app.locals.pretty = true

// Launch server
if (process.env.NODE_ENV != 'testing') {
  server = app.listen(process.env.PORT || 4000, function() {
    log.info('Server listening on port 4000')
  })

// Socket.io
var io = require('socket.io').listen(server)
io.sockets.on('connection', function(client) {
  io.sockets.emit('message', { message: 'welcome to the app' })
})
}



// Load core routes
var routes_dir = './routes'
var routes = fs.readdirSync(routes_dir);
for (var i in routes) {
  var route = routes_dir + '/' + routes[i]
  require(route)(app, io)
}


app.use(app.router)
