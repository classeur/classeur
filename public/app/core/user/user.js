angular.module('classeur.core.user', [])
	.factory('user', function(uid, settings) {
		settings.setDefaultValue('defaultUserName', 'Anonymous');

		var user = {
			localId: uid()
		};
		return user;
	});
