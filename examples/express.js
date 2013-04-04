var express = require('express');
var multipart = require('../');
var mongodb = require('mongodb');
var MongoClient = mongodb.MongoClient;

MongoClient.connect('mongodb://localhost/example', function (err, db) {
  if (err) throw err;
  createApp(db);
});

function createApp (db) {
  var app = express();

  app.configure(function(){
    app.set('port', process.env.PORT || 3000);
    app.set('views', __dirname + '/views');
    app.set('view engine', 'jade');
    app.use(express.logger('dev'));
    app.use(express.methodOverride());
    app.use(multipart({
      db : db,
      mongo : mongodb
    }));
    app.use(app.router);
  });
  
  // You may want to read this post which details some common express / multipart gotchas:
  // http://stackoverflow.com/questions/11295554/how-to-disable-express-bodyparser-for-file-uploads-node-js

  var router = require('./router')(db);

  app.get('/', router.getFiles, router.index);
  app.post('/',router.showUploadFiles, router.getFiles, router.index);
  app.get('/download/:fileId',router.download);
  app.get('/remove/:fileId',router.remove, router.getFiles, router.index);

  app.listen(app.get('port'), function(){
    console.log('Express server listening on port ' + app.get('port'));
  });
}

