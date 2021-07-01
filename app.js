//----------------------< Importing required modules >--------------------------
var {
  spawn
} = require('child_process');
const express = require("express");
const bodyparser = require("body-parser");
const https = require("https");
const ejs = require("ejs");
const socket = require('socket.io');
const _http_ = require('http');
const {
  MongoClient
} = require('mongodb');
const fetch = require("node-fetch");

var movies = [];



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
  res.render("home", {
    added_movies: added_movies
  });
});

app.get("/About", function(req, res) {
  res.render("about", {
    added_movies: added_movies
  });
});

app.get("/recommendation", async function(req, res) {
  for (var i = 0; i < movies.length; i++) {
    let url = await get_poster(movies[i].tmdbId);
    movies[i]['poster'] = url;
  }
  res.render("recommendation", {
    Movies: movies,
    added_movies: added_movies
  });
});

var added_movies = [];
var profilearr = Array(11);
var requestedI;
var profilearr1 = Array(11);
var profilearr2 = Array(11);

app.get("/recommendation/:moviename/:movieposter", async function(req, res) {
  var requestedmovie = req.params.moviename;
  var movieposter = req.params.movieposter;
  for (var i = 0; i < movies.length; i++) {
    if (movies[i].title == requestedmovie) {
      requestedI = i;
    }
  }
  for (var j = 0; j < 11; j++) {
    let arr = await get_credits(movies[requestedI].tmdbId);
    if (arr[j] == undefined) {
      profilearr1[j] = "Unknown"
      profilearr2[j] = "Unknown";
      profilearr[j] = "";
    } else {
      if (arr[j]['profile_path'] == null) {
        profilearr[j] = "";
      } else {
        profilearr[j] = arr[j]['profile_path'];
      }
      profilearr1[j] = arr[j]['original_name'];
      profilearr2[j] = arr[j]['character'];
    }

    // console.log(profilearr[j]);
  }
  // console.log(req.body.watchlist);
  res.render("moviepost", {
    movietitle: requestedmovie,
    movieimage: movieposter,
    profileimg: profilearr,
    profilename: profilearr1,
    profilechar: profilearr2,
    added_movies: added_movies,
    genre: movies[requestedI].genres,
    popularity: movies[requestedI].popularity,
    voteaverage: movies[requestedI].vote_average,
    releasedate: movies[requestedI].release_date
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
      // console.log(added_movies);
      res.redirect("/recommendation");
    })
    //event 2

  });
};


//Subroutines
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
      // console.log(path);
    })
    .catch((error) => {
      path = '/images/img1.jpg.jpg';
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
      path = '/images/img1.jpg.jpg';
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


//Api key:75b6c7fa3b5bb340d178be5593ede1a9////
//https://api.themoviedb.org/3/movie/550?api_key=75b6c7fa3b5bb340d178be5593ede1a9//
// ,{movieitem:<%= added_movies %>}
// <!-- <% movieitem.forEach(function(item){ %>
// <li><p class="dropdown-item"> <%= item %> </p></li>
// <li><hr class="dropdown-divider"></li>
// <%  })  %> -->
