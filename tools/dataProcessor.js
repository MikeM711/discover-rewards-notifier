// This is a ES6 node.js script! Please install dependencies from package.json
// TODO description

const DEAL_URL = "https://card.discover.com/cardmembersvcs/deals/app/home";
const DEAL_INPUT_FILE = '../data/deals_02-13-2018.html';
const DEAL_OUTPUT_FILE = '../data/deals.json';
const CASHBACK_INPUT_FOLDER = '../data/cashbacks_02-18-2018/';
const CASHBACK_OUTPUT_FILE = '../data/cashbacks.json';

let fs = require('fs');
let decode = require('unescape');
let jsonfile = require('jsonfile');
const { URL, URLSearchParams } = require('url');
let cheerio = require('cheerio');
let google = require('google');
google.resultsPerPage = 10;

// Holds processed data
let deals = [];
let cashbacks = [];

function parseCashbacks() {
// Read cashback HTMLs from folder
  fs.readdirSync(CASHBACK_INPUT_FOLDER).forEach(file => {
    console.log('Found cashback file', file);

    let html = fs.readFileSync(CASHBACK_INPUT_FOLDER + file);
    let $ = cheerio.load(html, {
      ignoreWhitespace: true,
    });

    let items = $('div[class=items]');

    console.log('Finding normal items');
    let rowsNormal = items.find('div[class=item-row]');
    rowsNormal.each(function (index, row) {
      let items = $(row).find('div[class=rfy-item]');
      console.log('Found', items.length, 'items');
      parseItems(items);
    });

    console.log('Finding special items');
    let rowsSpecial = items.find('div[class=item-row]');
    rowsSpecial.each(function (index, row) {
      let items = $(row).find('div[class="rfy-item specialBackground"]');
      console.log('Found', items.length, 'items');
      parseItems(items);
    });

    function parseItems(items) {
      items.each(function (index, item) {
        let cashback = {
          site_url: null,
          offers: []
        };

        let linkTag = $('a[class=brandImg]', item);
        cashback.cashback_url = 'https://card.discover.com' + linkTag.attr('href');

        let imgTag = $('img[class=item-logo-img]', item);
        cashback.img_src_url = 'https://card.discover.com' + imgTag.attr('src');
        cashback.site_name = imgTag.attr('title');

        let offerTags = $(item).find('div[class="pill giftItem"]');
        offerTags.each(function (index, offer) {
          let offerTag = $('a', offer);
          let offerUrl = new URL('https://card.discover.com' + offerTag.attr('href'));

          let pointsNeeded = offerUrl.searchParams.get('modeAmt');
          let reward = offerUrl.searchParams.get('disbAmt');
          cashback.offers.push('$' + pointsNeeded + ' gets you $' + reward);
        });

        cashbacks.push(cashback);
      });
    }
  });
}


function parseDeals() {
// Read deals HTML as an array of lines
  let deals_html_lines = fs.readFileSync(DEAL_INPUT_FILE).toString().split("\n");
  console.log('Found deal file', DEAL_INPUT_FILE);

// Deals: HTML -> JSON
  for (let i = 0; i < deals_html_lines.length; i++) {
    let xml_line = deals_html_lines[i];

    let deal = {
      title: decode(xml_line.match("\"sr-only\"> (.*)<\\/span>")[1]),
      site_name: decode(xml_line.match("<\\/b> (.*)<\\/h3>")[1]),
      site_url: null,
      deal_url: DEAL_URL + xml_line.match("#\\/deal\\/\\d*")[0],
      img_src_url: xml_line.match("(https:\\/\\/www.discovercard.com\\/extras.*)\" alt")[1],
      expiry_date: decode(xml_line.match("class=\"date\">(.*)<\\/div>")[1])
    };

    deals.push(deal);
  }

  let index = 0;

  // Google search hostnames for all deals
  googleSearch(deals[index].site_name, function(url) {
    deals[index].site_url = url;

    index++;
    if (index === deals.length) {
      saveData();
    } else {
      googleSearch(deals[index].site_name);
    }
  });

}

function googleSearch(input, callback) {
  console.log('Googling for', input);

  google(input, function (err, res) {
    if (err) {
      console.error(err);
      return;
    }

    if (res.links.length === 0) {
      console.error('Wrong length for res.links', res.links.length);
      return;
    }

    while (true) {
      let link = res.links[i].href;

      if (link) {
        // Only keep hostname
        const siteUrl = new URL(link);
        const hostname = siteUrl.hostname;
        console.log('Found hostname', hostname);
        callback(hostname);
        return;
      }

      console.warn('next link...');
    }

  });
}

// Deals: Write to json
function saveData() {
  jsonfile.writeFile(DEAL_OUTPUT_FILE, deals, {spaces: 2}, function (err) {
    if (err) {
      console.error(err);
    }
  })
}