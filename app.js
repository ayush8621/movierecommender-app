//----------------------< Importing required modules >--------------------------

var {spawn} = require('child_process');
const express = require("express");
const bodyparser = require("body-parser");
const https = require("https");
const ejs = require("ejs");
const socket = require('socket.io');
const _http_ = require('http');
const {MongoClient} = require('mongodb');
const fetch = require("node-fetch");

var movies = [];
var requestedI;
var added_movies = [];
var updatedaddedmovies = [];
var profilearr = Array(11);
var profilearr1 = Array(11);
var profilearr2 = Array(11);
let cast_detail_arr=[];

//--------------------------< Defining variables >------------------------------

const app = express();
const http = _http_.createServer(app);
const io = socket(http);
const child = spawn('python', ['app.py']);
const url = "mongodb+srv://admin:kanishk@cluster1.v5rkc.mongodb.net/movies?retryWrites=true&w=majority";
const client = new MongoClient(url, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});



//--------------------------< Configuring app >---------------------------------

app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyparser.urlencoded({
  extended: true
}));



//-------------------------< Defining routes >----------------------------------

app.get("/", function(req, res) {
  res.render("home", {added_movies: added_movies});
});

app.get("/About", function(req, res) {
  res.render("about");
});

app.get("/movielist",function(req,res){
  res.render("watchlist",{added_movies:added_movies});
})


app.get("/watchlist",(req,res)=>{
  res.send({movies:added_movies})
});

app.get("/recommendation", async function(req, res) {
  for (var i = 0; i < movies.length; i++) {
    let url = await get_poster(movies[i].tmdbId);
    movies[i]['poster'] = url;
    // console.log(  movies[i]['poster'])
  }
  res.render("recommendation", {Movies: movies,added_movies: added_movies});
});

app.get("/recommendation/:moviename/:movieposter", async function(req, res) {
  var requestedmovie = req.params.moviename;
  var movieposter = req.params.movieposter;
  for (var i = 0; i < movies.length; i++) {
    if (movies[i].title == requestedmovie)
      requestedI = i;
  }
  for (var j = 0; j < 11; j++) {
    let arr = await get_credits(movies[requestedI].tmdbId);
    if (arr[j] == undefined) {
      profilearr1[j] = "Unknown"
      profilearr2[j] = "Unknown";
      profilearr[j] = "";
    } else {
      if (arr[j]['profile_path'] == null)
        profilearr[j] = "";
       else {
        profilearr[j] = arr[j]['profile_path'];
      }
      profilearr1[j] = arr[j]['original_name'];
      cast_detail = await get_details(profilearr1[j]);
      cast_detail_arr.push(cast_detail);
      console.log(cast_detail_arr[j])
      profilearr2[j] = arr[j]['character'];
    }
  }
  res.render("moviepost", {
    movietitle: requestedmovie,movieimage: movieposter,profileimg: profilearr,profilename: profilearr1,profilechar: profilearr2,cast_detail_arr:cast_detail_arr,
    added_movies: added_movies,genre: movies[requestedI].genres,popularity: movies[requestedI].popularity,voteaverage: movies[requestedI].vote_average,releasedate: movies[requestedI].release_date
  });
});





//-------------------------->>>>>>>>>>>>>---------------------------------------

//main function
async function run() {

  //Set-up database connection
  await client.connect();
  console.log('Connected to database!');
  db = client.db("movies");
  col = db.collection("movies_metadata");

  //Set-up connection to python
  io.on('connection', (soc) => {
    console.log('Connected to Python Client!');

    //Defining events

    //Search event
    app.post("/", function(req, res) {
      let typedmovie = req.body.search
      soc.emit('search', typedmovie, function(obj) {
        col.find({
          '$or': obj
        }).toArray(function(err, data) {
          console.log(data);
          movies = data;
          console.log(movies);
          res.redirect("/recommendation");
        });
      });
    });


    app.post("/moviepost", function(req, res) {
      added_movies.push(req.body.watchlist);
      console.log(added_movies);
      console.log(req.body.star);
      res.redirect("/recommendation");
    })
  });
};

  var deletedindex;
  var check = [];
  var deleted_movie;
app.post("/delete",function(req,res){
  deleted_movie = req.body.deletedmovie;
   check=(req.body.checkbox);
  console.log(check);
  console.log(deleted_movie);
  if(check==undefined){
   deletedindex = added_movies.indexOf(deleted_movie);
  if (deletedindex > -1) {
   added_movies.splice(deletedindex, 1);
  }
}
  if(check!=undefined ){
  check.forEach((checked_item) => {
     deletedindex = added_movies.indexOf(checked_item);
     added_movies.splice(deletedindex, 1);
  });
}


  res.redirect("/movielist");
})

//Subroutines

async function get_details(cast_name) {
  let endpoint_wiki = "https://en.wikipedia.org/w/api.php?action=query&format=json&list=search&srsearch=" + cast_name ;
  await fetch(endpoint_wiki)
    .then(res => res.json())
    .then(data => {
      path = data.query.search[0].snippet;
    })
    .catch((error) => {
      path = 'Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.';
    });
  return path;
}

var base_url = "https://api.themoviedb.org/3/movie/";
var api_key = "30d7de721f9ac1c958640499561b574a";
var query = '/images?'
var query1 = '/credits?'
var img = "https://image.tmdb.org/t/p/original"
var path = ''

async function get_credits(movie_id) {
  let endpoint = base_url + movie_id + query1 + "api_key=" + api_key;
  await fetch(endpoint)
    .then(res => res.json())
    .then(data => {
      path = data['cast'];
    })
    .catch((error) => {
      path = '/img10.jpg.jpg';
    });
  return path;
}

async function get_poster(movie_id) {
  let endpoint = base_url + movie_id + query + "api_key=" + api_key;
  await fetch(endpoint)
    .then(res => res.json())
    .then(data => {
      path = data['posters'][0]['file_path'];
    })
    .catch((error) => {
      path = '/tI0AHXooAbubqd4cDQapAv5xTmJ.jpg';
    });
  return path
}

//------------------------->>>>>>>>>>>>>>>>>>-----------------------------------





//----------------< Keeping track of client response >--------------------------

run().catch(console.dir);
child.stdout.on('data', (data) => console.log(data.toString()));
child.stderr.on('data', (data) => console.log(data.toString()));



//----------------------< Deploying app on port >-------------------------------

http.listen(3000, function(req, res) {
  console.log("Server is running on port 3000");
});
