const axios = require('axios');

const getInstrumentsPrices = async () => {
  const responseGetData = await axios({
    method: 'get',
    url: 'https://fapi.binance.com/fapi/v1/ticker/price',
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
  getInstrumentsPrices,
};
