# bbc-microbit-magic-wand

The project uses ML5JS (ml5js.org) to create a neural network that takes real time motion from the IMU/acceleramter on a BBC Microbit. The wand movements on the microbit are transmitted over Bluetooth to a nearby computer. The computer is running Chrome browser with the experimental Web Blueooth API enabled.

IMU X,Y,Z measurements are captured at 50Hz

HTML5, P5JS and ML5JS are used to receive the wand motions, these are added to a ring buffer capable of holding 2 seconds of motion - which is estimated size for each spell. The ring buffer is constantly updated with the wand motion, which is then sent to the neural network for classification.
