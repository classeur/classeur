angular.module('classeur.core.docs', [])
	.factory('docFiles', function($templateCache, files) {
		return function(fileName, fileTitle) {
			var cacheEntry = $templateCache.get('app/docs/' + fileName);
			if(cacheEntry) {
				return files.readOnlyFile(fileTitle, cacheEntry[1]);
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
