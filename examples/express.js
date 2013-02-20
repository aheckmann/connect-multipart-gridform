var express = require('express'),
    mongo = require('mongodb');

var server = new mongo.Server('localhost', mongo.Connection.DEFAULT_PORT, { auto_reconnect : true, poolSize : 8 }),
    db = new mongo.Db('connect-multipart-gridfs', server, { safe : false });

var multipart = require('../');

var app = express();

app.configure(function(){
  app.set('port', process.env.PORT || 3000);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.logger('dev'));
  app.use(express.methodOverride());
  app.use(multipart({
    db : db,
    mongo : mongo
  }));
  app.use(app.router);
});

router = {
  index : function(req, res){
    res.render('index',req.locals);
  },
  getFiles : function(req, res, next){
    req.locals = {};
    db.collection('fs.files', function(err, collection){
      if (err) next();
      collection.find({}, function(err, cursor){
        if (err) next();
        cursor.sort({uploadDate:-1}).limit(100);
        cursor.toArray(function(err, items){
          if (err) next();
          req.locals.files = items;
          next();
        });
      });
    });
  },
  showUploadFiles : function(req, res, next){
    console.log('Upload files : ',req.files);
    next();
  },
  download : function(req, res, next){
    var readstream = multipart.gridform.gridfsStream(db, mongo).createReadStream(req.param('fileId'));
    readstream.on('open', function(){
      var store = readstream._store;
      res.setHeader('Content-disposition', 'attachment; filename=' + store.filename);
    });
    readstream.pipe(res);
  },
  remove : function(req, res, next){
    db.collection('fs.files', function(err, collection){
      if (err) next();
      collection.remove({_id : mongo.ObjectID(req.param('fileId'))}, function(err){
        if (err) next();
        db.collection('fs.chunks', function(err, collection){
          if (err) next();
          collection.remove({files_id : mongo.ObjectID(req.param('fileId'))}, function(err){
            next();
          });
        });
      });
    });
  }
};

app.get('/', router.getFiles, router.index);
app.post('/',router.showUploadFiles, router.getFiles, router.index);
app.get('/download/:fileId',router.download);
app.get('/remove/:fileId',router.remove, router.getFiles, router.index);

app.listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});