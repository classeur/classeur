angular.module('classeur.core.docs', [])
	.factory('clDocFileSvc', function($templateCache, clFileSvc) {
		return function(fileName) {
			var title = fileName.replace(/([A-Z])/g, ' $1');
			title = title[0].toUpperCase() + title.slice(1);
			var cacheEntry = $templateCache.get('docs/' + fileName + '.md');
			if(cacheEntry) {
				return clFileSvc.createReadOnlyFile(title, cacheEntry);
			}
		};
	});
