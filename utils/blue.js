// 低功耗蓝牙广播测试
export function openBle(list) {
	wx.closeBluetoothAdapter({
	  complete: function (res) {
		  console.log('buetoothclose-ble')
	    wx.openBluetoothAdapter({
	    	success: (res) => {
	    		console.info('Bluetooth adapter opened');
	    		console.log('Creating BLEPeripheralServer');
	    		wx.createBLEPeripheralServer({
	    			success: (res) => {
	    				console.info('createBLEPeripheralServer successed', res);
	    				let server = res.server;
	    				console.log(server);
	    				let uuid1 = '0000af8e-0000-1000-8000-00805f9b34fb';
	    				let uuid2 = '0000ae8f-0000-1000-8000-00805f9b34fb';
	    				// let buff = [0x84, 0xe8, 0xa3, 0x3d];
	    				let buff = list;
	    
	    				server.startAdvertising({
	    					advertiseRequest: {
	    						deviceName: '',
	    						connectable: true,
	    						serviceUuids: [
	    							uuid1,
	    							uuid2
	    						],
	    						manufacturerData: [{
	    							manufacturerId: 0x01AC,
	    							manufacturerSpecificData: buff
	    						}]
	    					},
	    					powerLevel:'low'
	    					
	    				}).then(
	    					(res) => {
	    						console.log('Adverstising.. ', res);
	    					},
	    					(res) => {
	    						console.warn('Advertising failed', res);
	    					});
							
	    			},
	    			fail: (res) => {
	    				console.warn('createBLEPeripheralServer failed');
	    			},
	    			complete: (res) => {
	    				console.debug('createBLEPeripheralServer completed');
	    			}
	    		});
	    	},
	    	fail: (res) => {
	    		console.log('openBluetoothAdapter failed');
	    		console.warn(res);
	    	},
	    	complete: (res) => {
	    		console.debug('openBluetoothAdapter completed');
	    	},
	    });
	  }
	})
	
}