angular.module('classeur.core.docs', [])
	.factory('clDocFileSvc', function($templateCache, clFileSvc) {
		return function(fileName) {
			var name = fileName.replace(/([A-Z])/g, ' $1');
			name = name[0].toUpperCase() + name.slice(1);
			var cacheEntry = $templateCache.get('docs/' + fileName + '.md');
			if(cacheEntry) {
				var fileDao = clFileSvc.createReadOnlyFile(name, cacheEntry);
				fileDao.fileName = fileName;
				return fileDao;
			}
		};
	});
