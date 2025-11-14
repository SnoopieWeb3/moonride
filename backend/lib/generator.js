const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require("path");
const fs = require("fs");

const marketStore = require("./store");
const { formatAddress } = require("./utils");

try {
    registerFont(path.join(__dirname, 'fonts/Avenue-Mono.ttf'), { family: "Avenue-Mono" });
} catch (error) {
    console.log(error);
}

const roundedImage = (ctx, x, y, width, height, radius) => {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

// Draws a rounded rectangle with centered text
const roundedRectWithText = (ctx, x, y, width, height, radius, boxColor, text, textColor, font = `40px "Avenue-Mono"`) => {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fillStyle = boxColor;
    ctx.fill();
    ctx.font = font;
    ctx.fillStyle = textColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x + width / 2, y + height / 2);
    ctx.restore();
};

const generatePnLCard = async (_data) => {

    const data = { ..._data };

    const colors = marketStore.colors;

    const canvasWidth = 1800;
    const canvasHeight = 1000;

    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');

    let bgFilename;
    if (data.outcome_index === 'won') {
        bgFilename = 'background-won.png';
    } else if (data.outcome_index === 'lost') {
        bgFilename = 'background-lost.png';
    } else {
        bgFilename = 'background-lost.png';
    }

    const bgPath = path.join(__dirname, `assets/${bgFilename}`);
    const bgData = fs.readFileSync(bgPath);
    const bg = await loadImage(bgData);

    ctx.drawImage(bg, 0, 0, canvasWidth, canvasHeight);

    const tokenColor = colors[data.symbol] || '#000000';

    roundedRectWithText(
        ctx,
        78, 180,
        180, 75,
        20,
        tokenColor,
        data.symbol || "BTC",
        '#FFFFFF',
        "40px Avenue-Mono"
    );

    let pnlRaw;

    if (data.outcome_index == "lost") {
        pnlRaw = -100;
    }
    else if (data.outcome_index == "won") {
        pnlRaw = ((parseFloat(data.won) / 1e18) / (parseFloat(data.stake) / 1e18)) * 100;
    }
    else {
        pnlRaw = 0;
    }

    const pnlText = (data.outcome_index != 'won' && data.outcome_index != "lost") ? 'Refunded' : (pnlRaw > 0 ? `+${pnlRaw.toFixed(2)}%` : `${pnlRaw.toFixed(2)}%`);

    ctx.font = '30px Avenue-Mono';
    ctx.fillStyle = '#62687D';
    ctx.textAlign = "left";
    ctx.fillText('PNL', 78, 345);

    ctx.font = '100px Avenue-Mono';
    ctx.fillStyle = (pnlText === 'Refunded') ? '#FFFFFF' : (pnlRaw > 0 ? '#3AA414' : '#D32F2F');
    ctx.fillText(pnlText, 78, 430);

    ctx.font = '30px Avenue-Mono';
    ctx.fillStyle = '#62687D';
    ctx.fillText('Order', 78, 525);

    let userDirection = null;

    if (data.outcome_index == "won") {
        userDirection = data.direction;
    }
    else if (data.outcome_index == "lost") {
        if (data.direction == "MID") {
            userDirection = "--";
        }
        else {
            userDirection = data.direction == "UP" ? "DOWN" : "UP";
        }
    }
    else {
        userDirection = data.direction;
    }

    ctx.font = '45px Avenue-Mono';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(userDirection, 78, 590);

    ctx.font = '30px Avenue-Mono';
    ctx.fillStyle = '#62687D';
    ctx.fillText('Market Resolution', 78, 680);

    ctx.font = '45px Avenue-Mono';
    ctx.fillStyle = '#FFFFFF';
    const resolutionText = data.direction;
    ctx.fillText(resolutionText.charAt(0).toUpperCase() + resolutionText.slice(1), 78, 745);

    roundedRectWithText(
        ctx,
        1130, 883,
        418, 75,
        50,
        `#000000`,
        formatAddress(data.address),
        '#FFFFFF',
        "40px Avenue-Mono"
    );

    return canvas.toBuffer('image/png');
};

module.exports = {
    generatePnLCard
};
