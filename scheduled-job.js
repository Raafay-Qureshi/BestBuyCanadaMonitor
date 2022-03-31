const axios = require("axios");
const { Webhook, MessageBuilder } = require('discord-webhook-node');
const newUrl = (sku, province) => `https://www.bestbuy.ca/ecomm-api/availability/products?accept=application%2Fvnd.bestbuy.standardproduct.v1%2Bjson&accept-language=en-CA&locations=${province}&skus=${sku}`

const APP_NAME = 'Bestbuy Monitor'
const APP_VERSION = '1.00'

timeoutMap = new Map();
quantityMap = new Map();
alertMap = new Map();

var PROVINCES = {
  ALBERTA : {name: 'Alberta', stores: '23|33|34|204|205|209|214|230|231|249|542|741|746|749|902|904|933|934|945|947|951|960|963|976|986|988|998', webhook: "", roleId: "<@&941767760059445359>", monitor: true},
  BRITISH_COLUMBIA : {name: 'British Columbia', stores: '9|10|13|14|215|226|228|232|239|240|242|600|700|701|702|703|704|705|706|708|914|929|941|952|958|961|973|992|994', webhook: "", roleId: "<@&941767979341865072>", monitor: true},
  MANITOBA : {name: 'Manitoba', stores: '32|744|946|948', webhook: "", roleId: "<@&941768158879027260>", monitor: true},
  NEW_BRUNSWICK : {name: 'New Brunswick', stores: '81|661|669', webhook: "", roleId: "<@&941768253053759498>", monitor: true},
  NEWFOUNDLAND : {name: 'Newfoundland', stores: '909', webhook: "", roleId: "<@&941768331222986772>", monitor: true},
  NOVA_SCOTIA : {name: 'Nova Scotia', stores: '238|672|912|979', webhook: "", roleId: "<@&941768402442272848>", monitor: true},
  ONTARIO : {name: 'Ontario', stores: '57|62|79|200|202|203|206|207|208|210|211|213|218|219|223|224|225|233|235|236|237|245|246|247|608|610|613615|617|620|621|622|624|625|626|627|631|632|634|637|639|901|925|926|927|928|930|931|932|935|936|937|938|940|942|943|944|949|950|953|954|956|959|964|965|975|977|980|982|984|985|989|990|995', webhook: "", roleId: "<@&941766931751506011>", monitor: true},
  QUEBEC : {name: 'Quebec', stores: '82|84|243|251|252|541|543|651|653|658|659|663|668|673|674|680|681|906|907|962|967|968|969|970|971|972|978', webhook: "", roleId: "<@&941768467663691827>", monitor: true},
  SASKATCHEWAN : {name: 'Saskatchewan', stores: '39|742|955|974', webhook: "", roleId: "<@&941768529865211914>", monitor: true},
  ONLINE : {name: 'Online', stores: '', webhook: "", roleId: "<@&950242724995555358>", monitor: true},
  ALERT : {name: 'Alert', stores: '', webhook: "", roleId: "<@&950242724995555358>", monitor: true}
};

var PRODUCTS = {
  FE_3090 : {sku: "15463568", name: 'NVIDIA GeForce RTX 3090 24GB GDDR6 Video Card', timeout: 28800, monitor: true},
  FE_3080_TI : {sku: "15530045", name: 'NVIDIA GeForce RTX 3080 Ti 12GB GDDR6 Video Card', timeout: 28800, monitor: true},
  FE_3080 : {sku: "15463567", name: 'NVIDIA GeForce RTX 3080 10GB GDDR6 Video Card', timeout: 60, monitor: true},
  FE_3070_TI : {sku: "15530046", name: 'NVIDIA GeForce RTX 3070 Ti 8GB GDDR6X Video Card', timeout: 28800, monitor: true},
  FE_3070 : {sku: "15078017", name: 'NVIDIA GeForce RTX 3070 8GB GDDR6 Video Card', timeout: 60, monitor: true},
  FE_3060_TI : {sku: "15166285", name: 'NVIDIA GeForce RTX 3060 Ti 8GB GDDR6 Video Card', timeout: 60, monitor: true},
  XBOX_ONE_X : {sku: "14964951", name: 'Xbox Series X 1TB Console', timeout: 28800, monitor: true},
  PS5_PHYSICAL : {sku: "15689336", name: 'PlayStation 5 Console', timeout: 600, monitor: true},
  PS5_DIGITAL : {sku: "15689335", name: 'PlayStation 5 Digital Edition Console', timeout: 600, monitor: true}
};

async function monitor(product, province) {
  if (!timeoutMap.has(province.webhook + product.sku)) {
    run(product, province)
    // console.log(province.webhook + product.sku, timeoutMap)
} else if (Date.now() > (timeoutMap.get(province.webhook + product.sku) + (product.timeout *  1000))){
  // console.log(timeoutMap.get(province.webhook + product.sku) + (product.timeout *  1000), Date.now(), province.name)
    run(product, province)
} else {
    // console.log('\x1b[1;31m%s\x1b[0m', '[' + province.name + '] ' + product.name + ' is on timeout');
    // console.log(timeoutMap.get(province.webhook + product.sku))
}

async function run(productList, province) {
  
  productLink = ''
  productList.forEach(sku => {
    if (productLink != '') {
      productLink += '|'
    }
    productLink += sku.sku
  });

    var config = {
      method: 'get',
      url: newUrl(productLink, province.stores),
      headers: {
        'sec-ch-ua': '" Not A;Brand";v="99", "Chromium";v="98", "Google Chrome";v="98"', 
        'sec-ch-ua-mobile': '?0', 
        'User-Agent': '', 
        'sec-ch-ua-platform': '"Windows"', 
        'Accept': '*/*', 
        'Sec-Fetch-Site': 'same-origin', 
        'Sec-Fetch-Mode': 'cors', 
        'Sec-Fetch-Dest': 'empty', 
        'host': 'www.bestbuy.ca'
      }
    };

    await axios(config).then(function (response) {
      x = 0
      response.data.availabilities.forEach(prod => {
        product = productList[x]
        x++;
        if (province.name != 'Online') {
          if (prod.pickup.status === 'InStock' || prod.pickup.status === 'ComingSoon') {
              const locations = prod.pickup.locations;
              const length = locations.length;
              var nameList = [];
              var quantityList = [];
              for (let i = 0; i < length; i++) {
                if (locations[i].isReservable) {
                  nameList[nameList.length] = locations[i].name;
                  quantityList[quantityList.length] = locations[i].quantityOnHand;
                }
                if ((Date.now() > (timeoutMap.get(locations[i].name + product.sku) + (60 *  1000)) && locations[i].quantityOnHand != quantityMap.get(locations[i].name + product.sku)) || !timeoutMap.has(locations[i].name + product.sku)) {
                  if (!timeoutMap.has(locations[i].name + product.sku) || quantityMap.get(locations[i].name + product.sku) == 0) {
                    if (locations[i].isReservable) {
                      console.log('\x1b[1;32m%s\x1b[0m', '[' + province.name + ' ' + getDate() + '] ' + product.name + ' found in '  + locations[i].name + ' [' + locations[i].quantityOnHand + ']');
                    }
                  } else {
                    if (locations[i].quantityOnHand > quantityMap.get(locations[i].name + product.sku)) {
                      if (locations[i].isReservable) {
                        console.log('\x1b[1;32m%s\x1b[0m', '[' + province.name + ' ' + getDate() + '] ' + product.name + ' increased in quantity in '  + locations[i].name + ' [' + quantityMap.get(locations[i].name + product.sku) + ' -> ' + locations[i].quantityOnHand + ']');
                      }
                    } else {
                      if (locations[i].isReservable || locations[i].quantityOnHand == 0) {
                        console.log('\x1b[1;31m%s\x1b[0m', '[' + province.name + ' ' + getDate() + '] ' + product.name + ' decreased in quantity in '  + locations[i].name + ' [' + quantityMap.get(locations[i].name + product.sku) + ' -> ' + locations[i].quantityOnHand + ']');
                      }
                    }
                  }
                  timeoutMap.set(locations[i].name + product.sku, Date.now())
                  quantityMap.set(locations[i].name + product.sku, locations[i].quantityOnHand)
                }
              }
            if (quantityList.length > 0) {
              if (Date.now() > (timeoutMap.get(province.webhook + product.sku) + (product.timeout *  1000)) || !timeoutMap.has(province.webhook + product.sku)) {
                // Embedd
                const embed = new MessageBuilder()
                .setText(province.roleId)
                .setTitle(product.name)
                .setColor('#0FFF50')
                .setDescription('In Stock')
                .setFooter('BestBuy Bot', 'https://www.gannett-cdn.com/-mm-/428d5c4bd2e8866dabd099a10d07c1c92e90bcd4/c=0-0-881-498/local/-/media/2018/04/18/USATODAY/USATODAY/636596669293144926-BBY-on-blue-1.jpg?width=660&height=374&fit=crop&format=pjpg&auto=webp')
                .setTimestamp()
                .setThumbnail('https://www.gannett-cdn.com/-mm-/428d5c4bd2e8866dabd099a10d07c1c92e90bcd4/c=0-0-881-498/local/-/media/2018/04/18/USATODAY/USATODAY/636596669293144926-BBY-on-blue-1.jpg?width=660&height=374&fit=crop&format=pjpg&auto=webp')
                .setURL(`https://queue.bestbuy.ca/?c=bestbuycanada&e=qpucheckoutprod&t=https%3A%2F%2Fwww.bestbuy.ca%2Fcheckout%2F%3Fqit%3D1%23%2Fen-ca%2Freserve-pickup%2Fpickup-store%3Fsku%3D${product.sku}&cid=en-US`)
                .setImage(`https://multimedia.bbycastatic.ca/multimedia/products/500x500/${product.sku.substring(0,3)}/${product.sku.substring(0,5)}/${product.sku}.jpg`);
          
                for (let j = 0; j < nameList.length; j++) {
                  embed.addField(JSON.stringify(nameList[j]).replaceAll('"', ''), JSON.stringify(quantityList[j]), true)
                }
      
                timeoutMap.set(province.webhook + product.sku, Date.now())
      
                const hook = new Webhook(province.webhook);
                hook.send(embed);
              }
            } else {
              // console.log('\x1b[1;31m%s\x1b[0m', '[' + province.name + ' ' + getDate() + '] ' + product.name + ' is not in stock in any location');
            }
          } else {
            // console.log('\x1b[1;31m%s\x1b[0m', '[' + province.name + '] ' + product.name + ' is not in stock');
          }
        } else {
            if (prod.shipping.status === 'InStock' || prod.shipping.status === 'ComingSoon') {
              if (prod.shipping.quantityRemaining > 0) {
                if (Date.now() > (timeoutMap.get(province.webhook + product.sku) + (product.timeout *  1000)) || !timeoutMap.has(province.webhook + product.sku)) {
                  // Embedd
                  const embed = new MessageBuilder()
                  .setText(province.roleId)
                  .setTitle(product.name)
                  .setColor('#0FFF50')
                  .setDescription('In Stock')
                  .setFooter('BestBuy Bot', 'https://www.gannett-cdn.com/-mm-/428d5c4bd2e8866dabd099a10d07c1c92e90bcd4/c=0-0-881-498/local/-/media/2018/04/18/USATODAY/USATODAY/636596669293144926-BBY-on-blue-1.jpg?width=660&height=374&fit=crop&format=pjpg&auto=webp')
                  .setTimestamp()
                  .setThumbnail('https://www.gannett-cdn.com/-mm-/428d5c4bd2e8866dabd099a10d07c1c92e90bcd4/c=0-0-881-498/local/-/media/2018/04/18/USATODAY/USATODAY/636596669293144926-BBY-on-blue-1.jpg?width=660&height=374&fit=crop&format=pjpg&auto=webp')
                  .setURL(`https://queue.bestbuy.ca/?c=bestbuycanada&e=qpucheckoutprod&t=https%3A%2F%2Fwww.bestbuy.ca%2Fcheckout%2F%3Fqit%3D1%23%2Fen-ca%2Freserve-pickup%2Fpickup-store%3Fsku%3D${product.sku}&cid=en-US`)
                  .setImage(`https://multimedia.bbycastatic.ca/multimedia/products/500x500/${product.sku.substring(0,3)}/${product.sku.substring(0,5)}/${product.sku}.jpg`)
                  .addField('Online', prod.shipping.quantityRemaining, true);
        
                  timeoutMap.set(province.webhook + product.sku, Date.now())
        
                  const hook = new Webhook(province.webhook);
                  hook.send(embed);
                }
                if ((Date.now() > (timeoutMap.get('Online' + product.sku) + (60 *  1000)) && prod.shipping.quantityRemaining != quantityMap.get('Online' + product.sku)) || !timeoutMap.has('Online' + product.sku)) {
                  if (!timeoutMap.has('Online' + product.sku)) {
                    console.log('\x1b[1;32m%s\x1b[0m', '[Online ' + getDate() + '] ' + product.name + ' found' + ' [' + prod.shipping.quantityRemaining + ']');
                  } else {
                    if (prod.shipping.quantityRemaining > quantityMap.get('Online' + product.sku)) {
                      console.log('\x1b[1;32m%s\x1b[0m', '[Online ' + getDate() + '] ' + product.name + ' increased in quantity' + ' [' + quantityMap.get('Online' + product.sku) + ' -> ' + prod.shipping.quantityRemaining + ']');
                    } else {
                      console.log('\x1b[1;31m%s\x1b[0m', '[Online ' + getDate() + '] ' + product.name + ' decreased in quantity' + ' [' + quantityMap.get('Online' + product.sku) + ' -> ' + prod.shipping.quantityRemaining + ']');
                    }
                  }
                  timeoutMap.set('Online' + product.sku, Date.now())
                  quantityMap.set('Online' + product.sku, prod.shipping.quantityRemaining)
                }
              } else {
                // console.log('\x1b[1;31m%s\x1b[0m', '[' + province.name + ' ' + getDate() + '] ' + product.name + ' is not in stock in any location');
              }
            } else {
              // console.log('\x1b[1;31m%s\x1b[0m', '[' + province.name + '] ' + product.name + ' is not in stock');
            }
            if (Date.now() > (timeoutMap.get(product.sku + "Alert") + (product.timeout *  1000)) || !timeoutMap.has(product.sku + "Alert")) {
              if (!alertMap.has(product.sku + "Alert")) {
                timeoutMap.set(product.sku + "Alert", Date.now())
                alertMap.set(product.sku + "Alert", prod.shipping.status)
                console.log("[Status Initialized] " + product.name + " [" + prod.shipping.status + "]")
              } else {
                if (alertMap.get(product.sku + "Alert") != prod.shipping.status) {
                  // Embedd
                  const embed3 = new MessageBuilder()
                  .setTitle(product.name)
                  .setColor('#0FFF50')
                  .setDescription('Status Changed')
                  .setFooter('BestBuy Bot', 'https://www.gannett-cdn.com/-mm-/428d5c4bd2e8866dabd099a10d07c1c92e90bcd4/c=0-0-881-498/local/-/media/2018/04/18/USATODAY/USATODAY/636596669293144926-BBY-on-blue-1.jpg?width=660&height=374&fit=crop&format=pjpg&auto=webp')
                  .setTimestamp()
                  .setThumbnail('https://www.gannett-cdn.com/-mm-/428d5c4bd2e8866dabd099a10d07c1c92e90bcd4/c=0-0-881-498/local/-/media/2018/04/18/USATODAY/USATODAY/636596669293144926-BBY-on-blue-1.jpg?width=660&height=374&fit=crop&format=pjpg&auto=webp')
                  .setURL(`https://queue.bestbuy.ca/?c=bestbuycanada&e=qpucheckoutprod&t=https%3A%2F%2Fwww.bestbuy.ca%2Fcheckout%2F%3Fqit%3D1%23%2Fen-ca%2Freserve-pickup%2Fpickup-store%3Fsku%3D${product.sku}&cid=en-US`)
                  .setImage(`https://multimedia.bbycastatic.ca/multimedia/products/500x500/${product.sku.substring(0,3)}/${product.sku.substring(0,5)}/${product.sku}.jpg`)
                  .addField('Old Status', alertMap.get(product.sku + "Alert"), true)
                  .addField('New Status', prod.shipping.status, true);
        
                  timeoutMap.set(product.sku + "Alert", Date.now())
                  alertMap.set(product.sku + "Alert", prod.shipping.status)
                  console.log("[Status Changed] " + product.name + " [" + alertMap.get(product.sku + "Alert") + " -> " + prod.shipping.status + "]")
        
                  const hook3 = new Webhook('');
                  hook3.send(embed3);
                }
              }
            }
        }
      });
    }).catch(function (error) {
          console.log('error');
    });
  }
}

function everyProvince(productList) {
  Object.values(PROVINCES).forEach(province => {
    if (province.monitor) {
      monitor(productList, province)
    }
  });
}

console.log('Starting ' + APP_NAME + ' v' + APP_VERSION + '...');
console.log('Searching for products in bestbuy...');

function IntTwoChars(i) {
  return (`0${i}`).slice(-2);
}

function getDate() {
  let date_ob = new Date();
  let date = IntTwoChars(date_ob.getDate());
  let month = IntTwoChars(date_ob.getMonth() + 1);
  let year = date_ob.getFullYear();
  let hours = IntTwoChars(date_ob.getHours());
  let minutes = IntTwoChars(date_ob.getMinutes());
  let seconds = IntTwoChars(date_ob.getSeconds());
  let dateDisplay = `${hours}:${minutes}:${seconds} ${month}/${date}/${year}`;
  return dateDisplay;
}

setInterval(() => {
  var productList = []
  Object.values(PRODUCTS).forEach(sku => {
    if (sku.monitor) {
      productList[productList.length] = sku
    }
  });
  everyProvince(productList)
}, 7500);