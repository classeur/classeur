angular.module('classeur.extensions.fileTitle', [])
	.directive('clFileTitle', function() {

		return {
			restrict: 'E',
			templateUrl: 'extensions/fileTitle/fileTitle.html',
			link: function(scope) {
				function setDefaultTitle() {
					scope.currentFileDao.title = scope.currentFileDao.title || 'Untitled';
					document.title = scope.currentFileDao.title;
				}
				setDefaultTitle();
				scope.setDefaultTitle = setDefaultTitle;
			}
		};
	});
