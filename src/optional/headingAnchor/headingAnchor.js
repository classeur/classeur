angular.module('classeur.optional.headingAnchor', [])
	.directive('clHeadingAnchor',
		function($window, clUserSvc, clUrl, clEditorLayoutSvc) {
			return {
				restrict: 'A',
				link: link
			};

			function link(scope, element) {
				var className = 'heading-anchor icon-share';
				element.on('click', function(evt) {
					if (evt.target.className === className) {
						clEditorLayoutSvc.currentControl = 'sharingDialog#' + evt.target.parentNode.id;
						scope.$apply();
					}
				});
				scope.$watch('editorSvc.lastPreviewRefreshed', function() {
					element[0].querySelectorAll('h1, h2, h3, h4, h5, h6').cl_each(function(elt) {
						if (!elt.id || elt.headingAnchor) {
							return;
						}
						var anchorElt = $window.document.createElement('a');
						anchorElt.className = className;
						anchorElt.title = 'Share';
						elt.firstChild ? elt.insertBefore(anchorElt, elt.firstChild) : elt.appendChild(anchorElt);
						elt.headingAnchor = anchorElt;
					});
				});
			}
		});
