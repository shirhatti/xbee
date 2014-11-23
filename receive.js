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
var data = [];
data.usage = [];

function decode_frame(frame){
    // Sample packet
    // RFID Packet - BD 05 01 00 CD AB EF 65 01 FF
    // 4-byte data, 4-byte clock frequency, 4-byte packet number

    if (!frame.data) {
        return;
    }

    // disaable timeout event
    clearTimeout(timer); 
    
    // check for sentinel packet
    if (frame.data[0] == 0 && frame.data[1] == 0 && frame.data[2] == 0 && frame.data[3] == 0 && frame.data[4] == 0 && frame.data[5] == 0 && frame.data[6] == 0 && frame.data[7] == 0) {
        console.log("Sentinel reached\n");
        console.log("Wristband ID: " + data.wristbandID);
        for (var index in data.usage) {
            console.log(data.usage[index]);
        }
        // make db request (aggregate data and send it off)

        //clear in-memory object
        data = [];
        data.usage = [];

        return;
    }

    // if not sentinel re-enable timer
    timer = setTimeout(timeout, 5000);


    // Check for RFID packet
    if (frame.data[0] == 189 && frame.data[2] == 1 && frame.data[3] == 0) {
        // Retrieve tag ID from packet
        data.wristbandID = data[4] + '-' + data[5] + '-' + data[6] 
    }

    // Must be a usage packet
    else {
        data.usage.push(frame.data);
    }

};

function timeout() {
    // This function gets invoked when no sentinel packet is received at the end of a transmission

    console.log('***********************');
    console.log('No sentinel received');
    for (var index in data.usage) {
        console.log(data.usage[index]);
    }
    console.log('***********************');

}

// http.createServer(function (req, res) {
//     res.writeHead(200, {'Content-Type': 'text/plain'});
//     res.end(count.toString());
//     clearTimeout(timer);
//     count++;
//     timer = setTimeout(test_function, 5000);
// }).listen(5000);

xbeeAPI.on("frame_object", function(frame) {
    //console.log(">>", frame);
    decode_frame(frame);

});