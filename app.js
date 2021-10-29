const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');

let settings = {
  areModulesLoaded: false,
  pathToCscalpFolder: false,
};

const updateSettings = () => {
  fs.writeFileSync('settings.json', JSON.stringify(settings));
};

if (fs.existsSync('settings.json')) {
  settings = fs.readFileSync('settings.json', 'utf8');
  settings = JSON.parse(settings);
} else {
  fs.writeFileSync('settings.json', JSON.stringify(settings));
}

if (!settings.areModulesLoaded) {
  execSync('npm i --loglevel=error');
  settings.areModulesLoaded = true;
  updateSettings();
}

const xml2js = require('xml2js');

const {
  getExchangeInfo,
} = require('./binance/get-exchange-info');

const {
  getInstrumentsPrices,
} = require('./binance/get-instruments-prices');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

let depositForCalculate = false;

const start = async () => {
  if (!settings.pathToCscalpFolder) {
    return askQuestion('whereCScalpFolder');
  }

  const pathToSettingsFolder = `${settings.pathToCscalpFolder}\\SubApps\\CScalp\\Data\\MVS`;

  if (!fs.existsSync(pathToSettingsFolder)) {
    console.log('Не нашел папку с настройками cscalp');
    return askQuestion('whereCScalpFolder');
  }

  if (!depositForCalculate) {
    return askQuestion('depositForCalculate');
  }

  const resultGetExchangeInfo = await getExchangeInfo();

  if (!resultGetExchangeInfo || !resultGetExchangeInfo.status) {
    console.log(resultGetExchangeInfo.message || 'Cant resultGetExchangeInfo');
    return false;
  }

  const resultGetInstrumentsPrices = await getInstrumentsPrices();

  if (!resultGetInstrumentsPrices || !resultGetInstrumentsPrices.status) {
    console.log(resultGetInstrumentsPrices.message || 'Cant resultGetInstrumentsPrices');
    return false;
  }

  const exchangeInfo = resultGetExchangeInfo.result;
  const instrumentsPrices = resultGetInstrumentsPrices.result;

  const filesNames = fs.readdirSync(pathToSettingsFolder);

  const workAmounts = [];

  for (let i = 1; i < 6; i += 1) {
    workAmount.push(Math.floor(depositForCalculate * i));
  }

  await Promise.all(exchangeInfo.symbols.map(async symbol => {
    const symbolName = symbol.symbol;

    if (!symbol.filters || !symbol.filters.length || !symbol.filters[2].stepSize) {
      console.log(`Cant find stepSize for instrument; symbol: ${symbolName}`);
      return null;
    }

    const instrumentPriceDoc =  instrumentsPrices.find(doc => doc.symbol === symbolName);

    if (!instrumentPriceDoc) {
      console.log(`Cant find price for instrument; symbol: ${symbolName}`);
      return null;
    }

    const result = [];
    const stepSize = parseFloat(symbol.filters[2].stepSize);
    const instrumentPrice = parseFloat(instrumentPriceDoc.price);

    const result = workAmounts.map(workAmount => {
      let tmp = workAmount / instrumentPrice;

      if (tmp < stepSize) {
        tmp = stepSize;
      } else {
        const remainder = tmp % stepSize;

        if (remainder !== 0) {
          tmp -= remainder;

          if (tmp < stepSize) {
            tmp = stepSize;
          }
        }
      }

      return tmp.toFixed(3).toString().replace('.', ',');
    });

    filesNames.forEach(async fileName => {
      if (!fileName.includes(symbolName)) {
        return true;
      }

      if (!fileName.includes(`CCUR_FUT.${symbolName}`)) {
        return true;
      }

      const fileContent = fs.readFileSync(`${pathToSettingsFolder}/${fileName}`, 'utf8');
      const parsedContent = await xml2js.parseStringPromise(fileContent);

      parsedContent.Settings.TRADING[0].First_WorkAmount[0].$.Value = result[0];
      parsedContent.Settings.TRADING[0].Second_WorkAmount[0].$.Value = result[1];
      parsedContent.Settings.TRADING[0].Third_WorkAmount[0].$.Value = result[2];
      parsedContent.Settings.TRADING[0].Fourth_WorkAmount[0].$.Value = result[3];
      parsedContent.Settings.TRADING[0].Fifth_WorkAmount[0].$.Value = result[4];

      const builder = new xml2js.Builder();
      const xml = builder.buildObject(parsedContent);
      fs.writeFileSync(`${pathToSettingsFolder}/${fileName}`, xml);
    });

    console.log(`Ended ${symbolName}`);
  }));

  console.log('Process was finished');
};

const askQuestion = (nameStep) => {
  if (nameStep === 'whereCScalpFolder') {
    rl.question('Укажите полный путь к папке cscalp\n', userAnswer => {
      if (!userAnswer) {
        console.log('Вы ничего не ввели');
        return askQuestion('whereCScalpFolder');
      }

      if (!fs.existsSync(userAnswer)) {
        console.log('Не нашел папку');
        return askQuestion('whereCScalpFolder');
      }

      settings.pathToCscalpFolder = userAnswer;
      updateSettings();

      return start();
    });
  }

  if (nameStep === 'depositForCalculate') {
    rl.question('Введите ваш депозит\n', userAnswer => {
      if (!userAnswer) {
        console.log('Вы ничего не ввели');
        return askQuestion('depositForCalculate');
      }

      if (!isNumber(userAnswer)
        || Number.isNaN(userAnswer)
        || userAnswer < 0) {
          console.log('Невалидные данные');
          return askQuestion('depositForCalculate');
      }

      depositForCalculate = parseFloat(userAnswer);
      return start();
    });
  }
};

start();
