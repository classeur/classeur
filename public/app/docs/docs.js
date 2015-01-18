angular.module('classeur.core.docs', [])
	.factory('clDocFileSvc', function($templateCache, clFileSvc) {
		return function(fileName, fileTitle) {
			var cacheEntry = $templateCache.get('app/docs/' + fileName);
			if(cacheEntry) {
				return clFileSvc.createReadOnlyFile(fileTitle, cacheEntry[1]);
			}
		};
	})
	.directive('clDocs', function() {
		return {
			restrict: 'E',
			templateUrl: 'app/docs/docs.html'
		};
	})
	.directive('clMarkdownCheatSheet', function() {
		return {
			restrict: 'E',
			templateUrl: 'app/docs/markdownCheatSheet.md'
		};
	});
