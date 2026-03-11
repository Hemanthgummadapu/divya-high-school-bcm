const https = require('https');
const fs = require('fs');
const path = require('path');

const fonts = [
  {
    url: 'https://github.com/googlefonts/noto-fonts/raw/refs/heads/main/hinted/ttf/NotoSans/NotoSans-Regular.ttf',
    dest: 'public/fonts/NotoSans-Regular.ttf'
  },
  {
    url: 'https://github.com/googlefonts/noto-fonts/raw/refs/heads/main/hinted/ttf/NotoSansSymbols2/NotoSansSymbols2-Regular.ttf',
    dest: 'public/fonts/NotoSansSymbols2-Regular.ttf'
  },
  {
    url: 'https://github.com/googlefonts/noto-fonts/raw/refs/heads/main/hinted/ttf/NotoSansMath/NotoSansMath-Regular.ttf',
    dest: 'public/fonts/NotoSansMath-Regular.ttf'
  }
];

function download(url, dest, redirects = 5) {
  if (redirects === 0) return console.error('Too many redirects:', url);
  const file = fs.createWriteStream(dest);
  https.get(url, res => {
    if (res.statusCode === 301 || res.statusCode === 302) {
      file.close();
      fs.unlinkSync(dest);
      return download(res.headers.location, dest, redirects - 1);
    }
    res.pipe(file);
  });
}

fs.mkdirSync('public/fonts', { recursive: true });

fonts.forEach(({ url, dest }) => {
  if (fs.existsSync(dest)) return;
  console.log(`Downloading ${dest}...`);
  download(url, dest);
});
