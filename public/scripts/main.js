angular.module('classeur.main', [
	'ngMaterial',
	'ngAnimate',
	'famous.angular',
	'classeur.services.btnBar',
	'classeur.services.cleditor',
	'classeur.services.layout',
	'classeur.services.settings',
	'classeur.services.scrollSync',
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
	.directive('ced', function(cleditor, scrollSync) {
		return {
			link: function(scope, element) {
				window.rangy.init();
				cleditor.editorElt = element[0];
				cleditor.editor = window.ced(cleditor.editorElt, {
					language: window.prismMd,
					sectionDelimiter: '^.+[ \\t]*\\n=+[ \\t]*\\n+|^.+[ \\t]*\\n-+[ \\t]*\\n+|^\\#{1,6}[ \\t]*.+?[ \\t]*\\#*\\n+'
				});
				scrollSync.setEditorElt(cleditor.editorElt);

				var pagedownEditor = new window.Markdown.Editor(cleditor.converter, {
					input: Object.create(cleditor.editor)
				});
				pagedownEditor.run();
				cleditor.pagedownEditor = pagedownEditor;

				var debouncedRefreshPreview = window.ced.Utils.debounce(function() {
					cleditor.convert();
					cleditor.refreshPreview();
				}, 500);
				cleditor.editor.onContentChanged(function(content, sectionList) {
					cleditor.sectionList = sectionList;
					debouncedRefreshPreview();
				});
				cleditor.editor.init();
				cleditor.convert();
				if(cleditor.previewElt) {
					cleditor.refreshPreview();
				}
			}
		};
	})
	.directive('preview', function(cleditor, scrollSync) {
		return {
			link: function(scope, element) {
				cleditor.previewElt = element[0];
				scrollSync.setPreviewElt(cleditor.previewElt);
				if(cleditor.content !== undefined) {
					cleditor.refresh();
				}
			}
		};
	})
	.controller('LayoutCtrl', function($scope, $famous, settings, layout, btnBar) {
		var Transitionable = $famous['famous/transitions/Transitionable'];

		function Button() {
			this.scaleTrans = new Transitionable([
				0.9,
				0.9
			]);
			this.opacityTrans = new Transitionable(0.3);
			this.hover = function(enable) {
				this.scaleTrans.set([
					enable ? 1 : 0.9,
					enable ? 1 : 0.9
				], {duration: 180, curve: 'easeOut'});
				this.opacityTrans.set(enable ? 0.35 : 0.3, {duration: 180, curve: 'easeOut'});
			};
		}

		$scope.closeBtn = new Button();
		$scope.previewBtn = new Button();
		$scope.minimizeBtn = new Button();

		$scope.settings = settings;
		$scope.$watch('settings.zoom', layout.applyZoom);

		$scope.layout = layout;
		$scope.btnBar = btnBar;
	});

