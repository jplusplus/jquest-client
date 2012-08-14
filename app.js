  // Express Framework
var express        = require('express')
  // Filesystem manager
  , fs             = require('fs')
  // Data ORM
  , Sequelize      = require('sequelize')  
  // Locales manager
  , i18n           = require("i18n")
  // Less middle ware
  , lessMiddleware = require("less-middleware")
  // Environement configuration
  , config         = require("config")
  // Authentification module
  , passport       = require("passport");
  // Stop watching for file changes
  config.watchForConfigFileChanges(0);

/**
 * Global objects
 */
var app = sequelize = null;


/**
* @author Pirhoo
*
* @function
* @description Loads all requires automaticly from a directory
*/
function loadAllRequires(dirname, where) {  
  // Change the root of the directory to analyse following the given parameter
  var dir = dirname || __dirname;
  // Var to record the require
  where = typeof(where) === "object" ? where : {};    
  
  // Grab a list of our route files/directories
  fs.readdirSync(dir).forEach(function(name){
    
    // Find the file path
    var path = dir + '/' + name
    // Query the entry
     , stats = fs.lstatSync(path)
    // Name simplitfy
     , slug  = name.replace(/(\.js)/, "");

    // If it's a directory...
    if( stats.isDirectory() ) {
      // Recursive calling
      loadAllRequires(path);      
    // If it's a regular file...
    }else {      
      // Require the route file with app and sequelize variables
      where[slug] = require(path)(app, sequelize);    
    }
  });
}



/**
* @author Pirhoo
*
* @function
* @description Loads all models automaticly from the /models directory
*/
function importAllModels(dirname, where) {  
  // Change the root of the directory to analyse following the given parameter
  var dir = dirname || __dirname + "/models";   
  // Var to record the require
  where = typeof(where) === "object" ? where : {};     
  
  // Grab a list of our route files/directories
  fs.readdirSync(dir).forEach(function(name){
    
    // Find the file path
    var path = dir + '/' + name
    // Query the entry
     , stats = fs.lstatSync(path);

    // If it's a directory...
    if( stats.isDirectory() ) {
      // Recursive calling
      loadAllRequires(path);      
    // If it's a regular file...
    }else {
      // Imports the file to an array and a simplified name            
      where[ name.replace(/(\.js)/, "") ] = sequelize.import(path);    
    }
  });
}

/**
* @author Pirhoo
*
* @function
* @description Parse the DNS url to extract fields
*/
function getDbConfigFromURL(url) {
  
  var regex  =  /(\w*)\:\/\/(([a-zA-Z0-9_\-.]*)\:([a-zA-Z0-9_\-.]*))?@([a-zA-Z0-9_\-.]*)(\:(\d+))?\/([a-zA-Z0-9_\-.]*)/
  ,   fields = [undefined, "dialect", "auth", "username", "password", "host", undefined, "port", "database"]
  ,   match  = url.match(regex)
  ,   conf   = {};
  
  // Puts every match in the right field
  for(var index in fields) {
    
    var fieldName = fields[index];
    // If the current field index matches to something
    if( fieldName && match[index] ) {
      conf[fieldName] = match[index];
    }
  }
  
  // Return the configuration
  return conf;
}



/**
* @author Pirhoo
*
* @function
* @description
*/
exports.boot = function(){

  // Creates Express server
  app = module.exports = express();   
  
  // Configuration
  app.configure(function(){
    
    app.set('views', __dirname + '/views');
    app.set('view engine', 'jade');

    // add the config object to the app to be accessible in the sub modules
    app.config = config;
    
    
    /************************************
     * Client requests
     ************************************/  
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(express.cookieParser('L7mdcS4k5JzIepqwTaVdTGp4uZi4iIYF0ht2bkET'));
    app.use(express.session());   

    // Authentification with passport
    app.use(passport.initialize());
    app.use(passport.session());  

    // Passport session setup.
    // To support persistent login sessions, Passport needs to be able to
    // serialize users into and deserialize users out of the session. Typically,
    // this will be as simple as storing the user ID when serializing, and finding
    // the user by ID when deserializing. However, since this example does not
    // have a database of user records, the complete Twitter profile is serialized
    // and deserialized.
    passport.serializeUser(function(user, done) {
      done(null, user.id);
    });

    passport.deserializeUser(function(obj, done) {      
      app.models.User.find(obj).complete(done);
    });



    // Less middle ware to auto-compile less files
    app.use(lessMiddleware({
      src: __dirname + '/public',
      // Compress the files
      compress: true
    }));

    // Public directory
    app.use(express.static(__dirname + '/public'));


    /************************************
     * Configure router      
     ************************************/   

    // Temporary solution to avoid a bug on config module
    var arr = [];
    // The config module convert the array to object for a curious reason
    for(var ln in config.locale.available) {
      arr.push( config.locale.available[ln] );
    }

    // So we convert it and set the new values
    config.locale.available = arr;  

    // using 'accept-language' header to guess language settings
    app.use(i18n.init);

    i18n.configure({
      // setup some locales
      locales  : config.locale.available
      // allow the use of a cookie to define the language
      , cookie : "language"
    });



    /************************************
     * Views helpers
     ************************************/   
    // Register helpers for use in view's
    app.locals({    
      // Configuration variables
      config: config,
      getLanguageName: function(lang) {
        return {
          "fr": i18n.__("French"),
          "en": i18n.__("English")
        }[lang.toLowerCase()] || lang;
      },
        // Language helpers
      _ : i18n.__,
      _n: i18n.__n
    });

    app.use(function(req, res, next) {
      // Current user
      res.locals.user         = req.user;
      // Current language
      res.locals.language     = req.cookies.language || i18n.getLocale(req) || config.locale.default;  
      // Current user    
      res.locals.currentUser  = req.session.currentUser || false;
      next();
    });


    /************************************
     * Configure router      
     ************************************/   
    // @warning Needs to be after the helpers
    app.use(app.router);

  });


  app.configure('development', function(){
    app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
  });

  app.configure('production', function(){
    app.use( express.errorHandler() );
  });


  /************************************
   * Database synchronisation
   ************************************/    
  // Database configuration
  var dbConfig = getDbConfigFromURL(process.env.DATABASE_URL || config.db.uri);  
  // Database instance 
  sequelize = new Sequelize(dbConfig.database, dbConfig.username, dbConfig.password, dbConfig);     
  // Sync the database with the object models
  sequelize.sync({force: false});


  /************************************
   * Models and views encapsulation
   ************************************/  
  // all models and controller on this scope
  app.controllers = app.models = {};
  // Import all models from the /models directory
  // @warning Needs the Sequelize database instanced before 
  importAllModels(__dirname + "/models", app.models);
  // Load all controllers from the /controllers directory
  loadAllRequires(__dirname + "/controllers", app.controllers);

  return app;

};


/************************************
 * Creates the app and listen on
 * the default port.
 ************************************/  
exports.boot().listen(process.env.PORT || config.port, function(){
  console.log("Express server listening on port %d in %s mode", this.address().port, app.settings.env);
});
