angular.module('classeur.core.layoutLight', [])
	.directive('clLayoutLight', function(layout, settings, editor) {

		return {
			restrict: 'E',
			templateUrl: 'app/core/layoutLight/layoutLight.html',
			link: function(scope) {
				scope.layout = layout;
				scope.settings = settings;
				scope.editor = editor;
			}
		};
	});
