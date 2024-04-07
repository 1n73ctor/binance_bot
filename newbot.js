const axios = require('axios');
const crypto = require('crypto-js');

// API keys and secret
const apiKey = 'JPP2bykbIUInBfp9mZ9x2vZEgn6bzjTU8ZkK8rz33PNUlrbeMI1X1H94hVgvkfDm';
const apiSecret = 'xFpP11oflnLgMiUiIsTG16O5V24SEpQziRRLlEFJ6srY9v4fdnIIblebMJD5gd3m';
const apiServerURL = 'http://173.249.29.51:3000/api/exchange/price_change?offsetInMinutes=10&percentage=2.2&direction=UP';


const baseURL = "https://fapi.binance.com/fapi/v1"
const baseURL1 = "https://fapi.binance.com/fapi/v2"

const instance = axios.create({
    baseURL: baseURL,
    headers: { 'X-MBX-APIKEY': apiKey }
});
const binance = axios.create({
    baseURL: baseURL1,
    headers: { 'X-MBX-APIKEY': apiKey }
});

let quantity = 0;


async function fetchCoinsFromServer() {
    try {
        const response = await axios.get(apiServerURL);
        const coins = response.data;
        const usdtPairs = coins.filter(coin => coin.endsWith('USDT'));
        console.log("Coin find", usdtPairs);
        await finalSubmit(usdtPairs);
    } catch (error) {
        console.error('Error fetching coins from server:', error);
    }
}

//This is the final submit for leverage , margin , new order and SL&TP
const finalSubmit = async (usdtPairs) => {
    for (const symbol of usdtPairs) {
        await checkFuturePair(symbol)
    }
};

const checkOpenorders = async (symbol) => {
    const positionOpen = await openPosition(symbol);
    const orderOpen = await openOrders(symbol);

    if (!positionOpen && !orderOpen) {
        await newOrder(symbol)
    }
    else {
        console.log(`Order already open ${symbol}`);
    }
}

//Check open position 

let positionlistfound = false;
const openPosition = async (symbol) => {
    try {
        let timestamp = new Date().getTime();
        const qstring = `timestamp=${timestamp}`
        let signature = crypto.HmacSHA256(qstring, apiSecret)
        const positionList = await instance(`adlQuantile?${qstring}&signature=${signature}`);
        const list = positionList.data;
        if (list.length > 0) {
            for (let i = 0; i < list.length; i++) {
                if (list[i].symbol === symbol) {
                    return true
                }
            }
        }
        if (!positionlistfound) {
            return false
        }

    } catch (error) {
        console.log("Got error in check open position", error);
    }

}

//Check Open Orders

let orderlistfound = false;
const openOrders = async (symbol) => {
    try {
        let timestamp = new Date().getTime();
        const qstring = `symbol=${symbol}&timestamp=${timestamp}`
        let signature = crypto.HmacSHA256(qstring, apiSecret);
        let openOrderlist = await instance.get(`/openOrders?${qstring}&signature=${signature}`);
        const list = openOrderlist.data;
        if (list.length > 0) {
            for (let i = 0; i < list.length; i++) {
                if (list[i].symbol === symbol) {
                    return true
                }
            }
        }
        if (!orderlistfound) {
            return false
        }
    } catch (error) {
        console.log("Error in check open order", error);
    }
}


//This will check the current price of coin and set the quantity
const checkPrice = async (symbol) => {
    try {
        const tickData = await getTickSize(symbol);
        let timestamp = new Date().getTime();
        const qstring = `symbol=${symbol}&timestamp=${timestamp}`
        let signature = crypto.HmacSHA256(qstring, apiSecret)
        const { data } = await instance.get(`/premiumIndex?${qstring}&signature=${signature}`);
        let currentPrice = await data.markPrice;
        let coinPrice = Number(currentPrice).toFixed(tickData);
        let entryPrice = Number((coinPrice - (coinPrice * 0.005))).toFixed(tickData);
        let slprice = Number(entryPrice - (entryPrice * 0.025)).toFixed(tickData);
        let tpprice = Number(+entryPrice + (+entryPrice * 0.05)).toFixed(tickData)
        console.log(`${symbol} tick size is ${tickData} and current price is ${currentPrice} and entry price is ${entryPrice} and Sl is ${slprice} and TP is ${tpprice}`);

        quantity = 150 / entryPrice  //Set quantity here
        return {
            entryPrice, tpprice, slprice
        }
    } catch (error) {
        console.log('Symbol not found in futures', error.response.data);
    }
}


//Get Tick size
const getTickSize = async (symbol) => {
    try {
        let response = await instance.get(`/exchangeInfo`)
        const gotTick = response.data.symbols.find(symbolTick => symbolTick.symbol === symbol);

        // If the symbol is found, find its tick size
        if (gotTick) {
            const priceFilter = gotTick.filters.find(filter => filter.filterType === 'PRICE_FILTER');
            if (priceFilter) {
                const tick = (Number(priceFilter.tickSize.toString().split(".")[1].length))
                console.log("Original tick size is ", tick);
                const newTick = tick - 2
                return newTick;
            } else {
                return "Tick size not available for this symbol.";
            }
        } else {
            return "Symbol not found.";
        }
    } catch (error) {
        console.log("Error inside getTick");
    }
}

async function fetchFuturePair() {
    try {
        let timestamp = new Date().getTime();
        const qstring = `&timestamp=${timestamp}`
        let signature = crypto.HmacSHA256(qstring, apiSecret)
        const { data } = await binance(`positionRisk?${qstring}&signature=${signature}`)
        return data;
    } catch (error) {
        console.error('Error fetching data from Futures API:', error.response.data);
        return [];
    }
}

let found = false;
async function checkFuturePair(symbol) {
    const pairs = await fetchFuturePair();
    for (let i = 0; i < pairs.length; i++) {
        if (pairs[i].symbol === symbol) {
            console.log("Found:", pairs[i].symbol);
            found = true;
            await checkOpenorders(symbol);
            break;

        }
        found = false;
    }
    if (!found) {
        console.log(`${symbol} not in futures`);
    }
}


//Set leverage
const changeLev = async (symbol) => {
    try {
        let timestamp = new Date().getTime();
        const qstring = `symbol=${symbol}&leverage=10&timestamp=${timestamp}`
        let signature = crypto.HmacSHA256(qstring, apiSecret)
        const { data } = await instance.post(`leverage?${qstring}&signature=${signature}`)
    } catch (error) {
        console.log('Error in leverage change', error.response.data);
    }
}


//Set margin type
const changeMarginType = async (symbol) => {
    try {
        let timestamp = new Date().getTime();
        const qstring = `symbol=${symbol}&marginType=ISOLATED&timestamp=${timestamp}`
        let signature = crypto.HmacSHA256(qstring, apiSecret)
        const { data } = await instance.post(`marginType?${qstring}&signature=${signature}`);
    } catch (error) {
        if (error.response.data.code == "-4046") {
        }
        else {
            console.log('Error in change margin');
        }
    }
}




//Create new order
const newOrder = async (symbol) => {
    try {
        const { slprice, tpprice, entryPrice } = await checkPrice(symbol);
        await changeLev(symbol);
        await changeMarginType(symbol);

        let timestamp = new Date().getTime();
        // const queryString = `symbol=${symbol}&side=BUY&positionSide=LONG&type=MARKET&quantity=${quantity.toFixed()}&timestamp=${timestamp}`;
        const queryString = `symbol=${symbol}&side=BUY&positionSide=LONG&type=LIMIT&quantity=${Math.floor(quantity)}&price=${entryPrice}&timeinforce=GTC&timestamp=${timestamp}`;
        let signature = crypto.HmacSHA256(queryString, apiSecret)
        let response = await instance.post(`/order?${queryString}&signature=${signature}`)

        let stopqt = response.data.origQty;
        console.log(`Order Placed successfully for ${symbol} at ${entryPrice}`);
        // await setTrailing(symbol, stopqt);
        await setTP(symbol, tpprice);
        await setSL(symbol, slprice);

    } catch (error) {
        console.log("Error order placing", error.response.data);
    }

}


// Set tralling SL
const setTrailing = async (symbol, stopqt) => {
    try {
        let timestamp = new Date().getTime();
        const queryString = `symbol=${symbol}&callbackRate=3&side=SELL&positionSide=LONG&type=TRAILING_STOP_MARKET&quantity=${stopqt}&timestamp=${timestamp}`;
        let signature = crypto.HmacSHA256(queryString, apiSecret)
        let response = await instance.post(`/order?${queryString}&signature=${signature}`)
        console.log("Trailing successfully added")
    } catch (error) {
        console.log(error.response.data, "Trailing stop loss error");
    }
}


///set take profit
const setTP = async (symbol, tpprice) => {
    try {
        let timestamp = new Date().getTime();
        const queryString = `symbol=${symbol}&side=SELL&type=TAKE_PROFIT_MARKET&stopPrice=${tpprice}&positionSide=LONG&timeInForce=GTE_GTC&closePosition=true&timestamp=${timestamp}`;
        let signature = crypto.HmacSHA256(queryString, apiSecret)
        let response = await instance.post(`/order?${queryString}&signature=${signature}`)
        console.log(`TP order successfully added for ${symbol} at ${tpprice}`)
    } catch (error) {
        console.log(`Take profit error in ${symbol}`, error.response.data);
    }
}

//set stop lose
const setSL = async (symbol, slprice) => {
    try {
        let timestamp = new Date().getTime();
        const queryString = `symbol=${symbol}&side=SELL&type=STOP_MARKET&stopPrice=${slprice}&positionSide=LONG&timeInForce=GTE_GTC&closePosition=true&timestamp=${timestamp}`;
        let signature = crypto.HmacSHA256(queryString, apiSecret)
        let response = await instance.post(`/order?${queryString}&signature=${signature}`)
        console.log(`SL order successfully added for ${symbol} at ${slprice}`)
    } catch (error) {
        console.log(`Stop loss error in ${symbol}`, error.response.data);
    }
}


setInterval(() => {
    fetchCoinsFromServer()
}, 20000);





