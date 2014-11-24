var util = require('util');
var SerialPort = require('serialport').SerialPort;
var xbee_api = require('xbee-api');

var C = xbee_api.constants;

var xbeeAPI = new xbee_api.XBeeAPI({
  api_mode: 1
});

var serialport = new SerialPort('/dev/cu.usbserial-AM01VC4C', {
  baudrate: 9600,
  parser: xbeeAPI.rawParser()
});

serialport.on("open", function() {
    console.log("Serial port open... sending ATDB");
    var frame = {
        type: C.FRAME_TYPE.AT_COMMAND,
        command: "DB",
        commandParameter: [],
    };

    serialport.write(xbeeAPI.buildFrame(frame), function(err, res) {
        if (err)
            throw(err);
        else
            console.log("written bytes: "+util.inspect(res));
    });
});

var timer;
var data = {};

//returns concatenated hex values
function HexBytesToDec(data, start, end){
    var hexBytes = "";
    if(data) {
        for (var i = start; i <= end; i++){
            byte = data[i].toString(16);

            //add padding to byte. e.g. 0 becomes 00
            while (byte.length < 2) {
                byte = "0" + byte;
            }

            hexBytes += byte;
        }
        return parseInt(hexBytes, 16);
    }
    else {
        return;
    }
}

function decode_frame(frame){
    // Sample packet
    // Usage Packet - BD 05 01 00  ( CD AB EF 65 ) 01 FF |  4-byte data, 4-byte clock frequency, 4-byte packet number
    // Sentinel - BD 05 01 00 CD AB EF 65 01 FF (00 00 00 00, 00 00 00 00, 00 00 00 00)4-byte data, 4-byte clock frequency, 4-byte packet number

    if (!frame.data) {
        return;
    }

    // disable timeout event
    clearTimeout(timer); 

    //Get wristbandID
    var wristbandID = HexBytesToDec(frame.data, 4, 7);
    // console.log("Wristband ID: " + wristbandID);

    //Get 4-byte data and 4-byte clock frequency
    var packetData = HexBytesToDec(frame.data, 10, 13);
    var clockFreq = HexBytesToDec(frame.data, 14, 17);

    //pulse count = clock freq / count (data)
    var pulseCount = clockFreq/packetData;

    //TODO - get time from sys clock
    //usage = pulseCount * some variable constant for flow meter * time since last thing
    // var usage = pulseCount * CONSTANT * TIME;

    // check for sentinel packet
    if (packetData == 0 && clockFreq == 0) {

        console.log("Sentinel packet recieved");
        endTransmission(wristbandID);

        return;
    } else {
        //store data in array
        if (!data[wristbandID])
            data[wristbandID] = [];
        data[wristbandID].push(pulseCount);
        console.log("stored data: " + pulseCount + " to wristbandID " + wristbandID);

        // if not sentinel re-enable timer
        timer = setTimeout(function(){endTransmission(wristbandID);}, 5000);
    }
};

// This function gets invoked when no sentinel packet is received at the end of a transmission
function endTransmission(wristbandID) {
    console.log("Transmitting Data")
    var sum = 0;
    for (var index in data[wristbandID]) {
        sum += data[wristbandID][index];
    }
    console.log("Total water usage: " + sum);

    // make db request (aggregate data and send it off)


    //clear in-memory object
    data[wristbandID] = [];
}

// http.createServer(function (req, res) {
//     res.writeHead(200, {'Content-Type': 'text/plain'});
//     res.end(count.toString());
//     clearTimeout(timer);
//     count++;
//     timer = setTimeout(test_function, 5000);
// }).listen(5000);

xbeeAPI.on("frame_object", function(frame) {
    console.log(">>", frame, "<<");
    decode_frame(frame);

});