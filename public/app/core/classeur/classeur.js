angular.module('classeur.core.classeur', [])
	.directive('clClasseur', function(clEditorLayoutSvc, clSettingSvc, clEditorSvc, clFileSvc) {
		return {
			restrict: 'E',
			templateUrl: 'app/core/classeur/classeur.html',
			link: function(scope) {

				// Globally accessible services
				scope.editorLayoutSvc = clEditorLayoutSvc;
				scope.settingSvc = clSettingSvc;
				scope.editorSvc = clEditorSvc;
				scope.fileSvc = clFileSvc;

				// Forces a scope variable to change for event listening
				scope.trigger = function(eventName) {
					scope[eventName] = Date.now();
				};

				// Set the current file
				scope.setFileDao = function(fileDao) {
					if(scope.fileDao && scope.fileDao.unload) {
						scope.fileDao.unload();
					}
					scope.fileDao = fileDao;
				};
			}
		};
	});
