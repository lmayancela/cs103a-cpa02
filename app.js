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
const Course = require('./models/Course')
const Schedule = require('./models/Schedule')
const Collection = require('./models/Collection')
const Gif = require('./models/Gif')

// *********************************************************** //
//  Loading JSON datasets
// *********************************************************** //
const courses = require('./public/data/courses20-21.json')

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
    res.render("profile")
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
  return trimmedGif;
}

// Will attempt to store each gif in the database if it doesn't already exist
async function storeGifs(gifs) {
  for (const gif of gifs) {
    const title = gif.title
    const url = gif.url
    const mp4 = gif.mp4
    try{
      const lookup = await Gif.find({title, url, mp4})
      if (lookup.length==0){
        const new_gif = new Gif({title, url, mp4})
        await new_gif.save()
        console.log(gif)
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

/* ************************
  Functions needed for the course finder routes
   ************************ */

function getNum(coursenum){
  // separate out a coursenum 103A into 
  // a num: 103 and a suffix: A
  i=0;
  while (i<coursenum.length && '0'<=coursenum[i] && coursenum[i]<='9'){
    i=i+1;
  }
  return coursenum.slice(0,i);
}


function times2str(times){
  // convert a course.times object into a list of strings
  // e.g ["Lecture:Mon,Wed 10:00-10:50","Recitation: Thu 5:00-6:30"]
  if (!times || times.length==0){
    return ["not scheduled"]
  } else {
    return times.map(x => time2str(x))
  }
  
}
function min2HourMin(m){
  // converts minutes since midnight into a time string, e.g.
  // 605 ==> "10:05"  as 10:00 is 60*10=600 minutes after midnight
  const hour = Math.floor(m/60);
  const min = m%60;
  if (min<10){
    return `${hour}:0${min}`;
  }else{
    return `${hour}:${min}`;
  }
}

function time2str(time){
  // creates a Times string for a lecture or recitation, e.g. 
  //     "Recitation: Thu 5:00-6:30"
  const start = time.start
  const end = time.end
  const days = time.days
  const meetingType = time['type'] || "Lecture"
  const location = time['building'] || ""

  return `${meetingType}: ${days.join(",")}: ${min2HourMin(start)}-${min2HourMin(end)} ${location}`
}

/* ************************
  Loading (or reloading) the data into a collection
   ************************ */
// this route loads in the courses into the Course collection
// or updates the courses if it is not a new collection

app.get('/upsertDB',
  async (req,res,next) => {
    //await Course.deleteMany({})
    for (course of courses){
      const {subject,coursenum,section,term}=course;
      const num = getNum(coursenum);
      course.num=num
      course.suffix = coursenum.slice(num.length)
      await Course.findOneAndUpdate({subject,coursenum,section,term},course,{upsert:true})
    }
    const num = await Course.find({}).count();
    res.send("data uploaded: "+num)
  }
)


app.post('/courses/bySubject',
  // show list of courses in a given subject
  async (req,res,next) => {
    const {subject} = req.body;
    const courses = await Course.find({subject:subject,independent_study:false}).sort({term:1,num:1,section:1})
    
    res.locals.courses = courses
    res.locals.times2str = times2str
    //res.json(courses)
    res.render('courselist')
  }
)

app.get('/courses/show/:courseId',
  // show all info about a course given its courseid
  async (req,res,next) => {
    const {courseId} = req.params;
    const course = await Course.findOne({_id:courseId})
    res.locals.course = course
    res.locals.times2str = times2str
    //res.json(course)
    res.render('course')
  }
)

app.get('/courses/byInst/:email',
  // show a list of all courses taught by a given faculty
  async (req,res,next) => {
    const email = req.params.email+"@brandeis.edu";
    const courses = await Course.find({instructor:email,independent_study:false})
    //res.json(courses)
    res.locals.courses = courses
    res.render('courselist')
  } 
)

app.post('/courses/byInst',
  // show courses taught by a faculty send from a form
  async (req,res,next) => {
    const email = req.body.email+"@brandeis.edu";
    const courses = 
       await Course
               .find({instructor:email,independent_study:false})
               .sort({term:1,num:1,section:1})
    //res.json(courses)
    res.locals.courses = courses
    res.locals.times2str = times2str
    res.render('courselist')
  }
)

app.use(isLoggedIn)

app.get('/addCourse/:courseId',
  // add a course to the user's schedule
  async (req,res,next) => {
    try {
      const courseId = req.params.courseId
      const userId = res.locals.user._id
      // check to make sure it's not already loaded
      const lookup = await Schedule.find({courseId,userId})
      if (lookup.length==0){
        const schedule = new Schedule({courseId,userId})
        await schedule.save()
      }
      res.redirect('/schedule/show')
    } catch(e){
      next(e)
    }
  })

app.get('/schedule/show',
  // show the current user's schedule
  async (req,res,next) => {
    try{
      const userId = res.locals.user._id;
      const courseIds = 
         (await Schedule.find({userId}))
                        .sort(x => x.term)
                        .map(x => x.courseId)
      res.locals.courses = await Course.find({_id:{$in: courseIds}})
      res.render('schedule')
    } catch(e){
      next(e)
    }
  }
)

app.get('/schedule/remove/:courseId',
  // remove a course from the user's schedule
  async (req,res,next) => {
    try {
      await Schedule.remove(
                {userId:res.locals.user._id,
                 courseId:req.params.courseId})
      res.redirect('/schedule/show')

    } catch(e){
      next(e)
    }
  }
)


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
const port = "5000";
app.set("port", port);

// and now we startup the server listening on that port
const http = require("http");
const server = http.createServer(app);

server.listen(port);

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
