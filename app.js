
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
var curyear = new Date().getFullYear();
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
  res.render("about",{curyear:curyear});
});


app.get("/movielist",function(req,res){
  let mov = ''

  if (recom.length<8)
    mov=top_movies;
  else
    mov=recom

  res.render("watchlist",{added_movies: watchlist.title , ratings: watchlist.ratings, recom:mov,curyear:curyear});
})


app.get("/watchlist",(req,res)=>{
  res.send({movies: watchlist.title})
});



app.get("/recommendation", async function(req, res) {
  for (var i = 0; i < search.length; i++) {
    let url = await get_poster(search[i].tmdbId);
    search[i]['poster'] = url;
  }
  res.render("recommendation", {Movies: search,curyear:curyear});
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
        res.render("home",{movies:top_movies,curyear:curyear})
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
      let profile = await get_profile(movies[ind].tmdbId);

      let bio = await get_bio(profile.cast);
      console.log("Profile generated!");
      res.render("moviepost", {
        movietitle: movies[ind].title, movieimage: poster, profile: profile,bio:bio, id: movies[ind]._id,
        genre: movies[ind].genres, popularity: movies[ind].popularity, voteaverage: movies[ind].vote_average, releasedate: movies[ind].release_date,curyear:curyear})
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

          res.redirect("/movielist",{curyear:curyear});
        });
      });
    });


  });
};




//-------------------->>>>>>>>>>>>>>>>>>>>>>>-----------------------------------


//Subroutines


var base_url = "https://api.themoviedb.org/3/movie/";
var api_key = "30d7de721f9ac1c958640499561b574a";
var query = '/images?'
var query1 = '/credits?'
var img = "https://image.tmdb.org/t/p/w92"
var c_url = "https://api.themoviedb.org/3/person/"


// Generating cast biography
async function get_bio(cast) {
  let bio = Array(11).fill('No Biography found');

  for(i=0;i<11;i++){
    let id = cast[i][3]
    let endpoint = c_url + id + "?api_key=" + api_key;
    await fetch(endpoint)
      .then(res => res.json()
      .then(data => {
        bio[i]=data.biography;
      }))
      .catch(err => console.log(err));
  }
  return bio
}


// Generating Profile for a movie
async function get_profile(movie_id) {
  let endpoint = base_url + movie_id + query1 + "api_key=" + api_key;
  let credits={cast:[], Directing:'',Writing:''};

  await fetch(endpoint)
    .then(res => res.json()
    .then(data => {
      let cast = data.cast;
      let crew = data.crew;

      for(i=0;i<11;i++){
        if (cast[i] == undefined)
          break;
        credits.cast[i] = [cast[i].profile_path,cast[i].original_name, cast[i].character,cast[i].id];
      }

      crew.forEach((item)=>{
        if (credits.Directing!='' && credits.Writing!='')
          return
        if(['Directing','Writing'].includes(item.department) && credits[item.department]=='')
          credits[item.department]=item.name;
      })

    })).catch(err => console.log(err));

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



//------------------------->>>>>>>>>>>>>>>>>>-----------------------------------





//----------------< Keeping track of client response >--------------------------

run().catch((err)=>console.log(err));
child.stdout.on('data', (data) => console.log(data.toString()));
child.stderr.on('data', (data) => console.log(data.toString()));



//----------------------< Deploying app on port >-------------------------------
let host="http://localhost:3000";
let port = process.env.PORT;

if(port==null || port=="")
  port=3000;

child.stdin.write(host+port);
child.stdin.end();

http.listen(port, function(req, res) {
  console.log("Server is running on port 3000");
});
