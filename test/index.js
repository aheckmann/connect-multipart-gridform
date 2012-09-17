
// need to test with connect
//

var http = require('http')
var connect = require('connect')
var mongo = require('mongodb')
var assert= require('assert')
var request = require('./_request')
var db;

var multipart = require('../')

describe('multipart', function(){

  before(function(done){
    var server = new mongo.Server('localhost', 27017);
    db = new mongo.Db('test_connect_multipart_gridform', server);
    db.open(done);
  });

  describe('exports', function(){
    it('should be a function', function(){
      assert.equal('function', typeof multipart);
    })

    it('include gridform', function(){
      assert.ok('function', typeof multipart.multipart)
    })

    it('include connect-multipart', function(){
      assert.ok('function', typeof multipart.gridform)
    })

  })

  it('should return connect multipart middlware', function(){
    var a = connect.multipart();
    var b = multipart({ db: db, mongo: mongo });
    assert.equal(a.toString(), b.toString())
  })

  describe('middleware', function(){
    it('should expect a db', function(){
      assert.throws(function () {
        multipart();
      }, /missing db/);

      assert.doesNotThrow(function () {
        multipart({db:1, mongo: mongo});
      });
    });
    it('should expect the driver', function(){
      assert.throws(function () {
        multipart({ db: 1 });
      }, /driver/);
    });

    describe('file uploads', function(){
      var address;
      var app;
      var fn = function (req, res) {
        res.end(JSON.stringify(req.body));
      }

      // start a server
      before(function(done){
        app = connect();
        app.use('/test', multipart({ db: db, mongo: mongo }));
        app.use('/test', fn);

        var server = http.Server(app);
        server.listen(0, function () {
          request.address = server.address();
          done();
        });
      });

      // use connect.multipart tests

      it('should ignore GET', function(done) {
        request()
        .get('/test')
        .header('Content-Type', 'multipart/form-data; boundary=foo')
        .write('--foo\r\n')
        .write('Content-Disposition: form-data; name="user"\r\n')
        .write('\r\n')
        .write('Tobi')
        .write('\r\n--foo--')
        .end(function(res) {
          assert.equal(res.body, '{}');
          done();
        });
      })

      describe('with multipart/form-data', function() {
        it('should populate req.body', function(done) {
          request()
          .post('/test')
          .header('Content-Type', 'multipart/form-data; boundary=foo')
          .write('--foo\r\n')
          .write('Content-Disposition: form-data; name="user"\r\n')
          .write('\r\n')
          .write('Tobi')
          .write('\r\n--foo--')
          .end(function(res) {
            assert.equal(res.body, '{"user":"Tobi"}');
            done();
          });
        })

        it('should support files', function(done) {
          app.use('/files', multipart({ db: db, mongo: mongo }));
          app.use('/files', function (req, res, next) {
            assert.deepEqual(req.body.user, { name: 'Tobi' });
            assert.equal(req.files.text.constructor.name, 'File');
            res.end(req.files.text.name);
          });

          request()
          .post('/files')
          .header('Content-Type', 'multipart/form-data; boundary=foo')
          .write('--foo\r\n')
          .write('Content-Disposition: form-data; name="user[name]"\r\n')
          .write('\r\n')
          .write('Tobi')
          .write('\r\n--foo\r\n')
          .write('Content-Disposition: form-data; name="text"; filename="foo.txt"\r\n')
          .write('\r\n')
          .write('some text here')
          .write('\r\n--foo--')
          .end(function(res) {
            assert.equal(res.body,'foo.txt');
            done();
          });
        })

        it('should expose options to formidable', function(done) {
          app.use('/options', multipart({ db: db, mongo: mongo, maxFieldsSize: 1 }));
          app.use('/options', function (err, req, res, next) {
            assert(err)
            assert(/^maxFieldsSize exceeded/.test(err.message))
            res.statusCode = 500;
            res.end();
          });

          request()
          .post('/options')
          .header('Content-Type', 'multipart/form-data; boundary=foo')
          .write('--foo\r\n')
          .write('Content-Disposition: form-data; name="user[name]"\r\n')
          .write('\r\n')
          .write('Tobi')
          .write('\r\n--foo\r\n')
          .write('Content-Disposition: form-data; name="text"; filename="foo.txt"\r\n')
          .write('\r\n')
          .write('some text here')
          .write('\r\n--foo--')
          .end(function(res) {
            assert.equal(res.statusCode, 500);
            done();
          });
        })

        it('should work with multiple fields', function(done) {
          request()
          .post('/test')
          .header('Content-Type', 'multipart/form-data; boundary=foo')
          .write('--foo\r\n')
          .write('Content-Disposition: form-data; name="user"\r\n')
          .write('\r\n')
          .write('Tobi')
          .write('\r\n--foo\r\n')
          .write('Content-Disposition: form-data; name="age"\r\n')
          .write('\r\n')
          .write('1')
          .write('\r\n--foo--')
          .end(function(res) {
            assert.equal(res.body, '{"user":"Tobi","age":"1"}');
            done();
          });
        })

        it('should support nesting', function(done) {
          request()
          .post('/test')
          .header('Content-Type', 'multipart/form-data; boundary=foo')
          .write('--foo\r\n')
          .write('Content-Disposition: form-data; name="user[name][first]"\r\n')
          .write('\r\n')
          .write('tobi')
          .write('\r\n--foo\r\n')
          .write('Content-Disposition: form-data; name="user[name][last]"\r\n')
          .write('\r\n')
          .write('holowaychuk')
          .write('\r\n--foo\r\n')
          .write('Content-Disposition: form-data; name="user[age]"\r\n')
          .write('\r\n')
          .write('1')
          .write('\r\n--foo\r\n')
          .write('Content-Disposition: form-data; name="species"\r\n')
          .write('\r\n')
          .write('ferret')
          .write('\r\n--foo--')
          .end(function(res) {
            var obj = JSON.parse(res.body);
            assert.equal(obj.user.age, '1' )
            assert(obj.user.name)
            assert.equal(obj.user.name.first, 'tobi');
            assert.equal(obj.user.name.last, 'holowaychuk');
            assert.equal(obj.species, 'ferret')
            done();
          });
        })

        it('should support multiple files of the same name', function(done) {
          app.use('/multiplefiles', multipart({ db: db, mongo: mongo }));
          app.use('/multiplefiles', function (req, res) {
            assert.equal(2, req.files.text.length);
            assert.equal(req.files.text[0].constructor.name,'File');
            assert.equal(req.files.text[1].constructor.name,'File');
            res.end();
          });

          request()
          .post('/multiplefiles')
          .header('Content-Type', 'multipart/form-data; boundary=foo')
          .write('--foo\r\n')
          .write('Content-Disposition: form-data; name="text"; filename="foo.txt"\r\n')
          .write('\r\n')
          .write('some text here')
          .write('\r\n--foo\r\n')
          .write('Content-Disposition: form-data; name="text"; filename="bar.txt"\r\n')
          .write('\r\n')
          .write('some more text stuff')
          .write('\r\n--foo--')
          .end(function(res) {
            assert.equal(res.statusCode, 200)
            done();
          });
        })

        it('should support nested files', function(done) {
          app.use('/nestedfiles', multipart({ db: db, mongo: mongo }));
          app.use('/nestedfiles', function (req, res) {
            assert.equal(Object.keys(req.files.docs).length, 2);
            assert.equal(req.files.docs.foo.name, 'foo.txt');
            assert.equal(req.files.docs.bar.name, 'bar.txt');
            res.end();
          });

          request()
          .post('/nestedfiles')
          .header('Content-Type', 'multipart/form-data; boundary=foo')
          .write('--foo\r\n')
          .write('Content-Disposition: form-data; name="docs[foo]"; filename="foo.txt"\r\n')
          .write('\r\n')
          .write('some text here')
          .write('\r\n--foo\r\n')
          .write('Content-Disposition: form-data; name="docs[bar]"; filename="bar.txt"\r\n')
          .write('\r\n')
          .write('some more text stuff')
          .write('\r\n--foo--')
          .end(function(res) {
            assert.equal(200, res.statusCode)
            done();
          });
        })

        it('should next(err) on multipart failure', function(done) {
          function whoop (req ,res) {
            res.end('whoop');
          }

          function handleError (err, req, res,next) {
            assert.equal(err.message,'parser error, 16 of 28 bytes parsed');
            res.statusCode = 500;
            res.end();
          }

          app.use('/multiparterror', multipart({db: db, mongo: mongo}));
          app.use('/multiparterror', whoop);
          app.use('/multiparterror', handleError);

          request()
          .post('/multiparterror')
          .header('Content-Type', 'multipart/form-data; boundary=foo')
          .write('--foo\r\n')
          .write('Content-filename="foo.txt"\r\n')
          .write('\r\n')
          .write('some text here')
          .write('Content-Disposition: form-data; name="text"; filename="bar.txt"\r\n')
          .write('\r\n')
          .write('some more text stuff')
          .write('\r\n--foo--')
          .end(function(res) {
            assert.equal(500, res.statusCode)
            done();
          });
        })

        it('should default req.files to {}', function(done) {
          request()
          .post('/test')
          .end(function(res) {
            assert.equal(res.body,'{}');
            done();
          });
        })
      })
    })

  })
})
