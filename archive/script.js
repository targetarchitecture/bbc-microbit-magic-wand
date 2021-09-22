// https://lancaster-university.github.io/microbit-docs/resources/bluetooth/bluetooth_profile.html
const ACCELEROMETER_SERVICE_UUID = "e95d0753-251d-470a-a062-fa1922dfa9a8";
const ACCELEROMETER_DATA_UUID = "e95dca4b-251d-470a-a062-fa1922dfa9a8";

let uBitDevice;
let sinThetaX = 0;
let sinThetaY = 0;
let lastAccelerationX = 0;
let lastAccelerationY = 0;

function setup() {
  createCanvas(400, 400, WEBGL);

  const connectButton = createButton("Connect");
  connectButton.mousePressed(connectButtonPressed);

  const disconnectButton = createButton("Disconnect");
  disconnectButton.mousePressed(disconnectButtonPressed);
}

function draw() {
  background(0);

  orbitControl();
  translate(0, 0, 0);
  normalMaterial();
  push();
  rotateZ(asin(sinThetaX));
  rotateX(-asin(sinThetaY));
  box(150, 150, 150);
  pop();
}

async function connectButtonPressed() {
  try {
    console.log("Requesting Bluetooth Device...");
    uBitDevice = await navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: "BBC micro:bit" }],
      optionalServices: [ACCELEROMETER_SERVICE_UUID]
    });

    // e.g. BBC micro:bit [votiv]
    console.log("Connected to " + uBitDevice.name);

    console.log("Connecting to GATT Server...");
    const server = await uBitDevice.gatt.connect();

    console.log("Getting Service...");
    const service = await server.getPrimaryService(ACCELEROMETER_SERVICE_UUID);

    console.log("Getting Characteristics...");
    const characteristic = await service.getCharacteristic(
      ACCELEROMETER_DATA_UUID
    );
    characteristic.startNotifications();
    characteristic.addEventListener(
      "characteristicvaluechanged",
      onAccelerometerValueChanged
    );
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
  }
}

function onAccelerometerValueChanged(event) {
  // Retrieve acceleration values,
  // then convert from milli-g (i.e. 1/1000 of a g) to g
  const accelerationX = event.target.value.getInt16(0, true) / 1000.0;
  const accelerationY = event.target.value.getInt16(2, true) / 1000.0;
  const accelerationZ = event.target.value.getInt16(4, true) / 1000.0;

  const smoothedAccelerationX = accelerationX * 0.2 + lastAccelerationX * 0.8;
  const smoothedAccelerationY = accelerationY * 0.2 + lastAccelerationY * 0.8;

  lastAccelerationX = smoothedAccelerationX;
  lastAccelerationY = smoothedAccelerationY;

  sinThetaX = constrain(smoothedAccelerationX, -1, 1);
  sinThetaY = constrain(smoothedAccelerationY, -1, 1);
}
