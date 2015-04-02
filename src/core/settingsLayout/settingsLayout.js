angular.module('classeur.core.settingsLayout', [])
	.directive('clSettingsLayout', function($location) {
		return {
			restrict: 'E',
			templateUrl: 'core/settingsLayout/settingsLayout.html',
			link: function(scope) {
			}
		};
	});
