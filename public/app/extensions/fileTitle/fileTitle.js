angular.module('classeur.extensions.fileTitle', [])
	.directive('clFileTitle', function() {

		return {
			restrict: 'E',
			templateUrl: 'app/extensions/fileTitle/fileTitle.html',
			link: function(scope) {
				function setDefaultTitle() {
					scope.fileDao.title = scope.fileDao.title || 'Untitled';
					document.title = scope.fileDao.title;
				}
				setDefaultTitle();
				scope.setDefaultTitle = setDefaultTitle;
			}
		};
	});
