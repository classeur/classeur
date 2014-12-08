angular.module('classeur.app', [
	'ngMaterial',
	'ngAnimate',
	'famous.angular',
	'classeur.core.button',
	'classeur.core.cledit',
	'classeur.core.layout',
	'classeur.core.settings',
	'classeur.extensions.btnBar',
	'classeur.extensions.markdownExtra',
	'classeur.extensions.scrollSync',
])
	.config(function($animateProvider) {
		$animateProvider.classNameFilter(/angular-animate/);
	})
	.run(function($famous) {
		var TweenTransition = $famous['famous/transitions/TweenTransition'];
		TweenTransition.registerCurve('custom', function(t) {
			//return t*t*t*t;
			/*
			 */
			var p = 0.3;
			return Math.pow(2, -10 * t) * Math.sin((t - p / 4) * (2 * Math.PI) / p) + 1;
		});
	})
	.directive('ced', function(cledit, layout) {
		return {
			link: function(scope, element) {
				window.rangy.init();
				cledit.editorElt = element[0];
				cledit.editor = window.ced(cledit.editorElt, {
					language: window.prismMd,
					sectionDelimiter: '^.+[ \\t]*\\n=+[ \\t]*\\n+|^.+[ \\t]*\\n-+[ \\t]*\\n+|^\\#{1,6}[ \\t]*.+?[ \\t]*\\#*\\n+'
				});

				var pagedownEditor = new window.Markdown.Editor(cledit.converter, {
					input: Object.create(cledit.editor)
				});
				pagedownEditor.run();
				cledit.pagedownEditor = pagedownEditor;

				var debouncedRefreshPreview = window.ced.Utils.debounce(function() {
					cledit.convert();
					cledit.refreshPreview();
					scope.$apply();
				}, 500);
				cledit.editor.onContentChanged(function(content, sectionList) {
					cledit.sectionList = sectionList;
					debouncedRefreshPreview();
				});
				cledit.editor.init();
				cledit.convert();
				if(cledit.previewElt) {
					cledit.refreshPreview();
				}
				scope.$watch('layout.isEditorOpen', function() {
					cledit.editor.toggleEditable(layout.isEditorOpen);
				});
			}
		};
	})
	.directive('preview', function(cledit) {
		return {
			link: function(scope, element) {
				cledit.previewElt = element[0];
				if(cledit.content !== undefined) {
					cledit.refresh();
				}
			}
		};
	});

