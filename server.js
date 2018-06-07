// Dependencies
var express = require("express");
var bodyParser = require("body-parser");
var logger = require("morgan");
var mongoose = require("mongoose");
var path = require("path");

// Requiring Comment and Article models
var Comment = require("./models/Comment.js");
var Article = require("./models/Article.js");

// Scraping tools
var request = require("request");
var cheerio = require("cheerio");

// Set mongoose to leverage built in JavaScript ES6 Promises
mongoose.Promise = Promise;

//Define port
var PORT = process.env.PORT || 3000

// Initialize Express
var app = express();

// Use morgan and body parser with our app
app.use(logger("dev"));
app.use(bodyParser.urlencoded({
    extended: false
}));

// Make public a static dir
app.use(express.static("public"));

// Set Handlebars.
var exphbs = require("express-handlebars");

app.engine("handlebars", exphbs({
    defaultLayout: "main"
}));
app.set("view engine", "handlebars");

// Connect to the Mongo DB
// If deployed, use the deployed database. Otherwise use the local mongoHeadlines database
var MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost/mongo-scraper";

// Set mongoose to leverage built in JavaScript ES6 Promises
// Connect to the Mongo DB
mongoose.Promise = Promise;
mongoose.connect(MONGODB_URI);

var db = mongoose.connection;

// Routes

//home page
app.get("/", function (req, res) {
    // Query MongoDB for all article entries (sort newest to top, assuming Ids increment)
  Article.find().sort({_id: -1})

  // But also populate all of the comments associated with the articles.
  .populate('comments')

  // Then, send them to the handlebars template to be rendered
  .exec(function(err, doc){
    // log any errors
    if (err){
      console.log(err);
    } 
    // or send the doc to the browser as a json object
    else {
      var hbsObject = {article: doc}
      res.render('index', hbsObject);
      
    }
  });

});
app.get("/article/:id", function (req, res) {
    Article.find({ "_id": req.params.id }).populate("comments").exec(function (err, data) {
        console.log("this is from the get"+ JSON.stringify(data))
        var hbsObject = {
            article: data
        }

        res.render("individual", hbsObject)
    })
});

app.get("/scrape", function (req, res) {
    //Drops previous collection to get fresh articles
    db.collections['articles'].drop(function (err) {
        console.log('collection dropped');
    });
    // First, we grab the body of the html with request
    request("https://www.nytimes.com/", function (error, response, html) {
        // Then, we load that into cheerio and save it to $ for a shorthand selector
        var $ = cheerio.load(html);
        // Now, we grab every h2 within an article tag, and do the following:
        $("article").each(function (i, element) {

            // Save an empty result object
            var result = {};

            // Add the title and summary of every link, and save them as properties of the result object
            result.title = $(this).children("h2").text();
            result.summary = $(this).children(".summary").text();
            result.link = $(this).children("h2").children("a").attr("href");

            // Using our Article model, create a new entry
            var entry = new Article(result);

            // Now, save that entry to the db
            entry.save(function (err, doc) {
                // Log any errors
                if (err) {
                    console.log(err);
                }
            });
            
        });        
        
    });
   
});

app.post("/comment/:id", function (req, res) {
    var id = req.params.id;
    var information = {
        author: req.body.author,
        content: req.body.body,
    }
    console.log(information)
    //Use Comment model, create a new entry
    var entry = new Comment(information)
    // Now, save that entry to the db
    entry.save(function (err, doc) {
        // Log any errors
        if (err) {
            // console.log(err);
        }
        // Or log the doc
        else {
            Article.findOneAndUpdate({ "_id": req.params.id }, { $push: { "comments": doc._id } }, { new: true})
                .exec(function (err, doc) {
                    if (err) {
                    
                    } else {
                        
                        res.sendStatus(200);
                    }
                });

        }
    });
});

// Delete a Comment Route
app.post('/remove/comment/:id', function (req, res){

    // Collect comment id
    var commentId = req.params.id;
  
    // Find and Delete the Comment using the Id
    Comment.findByIdAndRemove(commentId, function (err, todo) {  
      
      if (err) {
        console.log(err);
      } 
      else {
        // Send Success Header
        res.sendStatus(200);
      }
  
    });
  
  });



// Start the server
app.listen(PORT, function () {
    console.log("App running on port " + PORT + "!");
});