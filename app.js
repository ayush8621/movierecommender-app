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

var search = [];
var top_movies = [];
var recom = [];

var watchlist = {title:[],id:[],ratings:[]};

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


app.get("/About", function(req, res) {
  res.render("about");
});


app.get("/movielist",function(req,res){
  let mov = ''

  if (recom.length<8)
    mov=top_movies;
  else
    mov=recom

  res.render("watchlist",{added_movies: watchlist.title , ratings: watchlist.ratings, recom:mov});
})


app.get("/watchlist",(req,res)=>{
  res.send({movies: watchlist.title})
});



app.get("/recommendation", async function(req, res) {
  for (var i = 0; i < search.length; i++) {
    let url = await get_poster(search[i].tmdbId);
    search[i]['poster'] = url;
  }
  res.render("recommendation", {Movies: search});
});







//-------------------------->>>>>>>>>>>>>---------------------------------------

//main function
async function run() {

  //Set-up database connection
  await client.connect();
  console.log('Connected to database!');
  db = client.db("movies");
  col1 = db.collection("movies_metadata");
  col2 = db.collection('top_movies');

  //Set-up connection to python
  io.on('connection', (soc) => {
    console.log('Connected to Python Client!');

    //Defining events


    // Homepage with Demographic recommendation
    app.get("/",function(req, res) {
      col2.find().toArray(async (err,data)=>{
        top_movies = data.slice(0,9);

        for (var i = 0; i < top_movies.length; i++) {
          let url = await get_poster(top_movies[i].tmdbId);
          top_movies[i]['poster'] = url;
        }
        res.render("home",{movies:top_movies})
      });
    });


    //Search event when user searches movie name
    app.post("/", function(req, res) {
      let typedmovie = req.body.search
      soc.emit('search', typedmovie, function(obj) {
        col1.find({
          '$or': obj
        }).toArray(function(err, data) {
          search = data;
          console.log('Search done!');
          res.redirect("/recommendation");
        });
      });
    });


    //Movie information when user clicks movie poster
    app.get("/recommendation/:query/:index/:movieposter", async function(req, res) {
      let ind = req.params.index;
      let poster = req.params.movieposter;
      let movies = eval(req.params.query);

      let profile = await get_profile(movies[ind].tmdbId, soc);
      console.log("Profile generated!");
      res.render("moviepost", {
        movietitle: movies[ind].title, movieimage: poster, profile: profile, id: movies[ind]._id,
        genre: movies[ind].genres, popularity: movies[ind].popularity, voteaverage: movies[ind].vote_average, releasedate: movies[ind].release_date})
    });


    //Creating watchlist as per user
    app.post("/moviepost", function(req, res) {
      let var1 = req.body.watchlist.split(',');

      let id = var1[0];
      let reqMov = var1[1];
      let rating = req.body.star;


      if (watchlist.title.includes(reqMov))
        watchlist.ratings[watchlist.title.indexOf(reqMov)] = rating;
      else{
        watchlist.title.push(reqMov);
        watchlist.ratings.push(rating);
        watchlist.id.push(id);
      }
      res.redirect('back');
    })


    // Removing movies from watchlist
    app.post("/delete",function(req,res){
      let check = req.body.check;
      let index = 0;

      if (check==undefined)
        check=[req.body.deletedmovie];
      else
        check = check.split(',');

      check.forEach((item) => {
         index = watchlist.title.indexOf(item);
         watchlist.id.splice(index,1);
         watchlist.title.splice(index, 1);
         watchlist.ratings.splice(index, 1);
      });
      res.redirect("/movielist")
    });


    // Changing ratings according to user
    app.get("/changeRating/:movie/:rating", (req,res)=>{
      let ind = req.params.movie;
      let rating = req.params.rating;
      watchlist.ratings[ind] = rating;
    })


    //recommendation task
    app.get('/recommend',(req,res)=>{
      console.log('Recommending movies!')
      soc.emit('recommend',watchlist,(data)=>{
        col1.find({'$or':data}).toArray(async (err,mov)=>{
          recom = mov;

          for (var i = 0; i < recom.length; i++) {
            let url = await get_poster(recom[i].tmdbId);
            recom[i]['poster'] = url;
          }

          res.redirect("/movielist");
        });
      });
    });


  });
};




//-------------------->>>>>>>>>>>>>>>>>>>>>>>-----------------------------------


//Subroutines

// async function get_details(cast_name) {
//   let endpoint_wiki = "https://en.wikipedia.org/w/api.php?action=query&format=json&list=search&srsearch=" + cast_name ;
//   await fetch(endpoint_wiki)
//     .then(res => res.json())
//     .then(data => {
//       path = data.query.search[0].snippet;
//     })
//     .catch((error) => {
//       path = 'Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.';
//     });
//   return path;
// }



var base_url = "https://api.themoviedb.org/3/movie/";
var api_key = "30d7de721f9ac1c958640499561b574a";
var query = '/images?'
var query1 = '/credits?'
var img = "https://image.tmdb.org/t/p/w92"


// Getting credits for a movie
async function get_credits(movie_id) {
  let endpoint = base_url + movie_id + query1 + "api_key=" + api_key;
  let credits = '';
  await fetch(endpoint)
    .then(res => res.json()
    .then(data => {
      credits = data['cast'];
    }))
    .catch(err => {credits = [];});
  return credits
}


// Getting path of movie poster
async function get_poster(movie_id) {
  let endpoint = base_url + movie_id + query + "api_key=" + api_key;
  let path = '';
  await fetch(endpoint)
    .then(res => res.json()
    .then(data => {
      path = data['posters'][0]['file_path'];
    }))
    .catch(err => {path = '/tI0AHXooAbubqd4cDQapAv5xTmJ.jpg';});
  return path
}


// Generating Cast profiles
async function get_profile(tmdbId, socket){
  let n = 11;
  var profile = Array(11);
  let credits = await get_credits(tmdbId);

  for (var i=0; i<n; i++) {
    profile[i] = Array(3).fill('');
    if (credits[i] != undefined){
      if (credits[i]['profile_path'] != null)
        profile[i][0] = credits[i]['profile_path'];
      profile[i][1] = credits[i]['original_name'];
      profile[i][2] = credits[i]['character'];
    }
  }
  return profile
}



//------------------------->>>>>>>>>>>>>>>>>>-----------------------------------





//----------------< Keeping track of client response >--------------------------

run().catch((err)=>console.log(err));
child.stdout.on('data', (data) => console.log(data.toString()));
child.stderr.on('data', (data) => console.log(data.toString()));



//----------------------< Deploying app on port >-------------------------------

http.listen(3000, function(req, res) {
  console.log("Server is running on port 3000");
});
