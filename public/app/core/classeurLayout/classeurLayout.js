angular.module('classeur.core.classeurLayout', [])
	.directive('clClasseurLayout', function(clDocFileSvc, clFileSvc, clPanel) {
		return {
			restrict: 'E',
			templateUrl: 'app/core/classeurLayout/classeurLayout.html',
			link: function(scope, element) {
				document.title = 'Classeur';

				clPanel(element, '.classeur .btn-grp.panel').width(40).right(-40);

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
