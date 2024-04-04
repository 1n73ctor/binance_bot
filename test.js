const axios = require('axios');
const crypto = require('crypto-js');

// API keys and secret
const apiKey = 'JPP2bykbIUInBfp9mZ9x2vZEgn6bzjTU8ZkK8rz33PNUlrbeMI1X1H94hVgvkfDm';
const apiSecret = 'xFpP11oflnLgMiUiIsTG16O5V24SEpQziRRLlEFJ6srY9v4fdnIIblebMJD5gd3m';


const baseURL = "https://fapi.binance.com/fapi/v1"

const instance = axios.create({
    baseURL: baseURL,
    headers: { 'X-MBX-APIKEY': apiKey }
});

// const setTrailing = async (symbol) => {
//     try {
//         let timestamp = new Date().getTime();
//         const queryString = `symbol=${symbol}&side=SELL&orderId=3746150909&type=TAKE_PROFIT_MARKET&stopPrice=2&positionSide=LONG&timeInForce=GTE_GTC&closePosition=true&timestamp=${timestamp}`;
//         let signature = crypto.HmacSHA256(queryString, apiSecret)
//         let response = await instance.post(`/order?${queryString}&signature=${signature}`)
//         console.log("SL order successfully added", response)
//     } catch (error) {
//         console.log(error, "stop loss error");
//     }
// }

const setTrailing = async (symbol) => {
    try {
        let timestamp = new Date().getTime();
        const queryString = `symbol=${symbol}&side=SELL&type=STOP_MARKET&stopPrice=1&positionSide=LONG&timeInForce=GTE_GTC&closePosition=true&timestamp=${timestamp}`;
        let signature = crypto.HmacSHA256(queryString, apiSecret)
        let response = await instance.post(`/order?${queryString}&signature=${signature}`)
        console.log("SL order successfully added", response)
    } catch (error) {
        console.log(error, "stop loss error");
    }
}

setTrailing('ARBUSDT')