angular.module('classeur.extensions.spinner', [])
	.directive('clSpinner', function() {
		return {
			restrict: 'E',
			scope: true,
			templateUrl: 'extensions/spinner/spinner.html'
		};
	});
