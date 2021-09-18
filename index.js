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
const Gpio = require('onoff').Gpio;

const X728_ADDR = 0x36
const VOLTAGE_REG = 0x2
const CAPACITY_REG = 0x4

module.exports = function(app) {
    let timer = null;
    let plugin = {};

    plugin.id = 'signalk-geekworm-x728';
    plugin.name = 'Geekworm X728 UPS';
    plugin.description = 'Geekworm X728 UPS & Power Managment Board for Raspberry Pi';

    plugin.schema = {
        type: 'object',
        properties: {
            rate: {
                type: 'number',
                title: "Reporting rate (seconds)",
                default: 10
            },
            path_voltage: {
                type: 'string',
                title: 'SignalK path for battery voltage',
                default: 'electrical.batteries.rpi.voltage'
            },
            path_capacity: {
                type: 'string',
                title: 'SignalK path for battery capacity',
                default: 'electrical.batteries.rpi.capacity.stateOfCharge'
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

    const error = function(err) {
        app.error(err);
        app.setPluginError(err.message)
    }

    plugin.start = function(options) {
        // app.handleMessage(plugin.id, {
        //     updates: [{
        //         values: [{
        //             path: "notifications.electrical.x728.status",
        //             value: {
        //                 method: [
        //                     "visual",
        //                     "sound"
        //                 ],
        //                 state: "alert",
        //                 message: "External power loss; Running on battery."
        //             }
        //         }]
        //     }]
        // });

        // external power loss notification
        const ext_power = new Gpio(6, 'in', 'both', {
            debounceTimeout: 100
        });
        ext_power.watch((err, externalPowerLoss) => {
            if (err) {
                error(err);
            } else {
                let delta = {
                    updates: [{
                        values: [{
                            path: "notifications.electrical.x728.status",
                            value: {
                                method: [
                                    "visual",
                                    "sound"
                                ],
                                state: "",
                                message: ""
                            }
                        }]
                    }]
                };
                let state = delta.updates[0].values[0].value.state;
                let message = delta.updates[0].values[0].value.message;
                if (externalPowerLoss) {
                    // external power loss
                    app.debug("external power loss.  running on battery.");
                    state = "alert";
                    message = "External power loss; Running on battery.";
                    app.handleMessage(plugin.id, delta);
                } else {
                    // external power restored
                    app.debug("external power restored. battery charging.");
                    state = "normal";
                    message = "External power restored; Charging battery.";
                    app.handleMessage(plugin.id, delta);
                }
            }
        });

        // notify server, once, of metadata in case use of non-conventional sigk paths
        app.handleMessage(plugin.id, {
            updates: [{
                meta: [{
                        path: options.path_voltage,
                        value: {
                            units: "V"
                        }
                    },
                    {
                        path: options.path_capacity,
                        value: {
                            units: "ratio"
                        }
                    }
                ]
            }]
        });

        function readX728() {
            // open the i2c bus
            i2c = I2C.open(options.i2c_bus || 1, (err) => {
                if (err) error(err)
            });

            // read and publish battery voltage
            i2c.readWord(Number(options.i2c_address) || X728_ADDR, VOLTAGE_REG, (err, rawData) => {
                if (err) error(err);
                rawData = (rawData >> 8) + ((rawData & 0xff) << 8);
                let voltage = rawData * 1.25 / 1000 / 16;
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
                if (err) error(err);
                rawData = (rawData >> 8) + ((rawData & 0xff) << 8);
                let capacity = rawData / 256 / 100;
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
                if (err) error(err);
            });
        }

        // initialize with some data immediately when the plugin starts
        readX728();
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