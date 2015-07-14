angular.module('classeur.optional.markdownSample', [])
	.directive('clMarkdownSample',
		function($templateCache) {
			return {
				restrict: 'E',
				templateUrl: 'optional/markdownSample/markdownSample.html',
				link: link
			};

			function link(scope) {
				scope.markdownSample = $templateCache.get('optional/markdownSample/markdownSample.md');
			}
		});
