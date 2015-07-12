angular.module('classeur.optional.markdownSyntax', [])
	.directive('clMarkdownSyntax',
		function($templateCache) {
			return {
				restrict: 'E',
				templateUrl: 'optional/markdownSyntax/markdownSyntax.html',
				link: link
			};

			function link(scope) {
				scope.markdownSyntax = $templateCache.get('optional/markdownSyntax/markdownSyntax.md');
			}
		});
