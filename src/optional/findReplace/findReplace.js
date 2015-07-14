angular.module('classeur.optional.findReplace', [])
	.directive('clFindReplace',
		function($window, clPanel, clEditorLayoutSvc) {
			return {
				restrict: 'E',
				scope: true,
				templateUrl: 'optional/findReplace/findReplace.html',
				link: link
			};

			function link(scope, element) {
				var findReplacePanel = clPanel(element, '.findreplace.panel');
				var findInputElt = element[0].querySelector('.find.input');
				var replaceInputElt = element[0].querySelector('.find.input');
				var speed;

				function isOpen() {
					return clEditorLayoutSvc.currentControl === 'findreplace' && clEditorLayoutSvc.isEditorOpen;
				}

				function move() {
					if (isOpen()) {
						!findInputElt.readOnly && setTimeout(function() {
							findInputElt.focus();
						}, 10);
					} else {
						findInputElt.readOnly = true;
						findInputElt.blur();
						replaceInputElt.readOnly = true;
						replaceInputElt.blur();
					}
					findReplacePanel.move(speed).to(-clEditorLayoutSvc.backgroundX,
						isOpen() ? 0 : 40
					).then(function() {
						if (isOpen()) {
							findInputElt.readOnly = false;
							replaceInputElt.readOnly = false;
							findInputElt.focus();
						}
					}).end();
					speed = 'slow';
				}


				$window.addEventListener('keydown', function(evt) {
					if (evt.which !== 70 || (!evt.metaKey && !evt.ctrlKey) || !clEditorLayoutSvc.isEditorOpen) {
						// Not Ctrl/Cmd+F
						return;
					}
					evt.preventDefault();
					clEditorLayoutSvc.currentControl = 'findreplace';
					scope.$apply();
				});
				scope.$watch('::editorSvc.cledit', function(cledit) {
					cledit.addKeystroke(50, new $window.cledit.Keystroke(function(evt) {
						if (evt.which !== 70 || (!evt.metaKey && !evt.ctrlKey)) {
							// Not F
							return;
						}

						evt.preventDefault();
						clEditorLayoutSvc.currentControl = 'findreplace';
						move();
						return true;
					}));
				});

				scope.$watch('editorLayoutSvc.currentControl === "findreplace"', move);
				scope.$watch('editorSvc.isEditorOpen', move);
			}
		});
