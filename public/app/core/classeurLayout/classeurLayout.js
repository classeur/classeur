angular.module('classeur.core.classeurLayout', [])
	.directive('clClasseurLayout', function(clDocFileSvc, clFileSvc) {
		return {
			restrict: 'E',
			templateUrl: 'app/core/classeurLayout/classeurLayout.html',
			link: function(scope) {
				scope.loadDocFile = function(fileName, fileTitle) {
					scope.setFileDao(clDocFileSvc(fileName, fileTitle));
				};
				scope.loadFile = function(fileDao) {
					fileDao.load(function() {
						scope.setFileDao(fileDao);
					});
				};
				scope.newFile = function() {
					var fileDao = clFileSvc.newLocalFile();
					scope.loadFile(fileDao);
				};
			}
		};
	});
