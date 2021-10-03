# signalk-geekworm-x728  
SignalK Node Server Plugin for Geekworm X728 UPS & Power Management Board for Raspberry Pi.  

This plugin periodically queries the X728 power management board via i2c bus and then publishes the battery voltage and battery capacity as SignalK delta messages.  Additionally, the external power state is communciated on a SignalK notification path.  When a loss of external power is detected, an alert is generated on the notfication path.

### Geekworm x728
https://geekworm.com/products/raspberry-pi-x728-max-5-1v-8a-18650-ups-power-management-board  

## Release Notes  
1.0.0 - Initial
1.1.0 - Add notification of external power loss
