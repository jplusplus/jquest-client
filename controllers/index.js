/**
 * @author Pirhoo
 * @description Home route binder
 *
 */
module.exports = function(app, db, controllers) {

	/*
	 * GET home page.
	 */
	app.get('/', function(req, res){

	  res.render('index.jade', 
			{ 
				title: 'jQuest', 
				stylesheets: [
					"/stylesheets/vendor/bootstrap-build/bootstrap.min.css",
					"/stylesheets/vendor/bootstrap-build/bootstrap-responsive.min.css",
					"http://fonts.googleapis.com/css?family=Share:400,700",
					"/stylesheets/style.less"
				], 
				javascripts: [
					"/javascripts/vendor/bootstrap/bootstrap.min.js"								
				]
			}
		);
	});

};