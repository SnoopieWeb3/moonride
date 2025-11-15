const WebSocket = require('ws');
const tf = require('@tensorflow/tfjs');
const { delayFor } = require('./utils');

const normalize = (data) => {
    const min = Math.min(...data);
    const max = Math.max(...data);
    const normalized = data.map(x => (x - min) / (max - min));
    return { normalized, min, max };
}

const denormalize = (data, min, max) => {
    return data.map(x => x * (max - min) + min);
}

const createTensors = (data) => {
    const xs3d = data.map(v => [v]);
    const xsTensor = tf.tensor3d([xs3d]);
    const ysTensor = tf.tensor2d([[data[data.length - 1]]]);
    

    return [xsTensor, ysTensor];
}

const trainModel = async (xs, ys) => {
    const timeSteps = xs.shape[1];

    const model = tf.sequential();
    model.add(tf.layers.lstm({ units: 50, inputShape: [timeSteps, 1] }));
    model.add(tf.layers.dense({ units: 1 }));
    model.compile({ loss: 'meanSquaredError', optimizer: 'adam' });

    await model.fit(xs, ys, { epochs: 5 });
    return model;
}

const padToLength = (arr, targetLength) => {
    const padded = [...arr];
    while (padded.length < targetLength) {
        padded.push(0); // pad with zeros
    }
    if (padded.length > targetLength) {
        return padded.slice(0, targetLength);
    }
    return padded;
}

const predictNext = async (model, lastWindow, nSteps) => {
    let input = lastWindow;
    const predictions = [];

    for (let i = 0; i < nSteps; i++) {
        const predTensor = model.predict(input.reshape([1, input.shape[0], 1]));
        const predVal = (await predTensor.data())[0];
        predictions.push(predVal);
        input = input.slice(1);
        input = input.concat(tf.tensor1d([predVal]));
    }

    return predictions;
}

const trainAndPredict = async (pricesRaw, timestampsRaw, pricesList, symbol) => {

    const { normalized: normalizedTrain, min, max } = normalize(pricesRaw);

    const [xs, ys] = createTensors(normalizedTrain);

    const model = await trainModel(xs, ys);

    await delayFor(5000);

    let priceData = pricesList[symbol];

    const { normalized: normalizedNewPrices } = normalize(priceData.map(x => x.price));

    const paddedNewPrices = padToLength(normalizedNewPrices.slice(0, 15), normalizedTrain.length);

    const initialWindow = tf.tensor1d(paddedNewPrices);

    const predNorm = await predictNext(model, initialWindow, 45);

    const predPrices = denormalize(predNorm, min, max);

    let newTimestamps = priceData.map((x) => x.timestamp);

    const baseTimestamps = newTimestamps && newTimestamps.length > 0 ? newTimestamps : timestampsRaw;

    const intervals = [];

    for (let i = 1; i < baseTimestamps.length; i++) {
        intervals.push(baseTimestamps[i] - baseTimestamps[i - 1]);
    }
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;

    const lastTimestamp = baseTimestamps[baseTimestamps.length - 1];

    const predTimestamps = [];

    for (let i = 1; i <= 45; i++) {
        predTimestamps.push(lastTimestamp + i * avgInterval);
    }

    const outcome = predPrices.map((price, idx) => {
        return {
            price,
            timestamp: predTimestamps[idx]
        };
    });

    return outcome;

}

module.exports = {
    trainAndPredict
}