/*
 * Copyright 2021 tyson colby <tyson.colby@innotech.engineering>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const I2C = require('i2c-bus')
const X728_ADDR = 0x36
const VOLTAGE_REG = 0x2
const CAPACITY_REG = 0x4

module.exports = function(app) {
    let timer = null;
    let plugin = {};

    plugin.id = 'signalk-raspberry-pi-x728';
    plugin.name = 'Raspberry Pi x728 UPS';
    plugin.description = 'Geekworm x728 UPS & Power Managment Board for Raspberry Pi';

    plugin.schema = {
        type: 'object',
        properties: {
            rate: {
                title: "Reporting rate (seconds)",
                type: 'number',
                default: 30
            },
            path_voltage: {
                type: 'string',
                title: 'SignalK path for battery voltage',
                default: 'environment.rpi.battery.voltage'
            },
            path_capacity: {
                type: 'string',
                title: 'SignalK path for battery capacity',
                default: 'environment.rpi.battery.capacity'
            },
            i2c_bus: {
                type: 'integer',
                title: 'I2C bus number',
                default: 1,
            },
            i2c_address: {
                type: 'string',
                title: 'I2C address',
                default: '0x36',
            },
        }
    };

    plugin.start = function(options) {
        function readX728() {
            // open the i2c bus
            i2c = I2C.open(options.i2c_bus || 1, (err) => {
                if (err) app.error(err);
            });

            // read and publish battery voltage
            i2c.readWord(Number(options.i2c_address) || X728_ADDR, VOLTAGE_REG, (err, rawData) => {
                if (err) app.error(err);
                rawData = (rawData >> 8) + ((rawData & 0xff) << 8);
                let voltage = (rawData * 1.25 / 1000 / 16).toFixed(2);
                app.debug(`battery voltage: ${voltage} VDC`);
                app.handleMessage(plugin.id, {
                    updates: [{
                        values: [{
                            path: options.path_voltage,
                            value: voltage
                        }]
                    }]
                });
            });

            // read and publish battery charge capacity
            i2c.readWord(Number(options.i2c_address) || X728_ADDR, CAPACITY_REG, (err, rawData) => {
                if (err) app.error(err);
                rawData = (rawData >> 8) + ((rawData & 0xff) << 8);
                let capacity = (rawData / 256).toFixed(1);
                app.debug(`battery capacity: ${capacity} %`);
                app.handleMessage(plugin.id, {
                    updates: [{
                        values: [{
                            path: options.path_capacity,
                            value: capacity
                        }]
                    }]
                });
            });

            // close the i2c bus
            i2c.close((err) => {
                if (err) app.error(err);
            });
        }

        // set the timer to execute reads of the i2c bus and publish signalk delta messages
        timer = setInterval(readX728, options.rate * 1000);
    }

    plugin.stop = function() {
        if (timer) {
            clearInterval(timer);
            timeout = null;
        }
    }

    return plugin
}