angular.module('classeur.core.classeurLayout', [])
	.directive('clClasseurLayout', function(clDocFileSvc, clFileSvc, clPanel) {
		var classeurMaxWidth = 700;
		var btnGrpWidth = 40;
		return {
			restrict: 'E',
			templateUrl: 'app/core/classeurLayout/classeurLayout.html',
			link: function(scope, element) {
				document.title = 'Classeur';

				var classeurPanel = clPanel(element, '.classeur.panel');

				function animateLayout() {
					var classeurWidth = document.body.clientWidth;
					if(classeurWidth > classeurMaxWidth) {
						classeurWidth = classeurMaxWidth;
					}
					classeurPanel.width(classeurWidth).move().x(-classeurWidth/2 - btnGrpWidth).end();
				}

				animateLayout();

				window.addEventListener('resize', animateLayout);
				scope.$on('$destroy', function() {
					window.removeEventListener('resize', animateLayout);
				});

				scope.setStateRecent = function() {
					scope.state = 'recent';
					scope.plasticColor = 1;
				};
				scope.setStateRecent();

				scope.setStateFiles = function() {
					scope.state = 'files';
					scope.plasticColor = 2;
				};

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
