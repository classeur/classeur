angular.module('classeur.core.constants', [])
	.factory('clConstants', function($location) {
		var clConstants = {
			googleClientId: '276184199763-tp3t95ddji4pfd6od4h0v14kaqvi8nb7.apps.googleusercontent.com',
			serverUrl: 'http://localhost:11583'
		};

		if($location.host() === 'app.classeur.io') {
			clConstants.serverUrl = 'http://app.classeur.io';
		}
		
		return clConstants;
	});
