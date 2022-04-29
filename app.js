/*
  app.js -- This creates an Express webserver with login/register/logout authentication
*/

// *********************************************************** //
//  Loading packages to support the server
// *********************************************************** //
// First we load in all of the packages we need for the server...
const createError = require("http-errors"); // to handle the server errors
const express = require("express");
const path = require("path");  // to refer to local paths
const cookieParser = require("cookie-parser"); // to handle cookies
const session = require("express-session"); // to handle sessions using cookies
const debug = require("debug")("personalapp:server"); 
const layouts = require("express-ejs-layouts");
const axios = require("axios")

// *********************************************************** //
//  Loading models
// *********************************************************** //
const Collection = require('./models/Collection')
const Gif = require('./models/Gif')

// *********************************************************** //
//  Connecting to the database
// *********************************************************** //

const mongoose = require( 'mongoose' );
//const mongodb_URI = 'mongodb://localhost:27017/cs103a_todo'
const mongodb_URI = "mongodb+srv://lmayancela:ROnMIKzYRakXDq2S@cpa02.blvhi.mongodb.net/myFirstDatabase?retryWrites=true&w=majority";
//mongodb+srv://cs103a:<password>@cluster0.kgugl.mongodb.net/myFirstDatabase?retryWrites=true&w=majority
//"mongodb+srv://lmayancela:ROnMIKzYRakXDq2S@cpa02.blvhi.mongodb.net/myFirstDatabase?retryWrites=true&w=majority";

mongoose.connect( mongodb_URI, { useNewUrlParser: true, useUnifiedTopology: true } );
// fix deprecation warnings
mongoose.set('useFindAndModify', false); 
mongoose.set('useCreateIndex', true);

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {console.log("we are connected!!!")});

// *********************************************************** //
//  Defining urls and api keys for the Giphy API
// *********************************************************** //

// const api_key = process.env.GIPHY_API_KEY
const api_key = "X3nxNLws75d2nnyTJPE7ARJsz5tSNDbw"
const url = "https://api.giphy.com/v1/gifs/search?api_key=" + api_key

console.log("APIKEY: "+ api_key)


// *********************************************************** //
// Initializing the Express server 
// This code is run once when the app is started and it creates
// a server that respond to requests by sending responses
// *********************************************************** //
const app = express();

// Here we specify that we will be using EJS as our view engine
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");



// this allows us to use page layout for the views 
// so we don't have to repeat the headers and footers on every page ...
// the layout is in views/layout.ejs
app.use(layouts);

// Here we process the requests so they are easy to handle
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Here we specify that static files will be in the public folder
app.use(express.static(path.join(__dirname, "public")));

// Here we enable session handling using cookies
app.use(
  session({
    secret: "zzbbyanana789sdfa8f9ds8f90ds87f8d9s789fds", // this ought to be hidden in process.env.SECRET
    resave: false,
    saveUninitialized: false
  })
);

// *********************************************************** //
//  Defining the routes the Express server will respond to
// *********************************************************** //

// here is the code which handles all /login /signin /logout routes
const auth = require('./routes/auth');
const { deflateSync } = require("zlib");
app.use(auth)

// middleware to test is the user is logged in, and if not, send them to the login page
const isLoggedIn = (req,res,next) => {
  if (res.locals.loggedIn) {
    next()
  }
  else res.redirect('/login')
}

// Will render either the profile or the index depending on whether the user is logged in.
app.get("/", (req, res, next) => {
  if (res.locals.loggedIn) {
    res.redirect("profile")
  } else {
    res.render("index");
  }
});

app.get("/about", (req, res, next) => {
  res.render("about");
});

/* ************************
  Gif searching routes and helper functions
   ************************ */

// Trims the data in the given gif JSON 
function trimData(gif) {
  const trimmedGif = new Object();
  trimmedGif.title = gif.title
  trimmedGif.url = gif.url
  trimmedGif.mp4 = gif.images.original.mp4
  trimmedGif.slug = gif.slug
  return trimmedGif;
}

// Will attempt to store each gif in the database if it doesn't already exist
async function storeGifs(gifs) {
  for (const gif of gifs) {
    const title = gif.title
    const url = gif.url
    const mp4 = gif.mp4
    const slug = gif.slug
    try{
      const lookup = await Gif.find({title, url, mp4, slug})
      if (lookup.length==0){
        const new_gif = new Gif({title, url, mp4, slug})
        await new_gif.save()
        console.log(new_gif)
      }
    } catch(e){
      next(e)
    } 
  }
}

// Makes a request to the giphy API using axios. 
app.post("/gifs/search", (req, res, next) =>{
  const {q,rating} = req.body;

  // The request URL is built here using the previously defined url and given parameters
  const request_url = url + "&q=" + q + "&limit=50&offset=0&rating=" + rating +"&lang=en";

  axios.get(request_url).then(response => {
    gifs = response.data.data;

    // Clean the data to extract relevant fields then save to DB if not already saved
    gifs = gifs.map(gif => trimData(gif));
    storeGifs(gifs);
    res.locals.query = q;
    res.locals.gifs = gifs;
    res.render("giflist");
  }).catch(error => {
    console.log(error);
  })
});

app.use(isLoggedIn)

app.get('/profile',
  async (req,res,next) => {
    try{
      const userId = res.locals.user._id;
      const gifIds = (await Collection.find({userId})).map(x => x.gifId)
      res.locals.gifs = await Gif.find({_id:{$in: gifIds}})
      res.render('profile')
    } catch(e) {
      next(e)
    }
  }
)

/* ************************
  Routes and helpers for adding/deleting gifs to/from collection
   ************************ */

app.get('/collection/add/:gifURL',
  async (req,res,next) => {
    try {
      const gifURL = req.params.gifURL;
      // Lookup the gif record to obtain the gif's ID
      const gif = await Gif.findOne({url:{$regex:gifURL}})
      const gifId = gif._id.toString()
      const userId = res.locals.user._id
      console.log("ID: " + gifId)

      // check to make sure it's not already loaded
      const lookup = await Collection.find({userId,gifId})
      if (lookup.length==0){
        const collection = new Collection({userId,gifId})
        await collection.save()
        console.log(collection)
      }
      res.redirect('/profile')
    } catch(e){
      next(e)
    }
});

app.get('/collection/delete/:gifURL',
  async (req, res, next) => {
    try{
      const gifURL = req.params.gifURL;
      // Lookup the gif record to obtain the gif's ID
      const gif = await Gif.findOne({url:{$regex:gifURL}})
      const gifId = gif._id.toString()
      const userId = res.locals.user._id
      console.log("Deleting Collection with: " + gifId)

      // Delete collection
      await Collection.deleteOne({userId:userId,gifId:gifId});
      res.redirect('/profile')

    } catch(e) {
      next(e)
    }
});

// here we catch 404 errors and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// this processes any errors generated by the previous routes
// notice that the function has four parameters which is how Express indicates it is an error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};
  // render the error page
  res.status(err.status || 500);
  res.render("error");
});


// *********************************************************** //
//  Starting up the server!
// *********************************************************** //
//Here we set the port to use between 1024 and 65535  (2^16-1)
const port = (process.env.PORT || "5000");
app.set("port", port);

// and now we startup the server listening on that port
const http = require("http");
const server = http.createServer(app);

server.listen(process.env.PORT || port);

function onListening() {
  var addr = server.address();
  var bind = typeof addr === "string" ? "pipe " + addr : "port " + addr.port;
  debug("Listening on " + bind);
}

function onError(error) {
  if (error.syscall !== "listen") {
    throw error;
  }

  var bind = typeof port === "string" ? "Pipe " + port : "Port " + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case "EACCES":
      console.error(bind + " requires elevated privileges");
      process.exit(1);
      break;
    case "EADDRINUSE":
      console.error(bind + " is already in use");
      process.exit(1);
      break;
    default:
      throw error;
  }
}

server.on("error", onError);

server.on("listening", onListening);

module.exports = app;
