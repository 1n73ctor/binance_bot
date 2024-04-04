const axios = require('axios');
const crypto = require('crypto-js');

// API keys and secret
const apiKey = 'CBmgJibTN93aUn5WSiYkhNhFXC3Qa63GR92q2CrB5cTq5ZacoiOHcLnKGoHAjeIR';
const apiSecret = 'nvOGfODC9igKr77BP4EU9iXBuIFJPuWDodKao0TIQIfWG1bTBBLtJvObhLpwXPUl';
const apiServerURL = 'http://173.249.29.51:3000/api/exchange/price_change?offsetInMinutes=10&percentage=2.5&direction=UP';


const baseURL = "https://fapi.binance.com/fapi/v1"

const instance = axios.create({
    baseURL: baseURL,
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
        console.error('Error fetching coins from server:');
    }
}

//This is the final submit for leverage , margin , new order and SL&TP
const finalSubmit = async (usdtPairs) => {
    for (const symbol of usdtPairs) {
        await checkPrice(symbol);
    }
};


//This will check the current price of coin and set the quantity
const checkPrice = async (symbol) => {
    try {
        let timestamp = new Date().getTime();
        const qstring = `symbol=${symbol}&timestamp=${timestamp}`
        let signature = crypto.HmacSHA256(qstring, apiSecret)
        const { data } = await instance.get(`premiumIndex?${qstring}&signature=${signature}`);
        console.log(data.markPrice);
        quantity = 150 / +data.markPrice  //Set quantity here
        // await changeLev(symbol)
        await checkOpen(symbol)
    } catch (error) {
        console.log('Symbol not found in futures');
    }
}


//Set leverage
const changeLev = async (symbol) => {
    try {
        let timestamp = new Date().getTime();
        const qstring = `symbol=${symbol}&leverage=10&timestamp=${timestamp}`
        let signature = crypto.HmacSHA256(qstring, apiSecret)
        const { data } = await instance.post(`leverage?${qstring}&signature=${signature}`)
        // await changeMarginType(symbol);
    } catch (error) {
        console.log('Error in leverage change');
    }
}


//Set margin type
const changeMarginType = async (symbol) => {
    try {
        let timestamp = new Date().getTime();
        const qstring = `symbol=${symbol}&marginType=ISOLATED&timestamp=${timestamp}`
        let signature = crypto.HmacSHA256(qstring, apiSecret)
        const { data } = await instance.post(`marginType?${qstring}&signature=${signature}`);
        // await checkOpen(symbol)
    } catch (error) {
        if (error.response.data.code == "-4046") {
            // await checkOpen(symbol)
        }
        else {
            console.log('Error in change margin');
        }
    }
}



//Check open position 
const checkOpen = async (symbol) => {
    try {
        let timestamp = new Date().getTime();
        const qstring = `timestamp=${timestamp}`
        let signature = crypto.HmacSHA256(qstring, apiSecret)
        const { data } = await instance(`adlQuantile?${qstring}&signature=${signature}`);
        if (data[0].symbol == symbol) {
            console.log("Position already open for :", data[0].symbol);
        }
        else {
            await newOrder(symbol);
        }
    } catch (error) {
        console.log('Error in check open position');
    }
}


//Create new order
const newOrder = async (symbol) => {
    try {
        await changeLev(symbol);
        await changeMarginType(symbol)
        let timestamp = new Date().getTime();
        const queryString = `symbol=${symbol}&side=BUY&positionSide=LONG&type=MARKET&quantity=${quantity.toFixed()}&timestamp=${timestamp}`;
        let signature = crypto.HmacSHA256(queryString, apiSecret)
        let response = await instance.post(`/order?${queryString}&signature=${signature}`)

        // console.log(response.data.origQty, "here");
        let stopqt = response.data.origQty;
        console.log("Order Placed successfully");
        await setTrailing(symbol, stopqt)
    } catch (error) {
        console.log("Error order placing", error);
    }

}


//Set tralling SL
const setTrailing = async (symbol, stopqt) => {
    try {
        let timestamp = new Date().getTime();
        const queryString = `symbol=${symbol}&callbackRate=2&side=SELL&positionSide=LONG&type=TRAILING_STOP_MARKET&quantity=${stopqt}&timestamp=${timestamp}`;
        let signature = crypto.HmacSHA256(queryString, apiSecret)
        let response = await instance.post(`/order?${queryString}&signature=${signature}`)
        console.log("Trailing successfully added")
    } catch (error) {
        console.log(error, "Trailing stop loss error");
    }
}



// const setStoplose = async (symbol, stopqt) => {
//     try {
//         let timestamp = new Date().getTime();
//         const queryString = `symbol=${symbol}&callbackRate=2&side=SELL&positionSide=LONG&type=TRAILING_STOP_MARKET&quantity=${stopqt}&timestamp=${timestamp}`;
//         let signature = crypto.HmacSHA256(queryString, apiSecret)
//         let response = await instance.post(`/order?${queryString}&signature=${signature}`)
//         console.log("Set stop lose successfully")
//     } catch (error) {
//         console.log(error, "Stop loss error");
//     }
// }

setInterval(() => {
    fetchCoinsFromServer()
}, 25000);

// checkOpen('HIFIUSDT');