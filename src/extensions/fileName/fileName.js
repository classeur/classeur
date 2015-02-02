angular.module('classeur.extensions.fileName', [])
	.directive('clFileName', function() {

		return {
			restrict: 'E',
			templateUrl: 'extensions/fileName/fileName.html',
			link: function(scope) {
				function setDefaultName() {
					scope.currentFileDao.name = scope.currentFileDao.name || 'Untitled';
					document.name = scope.currentFileDao.name;
				}
				setDefaultName();
				scope.setDefaultName = setDefaultName;
			}
		};
	});
