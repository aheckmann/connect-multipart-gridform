
// connect-multipart-gridform

var gridform = require('gridform');
var multipart = require('connect').multipart;

module.exports = exports = function multipartGridform (options) {
  var form = gridform(options);
  options.__gridstream = form.__gridstream;
  options.__filename = form.__filename;
  options.onPart = form.onPart;
  form = null;
  return multipart(options);
}

exports.gridform = gridform;
exports.multipart = multipart;
