angular.module('classeur.core.classeurLayout', [])
	.directive('clClasseurLayout', function(docFiles, files) {
		return {
			restrict: 'E',
			templateUrl: 'app/core/classeurLayout/classeurLayout.html',
			link: function(scope) {
				scope.files = files;
				scope.loadDocFile = function(fileName) {
					files.setCurrent(docFiles(fileName));
				};
				scope.loadFile = function(fileDao) {
					fileDao.load(function() {
						files.setCurrent(fileDao);
					});
				};
				scope.newFile = function() {
					var fileDao = files.newLocalFile();
					scope.loadFile(fileDao);
				};
			}
		};
	});
