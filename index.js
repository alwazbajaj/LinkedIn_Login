// var express = require('express');


// const app = express();
// const PORT = 3200;
// const app_id = '86zk1p5cbax79n'
// const secret = 'FBycWSOyVOGACojC'
// var Linkedin = require('node-linkedin')('app_id','secret')  

// var scope = ['r_basicprofile', 'r_fullprofile', 'r_emailaddress','r_contactinfo'];

// var linkedin = Linkedin.init('my_access_token', {
//     timeout: 10000 /* 10 seconds */
// });

// Linkedin.auth.setCallback('localhost:3200/callback');

// app.get('/oauth/linkedin', function(req, res) {
//     // This will ask for permisssions etc and redirect to callback url.
//     Linkedin.auth.authorize(res, scope);
//     Linkedin.setCallback(req.protocol + '://' + req.headers.host + '/oauth/linkedin/callback');
//     Linkedin.auth.authorize(res, scope);
//     Linkedin.auth.getAccessToken(res, req.query.code, req.query.state, function(err, results) {
//         if ( err )
//             return console.error(err);
 
//         /**
//          * Results have something like:
//          * {"expires_in":5184000,"access_token":". . . ."}
//          */
 
//         console.log(results);
//         return res.redirect('/');
//     })
// });

// app.listen(PORT,()=>
// console.log(`server is running on ${PORT}`)
// );

//TODO: Error handling all calls
//TODO: Authenticating user
//TODO: accesstoken expiration handling
//TODO: Refactoring


var express = require('express')
var app = express()
var fs = require('fs');
var http = require('https');
var querystring = require('querystring');
var OauthParams = require('./OauthParams');
var Mongodb = require("mongodb");
var mongoose = require('mongoose')
var MongoClient = Mongodb.MongoClient
    , assert = require('assert');

/**
var auth = require('./routes/auth');
var profiledata = require('./routes/profiledata');
app.use('/auth', auth);
app.use('/profiledata', profiledata);
**/
// DB Connection URL
mongoose.promise = global.promise;
mongoose.connect('mongodb://localhost/profile', {
  
})
var Token = mongoose.model('Token', {
    token: String,

})

var profile_data = mongoose.model('profile_data',
{
    firstname: String,
    headline : String,
    p_id : String,
    industry:String,
    lastname:String,
    location :{
        "country":String,
        "name":String
    },
    numconnection:Number,
    pictureurl : String,
    summary:String
})

app.use(express.static(__dirname))
var url = 'mongodb://localhost/data';

/**
 *
 * common middlewares
 */
app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.header('Content-Type', 'application/json');
    next();
});
/**
 * Routes handling
 *
 */
app.get('/', function (req, res) {
    res.send('Invalid Endpoint')
})
/**
 * Handshake with linkedin api once the redirect URI is called by linked in to provide teh client secret and other required details
 * @param code
 * @param ores
 */
function handshake(code, ores) {

    //set all required post parameters
    var data = querystring.stringify({
        grant_type: "authorization_code",
        code: code,
        redirect_uri: OauthParams.redirect_uri,//should match as in Linkedin application setup
        client_id: OauthParams.client_id,
        client_secret: OauthParams.client_secret// the secret
    });

    var options = {
        host: 'www.linkedin.com',
        path: '/oauth/v2/accessToken',
        protocol: 'https:',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(data)
        }
    };
    console.log(options);
    var req = http.request(options, function (res) {
         var data = '';
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
            data += chunk;

        });
        res.on('end', function () {
            //once the access token is received store in DB
            insertTodb(JSON.parse(data), function (id) {
                //need to find better way and proper authetication for the user
                //ores.redirect('http://localhost:5000/dashboard/' + id);
                getData(id, (err)=>{
                    console.log("data fetched")
                })
            });
        });
        req.on('error', function (e) {
            console.log("problem with request: " + e.message);
        });

    });
    req.write(data);
    req.end();


}
/**
 *
 * Get data from linkedin api for the access token
 *
 * @param uid
 * @param callback
 */
function getData(uid, callback) {

    findfromdb(uid, function (obj) {
        var options = {
            host: 'api.linkedin.com',
            path: '/v1/people/~:(id,first-name,last-name,headline,picture-url,location,industry,current-share,num-connections,summary,specialties,positions)?format=json',
            protocol: 'https:',
            method: 'GET',
            headers: {
                "Authorization": 'Bearer ' + obj.access_token

            }
        };
        var req = http.request(options, function (res) {
            res.setEncoding('utf8');
            var data = '';
            MongoClient.connect(url, function (err, db) {
            res.on('data', function (chunk) {
                console.log('PROFILE DATA  ', chunk);
                
                
                data += chunk;
                //var collection = db.db('data').collection('documents');
                //collection.insertOne(
                //data
                //, function (err, result){
                //assert.equal(err, null);  
                //})
            
            })
            
            

            });
            res.on('end', function () {
                callback(JSON.parse(data));
                console.log('No more data in response.');
                insertProfile(JSON.parse(data))
                
            });
            req.on('error', function (e) {
                console.log("problem with request: " + e.message);
            });

        });
        req.end();


    });


    }


/**
 *
 * Inset the token received from ln api to DB and return the unique identifier for this record
 * @param token
 * @param callback
 */
function insertTodb(token, callback) {
    console.log("token", token)
    //var Ttoken = new Token(token)
    //var savedtoken = Ttoken.save()
    MongoClient.connect(url, function (err, db) {
        //console.log(db)
        var collection = db.db('data').collection('documents');
        collection.insertOne(
            token
           , function (err, result) {
                assert.equal(err, null);
                console.log("Inserted " +  result.result.n + " documents into the collection ", result.ops[0]._id);
                callback(result.ops[0]._id);// is there a better way?

           });
        }); 

    
}

function insertProfile(data,callback)
{
    console.log("data",data)
    MongoClient.connect(url,function(err,db)
    {
        var collection = db.db('data').collection('documents');
        collection.insertOne(
            data,
            function(err,result)
            {
                assert.equal(err,null);
               // callback(result.ops[0].id);
            }
        )
    })
}
/**
 * Find the accesstoken from the DB for the id
 * @param uid
 * @param callback
 */
function findfromdb(uid, callback) {

    MongoClient.connect(url, function (err, db) {

        db.db('data').collection('documents').find({_id: Mongodb.ObjectID(uid)}).toArray(function (err, result) {

            var record = result[0];
            console.log("Record  ", record);
            callback(record);
        });
    });
}


app.get('/profiledata', function (req, res) {
    console.log("profiledata ", req.query);
    getData(req.query.uid, function (record) {
        res.send(record);
    });

})

app.get('/auth', function (req, res) {
    // This is the redirect URI which linkedin will call to and provide state and code to verify
    /**
     *
     * Attached to the redirect_uri will be two important URL arguments that you need to read from the request:
     code — The OAuth 2.0 authorization code.
     state — A value used to test for possible CSRF attacks.
     */
    console.log("auth route - Request object received from Linkedin", req.query);

    //TODO: validate state here
    var error = req.query.error;
    var error_description = req.query.error_description;
    var state = req.query.state;
    var code = req.query.code;
    if (error) {
        next(new Error(error));
    }
    /**
     *
     * The code is a value that you will exchange with LinkedIn for an actual OAuth 2.0 access
     * token in the next step of the authentcation process.  For security reasons, the authorization code
     * has a very short lifespan and must be used within moments of receiving it - before it expires and
     * you need to repeat all of the previous steps to request another.
     */
    //once the code is received handshake back with linkedin to send over the secret key
    handshake(req.query.code, res);
})


app.use(function (err, req, res, next) {
    res.status(401).send(err);

});

app.listen(5000, function () {
    console.log('Example app listening on port 5000!')
})
