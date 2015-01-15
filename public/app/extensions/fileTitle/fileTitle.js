angular.module('classeur.extensions.fileTitle', [])
	.directive('clFileTitle', function() {

		return {
			restrict: 'E',
			templateUrl: 'app/extensions/fileTitle/fileTitle.html'
		};
	});
