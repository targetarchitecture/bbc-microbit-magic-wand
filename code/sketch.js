// https://lancaster-university.github.io/microbit-docs/resources/bluetooth/bluetooth_profile.html
const ACCELEROMETER_SERVICE_UUID = "e95d0753-251d-470a-a062-fa1922dfa9a8";
const ACCELEROMETER_DATA_UUID = "e95dca4b-251d-470a-a062-fa1922dfa9a8";
const ACCELEROMETER_PERIOD_UUID = "e95dfb24-251d-470a-a062-fa1922dfa9a8";

const UARTSERVICE_SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const UART_RX_CHARACTERISTIC_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";

let uBitDevice;
let UARTRXcharacteristic;
let UARTservice;
let server;
let microbit = null;
let state = '';
let model;
let numberOfEvents = 0;
let spellSentToMicrobit = -1;
let maxConfidence = 0;
let confidenceForWand = 0;

//create ring buffer (50 IMU measurements, 3 measures (X,Y,Z), for 2 seconds)
let motionBuffer = new CircularBuffer(50 * 3 * 2);

let wait = ms => new Promise((r, j) => setTimeout(r, ms));

let db;
let indexedDBOpening = window.indexedDB.open("magic", 2);

document.getElementById("connectWand").addEventListener("click", connectWand);
document.getElementById("newSpell").addEventListener("click", newSpell);
document.getElementById("disconnectWand").addEventListener("click", disconnectButtonPressed);
document.getElementById("learnSpell").addEventListener("click", learnSpell);
document.getElementById("trainNeuralNetwork").addEventListener("click", trainNeuralNetwork);
document.getElementById("performMagic").addEventListener("click", performMagic);

function normalize(val, max, min) { return (val - min) / (max - min); }

function trainNeuralNetwork() {

    console.log('trainNeuralNetwork');
    document.getElementById('performMagic').disabled = true;

    state = 'training';

    if (microbit !== null) {

        let wandTime = motionBuffer.max();  //Number of readings (100 IMU measurements, 3 measures (X,Y,Z), for 2 seconds)  
        let numberOfSpells = document.getElementById("spellList").length; //Number of spells for the model

        let options = {
            inputs: wandTime,
            outputs: numberOfSpells,
            task: 'classification',
            debug: true
        }

        console.log(options);

        model = ml5.neuralNetwork(options);

        console.log('ml5 version:', ml5.version);

        console.log('load movements');

        let tx = db.transaction("movements", "readonly");
        let store = tx.objectStore("movements");
        let index = store.index("microbit");

        //go through all of the rows for this wand
        let request = index.openCursor(IDBKeyRange.only(microbit));

        request.onsuccess = function () {
            let cursor = request.result;

            if (cursor) {

                console.log(cursor);

                //add training data
                let wandMovements = cursor.value.wandMovements;
                let targetSpell = [cursor.value.spell];

                model.addData(wandMovements, targetSpell);

                cursor.continue();
            } else {
                // No more matching records.
                console.log('no more movements');

                console.log(model);

                //train the model
                //state = 'training';
                console.log('starting training');

                let trainingOptions = {
                    //batchSize: motionBuffer.max(),
                    epochs: 200
                }
                model.train(trainingOptions, whileTraining, finishedTraining);
            }
        };

        console.log('down here already');

    } else {
        console.log('loadAndTrainModel not training as Microbit not connected');
    }
}

function whileTraining(epoch, loss) {
    //console.log(epoch);
}

function finishedTraining() {
    console.log('finished training.');

    document.getElementById('performMagic').disabled = false;
}

function performMagic() {
    state = 'performing';
    doMagic();
}

function doMagic() {
    if (state == 'performing') {
        model.classify(motionBuffer.toArray(), handleResults);
    }
}

// Step 9: define a function to handle the results of your classification
function handleResults(error, results) {
    if (error) {
        console.error(error);
        return;
    }

    maxConfidence = Math.max(maxConfidence, results[0].confidence.toFixed(2));

    document.getElementById('classifyData').innerHTML = `label:${results[0].label}, confidence: ${results[0].confidence.toFixed(2)}, max confidence ${maxConfidence}`;

    if (Math.round(results[0].confidence) * 100 > confidenceForWand) {
        
        if (spellSentToMicrobit != results[0].label) {
            sendMsgtoToMicrobit(results[0].label);
            spellSentToMicrobit = results[0].label;
        }
    }

    doMagic();
}

indexedDBOpening.onerror = function (event) {
    console.error("Database error: " + event.target.errorCode);
};

indexedDBOpening.onsuccess = function (event) {
    db = event.target.result;

    console.log('database now available');
};

indexedDBOpening.onupgradeneeded = function (event) {

    let upgradedb = event.target.result;

    let spells = upgradedb.createObjectStore('spells', { keyPath: 'id', autoIncrement: true });
    spells.createIndex('microbit', 'microbit', { unique: false });

    let movements = upgradedb.createObjectStore('movements', { keyPath: 'id', autoIncrement: true });
    movements.createIndex('microbit', 'microbit', { unique: false });
    movements.createIndex('multi', ['microbit', 'spell', 'lesson'], { unique: false });

};

function populateSpellList(selectedSpellId) {

    if (microbit !== null) {

        console.log('populateSpellList');

        document.getElementById("spellList").innerHTML = "";

        let tx = db.transaction("spells", "readonly");
        let store = tx.objectStore("spells");
        let index = store.index("microbit");

        let request = index.openCursor(IDBKeyRange.only(microbit));
        request.onsuccess = function () {
            let cursor = request.result;
            if (cursor) {

                let listItem = document.createElement('option');
                listItem.value = cursor.value.id;
                listItem.innerHTML = cursor.value.name;

                if (selectedSpellId == cursor.value.id) {
                    listItem.selected = true;
                }

                document.getElementById("spellList").appendChild(listItem);

                cursor.continue();
            } else {
                // No more matching records.
            }
        };
    } else {
        console.log('populateSpellList not displaying as Microbit not connected');
    }
}



function newSpell() {

    let newSpellName = document.getElementById("newSpellName").value;

    let spell = { microbit: microbit, name: newSpellName };

    db.transaction("spells", "readwrite").objectStore("spells").add(spell).onsuccess = function (event) {

        let spellId = event.target.result;
        console.log("new spell id " + spellId);

        document.getElementById("newSpellName").value = "";

        populateSpellList(spellId);
    };

}

async function connectWand() {

    try {
        console.log("Requesting Bluetooth Microbit Device...");

        uBitDevice = await navigator.bluetooth.requestDevice({
            filters: [{ namePrefix: "BBC micro:bit" }],
            optionalServices: [ACCELEROMETER_SERVICE_UUID, UARTSERVICE_SERVICE_UUID]
        });

        let regexpBBC = /\[(.*)\]/;
        let match = uBitDevice.name.match(regexpBBC);

        microbit = `${match[1]}`;

        document.getElementById('nameOfWand').innerHTML = `Your wand is called ${microbit}`;

        // e.g. BBC micro:bit [votiv]
        console.log(`Connected to ${microbit}`); // "Connected to " + uBitDevice.name);

        console.log("Connecting to GATT Server...");
        server = await uBitDevice.gatt.connect();

        console.log("Getting Accelerometer Service...");
        let XYZservice = await server.getPrimaryService(ACCELEROMETER_SERVICE_UUID);

        // console.log("Getting Accelerometer Period...");
        // let Periodcharacteristic = await XYZservice.getCharacteristic(ACCELEROMETER_PERIOD_UUID);

        //Determines the frequency with which accelerometer data is reported in milliseconds.
        //Valid values are 1, 2, 5, 10, 20, 80, 160 and 640
        //10 = 100 messages per second (this is the same as ESP32 BLE based wand) 
        //  Periodcharacteristic.writeValueWithoutResponse(new Uint16Array([10]));
        //  console.log("Accelerometer Period Updated to 10ms.");

        console.log("Getting Accelerometer Characteristics...");
        let XYZcharacteristic = await XYZservice.getCharacteristic(ACCELEROMETER_DATA_UUID);

        XYZcharacteristic.startNotifications();
        XYZcharacteristic.addEventListener("characteristicvaluechanged", onAccelerometerValueChanged);

        console.log("Getting UART Service...");
        UARTservice = await server.getPrimaryService(UARTSERVICE_SERVICE_UUID);

        console.log("Getting UART Characteristics...");
        UARTRXcharacteristic = await UARTservice.getCharacteristic(UART_RX_CHARACTERISTIC_UUID);

        //set event start time
        setInterval(eventTiming, 1000);

        document.getElementById('newSpellName').disabled = false;
        document.getElementById('newSpell').disabled = false;
        document.getElementById('learnSpell').disabled = false;
        document.getElementById('disconnectWand').disabled = false;
        document.getElementById('trainNeuralNetwork').disabled = false;
        document.getElementById('connectWand').disabled = true;

        populateSpellList();

        console.log('leaving connectWand');

    } catch (error) {
        console.log(error);
    }
}


function disconnectButtonPressed() {
    if (!uBitDevice) {
        return;
    }

    if (uBitDevice.gatt.connected) {
        uBitDevice.gatt.disconnect();
        console.log("Disconnected");

        document.getElementById('nameOfWand').innerHTML = `Thanks for training and putting ${microbit} back safely`;

        document.getElementById('newSpellName').disabled = true;
        document.getElementById('newSpell').disabled = true;
        document.getElementById('learnSpell').disabled = true;
        document.getElementById('disconnectWand').disabled = true;
        document.getElementById('trainNeuralNetwork').disabled = true;
        document.getElementById('connectWand').disabled = false;
    }
}

function eventTiming() {
    //console.log()
    document.getElementById('eventTimingInfo').innerHTML = `Number of bluetooth events per second: ${numberOfEvents}. ${Math.ceil(1000 / numberOfEvents)}ms frequency`;
    numberOfEvents = 0;
}

function onAccelerometerValueChanged(event) {

    //const range = 2048;
    const range = 1023;

    // Retrieve acceleration values
    let accelerationX = event.target.value.getInt16(0, true);
    let accelerationY = event.target.value.getInt16(2, true);
    let accelerationZ = event.target.value.getInt16(4, true);

    let normalizedAx = normalize(accelerationX, range, -1 * range);
    let normalizedAy = normalize(accelerationY, range, -1 * range);
    let normalizedAz = normalize(accelerationZ, range, -1 * range);

    motionBuffer.push(normalizedAx);
    motionBuffer.push(normalizedAy);
    motionBuffer.push(normalizedAz);

    numberOfEvents = numberOfEvents + 1;

    document.getElementById('accelerationData').innerHTML = `Acceleration X: ${normalizedAx}</BR>Acceleration Y: ${normalizedAy}</BR>Acceleration Z: ${normalizedAz}`;

    //document.getElementById('accelerationData').innerHTML = `Acceleration X: ${accelerationX}</BR>Acceleration Y: ${accelerationY}</BR>Acceleration Z: ${accelerationY}`;
}

function sendMsgtoToMicrobit(msg) {
    let encoder = new TextEncoder('utf-8');
    let message = encoder.encode(msg + '\n');
    UARTRXcharacteristic.writeValueWithoutResponse(message);
    console.log("sent '" + msg + "' to microbit");
}

async function learnSpell() {

    state = 'learning';

    //let spellName = document.getElementById("spellList").text;
    let spellId = document.getElementById("spellList").value;
    let lessonId = document.getElementById("selectSpellLesson").value;

    console.log("countdown, spell " + spellId + " , lesson " + lessonId);

    learnMessage.innerHTML = "Get Ready";
    await wait(1000);
    learnMessage.innerHTML = "3";
    await wait(1000);
    learnMessage.innerHTML = "2";
    await wait(1000);
    learnMessage.innerHTML = "1";
    await wait(1000);
    learnMessage.innerHTML = "Move Wand";

    await wait(2000);

    //create object 
    let wandMovements = motionBuffer.toArray();

    learnMessage.innerHTML = "STOP";

    console.log(wandMovements);

    console.log('delete first');

    //delete existing wand movements for the spell and lesson
    let tx = db.transaction("movements", "readwrite");
    let store = tx.objectStore("movements");
    let index = store.index("multi");

    let request = index.openCursor(IDBKeyRange.only([microbit, spellId, lessonId]));

    request.onsuccess = function () {
        let cursor = request.result;
        if (cursor) {

            cursor.delete();

            cursor.continue();
        } else {
            // No more matching records.
        }
    };

    console.log('create later');

    let dbMovement = {};
    dbMovement.microbit = microbit;
    dbMovement.spell = spellId;
    dbMovement.lesson = lessonId;
    dbMovement.wandMovements = wandMovements;

    console.log(dbMovement);

    db.transaction("movements", "readwrite").objectStore("movements").add(dbMovement).onsuccess = function (event) {
        console.log("movement id " + event.target.result);
    }
}


// Update the current slider value (each time you drag the slider handle)
let slider = document.getElementById("myRange");

slider.oninput = function () {
    confidenceForWand = this.value;
    document.getElementById("lblConfidence").innerHTML = confidenceForWand;
}