angular.module('classeur.opt.spinner', [])
	.directive('clSpinner', function() {
		return {
			restrict: 'E',
			scope: true,
			templateUrl: 'opt/spinner/spinner.html'
		};
	});
