angular.module('classeur.extensions.fileTitle', [])
	.directive('clFileTitle', function() {

		return {
			restrict: 'E',
			templateUrl: 'app/extensions/fileTitle/fileTitle.html',
			link: function(scope) {
				function setDefaultTitle() {
					scope.fileDao.metadata.title = scope.fileDao.metadata.title || 'Untitled';
					document.title = scope.fileDao.metadata.title;
				}
				setDefaultTitle();
				scope.setDefaultTitle = setDefaultTitle;
			}
		};
	});
