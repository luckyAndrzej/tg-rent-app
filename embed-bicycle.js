var fs = require('fs');
var embed = fs.readFileSync('bicycle-embed.txt', 'utf8');
var html = fs.readFileSync('index.html', 'utf8');
var marker = ';\n      \n      var tg = window.Telegram && window.Telegram.WebApp;';
var replacement = ';\n      ' + embed + ';\n      \n      var tg = window.Telegram && window.Telegram.WebApp;';
if (html.indexOf(marker) === -1) {
  console.error('Marker not found');
  process.exit(1);
}
html = html.replace(marker, replacement);
fs.writeFileSync('index.html', html);
console.log('Done');
