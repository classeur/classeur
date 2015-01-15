angular.module('classeur.core.user', [])
	.factory('clUserSvc', function(clUid, clSettingSvc) {
		clSettingSvc.setDefaultValue('defaultUserName', 'Anonymous');

		var clUserSvc = {
			localId: clUid()
		};
		return clUserSvc;
	});
