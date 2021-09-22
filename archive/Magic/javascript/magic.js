// Copyright (c) 2018 p5ble
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

// The serviceUuid must match the serviceUuid of the device you would like to connect
const serviceUuid = "2A5A20B9-0000-4B9C-9C69-4975713E0FF2";
let accelerationCharacteristic;
let ax = 0, ay = 0, az = 0;
let count = 0;
let myBLE;
let wait = ms => new Promise((r, j) => setTimeout(r, ms));
//let movements;
let spells = {};
//let spellName;
//let spellTrainedAttempts;
//let spellStorage = window.localStorage;
//let isConnected = false;
//let state = 'idle';
let motionBuffer;

function preload() {

  // let url = 'http://127.0.0.1:8080/spells/spells.json';
  // spells = loadJSON(url);
  console.log(spells);
}

function setup() {
  // Create a p5ble class
  myBLE = new p5ble();

  //create ring buffer (100 IMU measurements, 3 measures (X,Y,Z), for 2 seconds)
  motionBuffer = new CircularBuffer(100 * 2 * 3);

  // createCanvas(200, 200);
  // background("#FFF");
  // textSize(16);

  select('#btnTrain').mousePressed(collectTrainingData);
  select('#connectButton').mousePressed(connectAndStartNotify);
}

function download(content, fileName, contentType) {
  let a = document.createElement("a");
  let file = new Blob([content], { type: contentType });
  a.href = URL.createObjectURL(file);
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function collectTrainingData() {

  console.log("collectTrainingData");

  // Check if myBLE is connected
  let isConnected = myBLE.isConnected();

  if (isConnected == false) {
    return;
  }

  let spellName = txtSpellName.value;
  console.log(spellName);

  let SpellAttempt = selectSpellAttempt.value;
  console.log(SpellAttempt);

  console.log("countdown");
  btnTrain.innerHTML = "Get Ready";
  await wait(1000);
  btnTrain.innerHTML = "3";
  await wait(1000);
  btnTrain.innerHTML = "2";
  await wait(1000);
  btnTrain.innerHTML = "1";
  await wait(1000);
  btnTrain.innerHTML = "Move Wand";
  //state = "train";
  await wait(2000);
  //state = "idle";
  btnTrain.innerHTML = "STOP";

  //create object with letiable keys
  let wandMovements = motionBuffer.toArray();

  console.log(wandMovements);

  let spellTraining = {};
  spellTraining.spellAttempt = SpellAttempt;
  spellTraining.wandMovements = wandMovements;

  addSpell(spells, spellName, spellTraining);

  //movements = new Array();
  console.log(spells);

  // console.log(movements.length);
  // console.log(JSON.stringify(movements));

  //localStorage.setItem(spellName, JSON.stringify(movements));
};

function addSpell(spells, key, value) {
  if (!spells[key]) {
    // Create 1-element array with this value.
    spells[key] = [value];
  }
  else {
    // Append element to existing array.
    spells[key].push(value);
  }
}

btnSaveToFile.onclick = function () {

  console.log("btnSaveToFile.onclick");

  console.log(JSON.stringify(spells));

  download(JSON.stringify(spells), 'spells.json', 'text/plain');
};

function connectAndStartNotify() {
  // Connect to a device by passing the service UUID
  myBLE.connect(serviceUuid, gotCharacteristics);
}

// A function that will be called once got characteristics
function gotCharacteristics(error, characteristics) {
  if (error) {
    console.log('error: ', error);
    return;
  }

  console.log(characteristics);

  accelerationCharacteristic = characteristics[0];
  // Set datatype to 'custom', p5.ble.js won't parse the data, will return data as it is.
  myBLE.startNotifications(accelerationCharacteristic, handleAcceleration, 'string'); //'custom');
  console.log("accelerationCharacteristic");

}

const factor = 0.0000152590218966964;

// A function that will be called once got characteristics
function handleAcceleration(data) {

  //console.log(data);

  let lines = data.trim().split("\n");
  let ax = 0;
  let ay = 0;
  let az = 0;
  let normalizedAx = 0;
  let normalizedAy = 0;
  let normalizedAz = 0;

  lines.forEach(element => {
    let measurements = element.split(",");

    ax = measurements[0];
    ay = measurements[1];
    az = measurements[2];

    //https://stats.stackexchange.com/questions/70801/how-to-normalize-data-to-0-1-range
    normalizedAx = (ax - (-32768)) * factor;
    normalizedAy = (ay - (-32768)) * factor;
    normalizedAz = (az - (-32768)) * factor;

    //console.log('Acceleration X: %s\tAcceleration Y: %s\tAcceleration Z: %s', normalizedAx, normalizedAy, normalizedAz);

    motionBuffer.push(normalizedAx);
    motionBuffer.push(normalizedAy);
    motionBuffer.push(normalizedAz);
  });

  let lbl = document.getElementById('lblAcceleration');

  lbl.innerHTML =
    'Acceleration X: ' + normalizedAx + '</BR>' +
    'Acceleration Y: ' + normalizedAy + '</BR>' +
    'Acceleration Z: ' + normalizedAz + '</BR>';
}


//function draw() {

  // let lbl = document.getElementById('lblAcceleration');

  // background(255);
  // text(`Acceleration X: ${ax}`, 100, 50);
  // text(`Acceleration Y: ${ay}`, 100, 100);
  // text(`Acceleration Z: ${az}`, 100, 150);

  // text(`Gyroscope X: ${gx}`, 100, 250);
  // text(`Gyroscope Y: ${gy}`, 100, 300);
  // text(`Gyroscope Z: ${gz}`, 100, 350);

  // //gx - rotation around long axis
  // //gy - movement up and down
  // //gz - movement left and right

  // let x = (width / 2) + ax;
  // let y = (height / 2) + ay;
  // let z = az;

  // ellipse(x, y, 10, 20, z);
//}

