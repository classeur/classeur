angular.module('classeur.extensions.headingAnchor', [])
	.directive('clHeadingAnchor', function($window, clUserSvc, clUrl) {
		return {
			restrict: 'A',
			link: function(scope, element) {
				scope.$watch('editorSvc.lastPreviewRefreshed', function() {
					Array.prototype.forEach.call(element[0].querySelectorAll('h1, h2, h3, h4, h5, h6'), function(elt) {
						if(elt.hasAnchor || !elt.id) {
							return;
						}
						var anchorElt = $window.document.createElement('a');
						anchorElt.className = 'heading-anchor mdi-editor-insert-link';
						anchorElt.href= '#!' + clUrl.file(scope.currentFileDao, clUserSvc.user) + '#' + elt.id;
						elt.firstChild ? elt.insertBefore(anchorElt, elt.firstChild) : elt.appendChild(anchorElt);
						elt.hasAnchor = true;
					});
				});
			}
		};
	});
