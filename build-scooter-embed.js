var fs = require('fs');
var path = require('path');
var imgPath = path.join(__dirname, 'img', 'scooter-yadea.png');
var buf = fs.readFileSync(imgPath, { encoding: null });
var b64 = buf.toString('base64');
var chunkLen = 200;
var chunks = [];
for (var i = 0; i < b64.length; i += chunkLen) {
  chunks.push(b64.slice(i, i + chunkLen));
}
var line = "var RENTAL_SCOOTER_IMAGE='data:image/png;base64,'+" + chunks.map(function(c){ return "'" + c + "'"; }).join('+') + "';";
fs.writeFileSync(path.join(__dirname, 'scooter-embed.txt'), line, 'utf8');
console.log('scooter-embed.txt written, length:', line.length);
