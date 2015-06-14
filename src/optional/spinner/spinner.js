angular.module('classeur.optional.spinner', [])
	.directive('clCenteredSpinner', function() {
		return {
			restrict: 'E',
			scope: true,
			template: '<div class="centered spinner"><cl-spinner></cl-spinner></div>'
		};
	})
	.directive('clSpinner', function() {
		return {
			restrict: 'E',
			scope: true,
			template: '<md-progress-circular class="md-accent md-hue-2" md-mode="indeterminate"></md-progress-circular>'
		};
	});
