const axios = require('axios');

const getExchangeInfo = async () => {
  const responseGetData = await axios({
    method: 'get',
    url: 'https://fapi.binance.com/fapi/v1/exchangeInfo',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return {
    status: true,
    result: responseGetData.data,
  };
};

module.exports = {
  getExchangeInfo,
};
