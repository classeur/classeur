angular.module('classeur.core.layout', [
	'famous.angular',
	'classeur.core.settings',
])
	.directive('clLayout', function($famous, layout, settings, cledit) {
		return {
			restrict: 'E',
			templateUrl: 'app/core/layout/layout.html',
			link: function(scope) {
				var Transitionable = $famous['famous/transitions/Transitionable'];

				scope.layout = layout;
				scope.settings = settings;
				scope.cledit = cledit;

				var previewSizeAdjust = 150;
				var transX;

				function updateLayout() {
					transX = document.body.clientWidth / 2;
					layout.fontSize = 3;
					var factor = 1 + (settings.values.zoom - 3) * 0.1;
					layout.pageWidth = 990 * factor;
					if(document.body.clientWidth < 1120 * factor) {
						layout.fontSize = 2;
						layout.pageWidth = 910 * factor;
					}
					if(document.body.clientWidth < 1040 * factor) {
						layout.pageWidth = 830 * factor;
					}
					if(document.body.clientWidth + 30 < layout.pageWidth) {
						layout.pageWidth = document.body.clientWidth + 30;
					}
					if(layout.pageWidth < 640 * factor) {
						layout.fontSize = 1;
					}
					if(layout.isSidePreviewOpen && document.body.clientWidth / 2 + 80 < layout.pageWidth) {
						layout.pageWidth = document.body.clientWidth / 2 + 80;
					}
				}

				function getBinderSize() {
					return [
						layout.pageWidth,
						undefined
					];
				}

				function getPreviewSize() {
					return [
						layout.pageWidth - previewSizeAdjust + 8000,
						undefined
					];
				}

				function getBinderTranslate() {
					return [
						transX + (layout.isSidePreviewOpen ? -layout.pageWidth / 2 + 10 : -55),
						0
					];
				}

				function getPreviewTranslate() {
					return [
						transX + (layout.isSidePreviewOpen ? (layout.pageWidth - previewSizeAdjust) / 2 + 70 : 0),
						0
					];
				}

				function getEditorTranslate() {
					return [
						0,
						layout.isEditorOpen ? 0 : 2200
					];
				}

				function getPageTranslate() {
					return [
						layout.isMenuOpen ? -(layout.menuWidth - 20) : 0,
						layout.isMenuOpen ? -80 : 0
					];
				}

				function getPageOuterTranslate() {
					return [
						layout.isMenuOpen ? 10 : 0,
						0
					];
				}

				function getPageRotate() {
					return [
						0,
						0,
						layout.isMenuOpen ? -0.03 : 0
					];
				}

				updateLayout();
				var layoutTrans = {
					binderSize: new Transitionable(getBinderSize()),
					binderTranslate: new Transitionable(getBinderTranslate()),
					previewSize: new Transitionable(getPreviewSize()),
					previewTranslate: new Transitionable(getPreviewTranslate()),
					editorTranslate: new Transitionable(getEditorTranslate()),
					pageTranslate: new Transitionable(getPageTranslate()),
					pageOuterTranslate: new Transitionable(getPageOuterTranslate()),
					pageRotate: new Transitionable(getPageRotate()),
					fontSizeClass: 'font-size-' + layout.fontSize,
					zoomClass: 'zoom-' + settings.values.zoom
				};
				scope.layoutTrans = layoutTrans;

				function setLayoutTransition() {
					updateLayout();
					layoutTrans.binderTranslate.set(getBinderTranslate(), {duration: 180, curve: 'easeOut'}, function() {
						layoutTrans.isReady = true;
						layoutTrans.fontSizeClass = 'font-size-' + layout.fontSize;
						layoutTrans.zoomClass = 'zoom-' + settings.values.zoom;
						scope.$apply();
						layoutTrans.binderSize.set(getBinderSize(), {duration: 180, curve: 'custom'});
					});
					var previewSize = getPreviewSize();
					layoutTrans.previewTranslate.set(getPreviewTranslate(), {duration: 180, curve: 'easeOut'}, function() {
						layoutTrans.previewSize.set(previewSize, {duration: 180, curve: 'custom'});
					});
				}

				function setEditorTransition() {
					layoutTrans.editorTranslate.set(getEditorTranslate(), {
						duration: 270,
						curve: layout.isEditorOpen ? 'easeOut' : 'easeIn'
					}, function() {
						layout.toggleSidePreview(false);
						layout.toggleMenu(false);
						scope.$apply();
					});
				}

				function setMenuTransition() {
					layoutTrans.pageTranslate.set(getPageTranslate(), {duration: 180, curve: 'easeOutBounce'});
					layoutTrans.pageOuterTranslate.set(getPageOuterTranslate(), {duration: 180, curve: 'easeOutBounce'});
					layoutTrans.pageRotate.set(getPageRotate(), {duration: 180, curve: 'easeOutBounce'});
				}

				window.addEventListener('resize', window.ced.Utils.debounce(setLayoutTransition, 400));

				scope.$watch('settings.values.zoom', setLayoutTransition);
				scope.$watch('layout.isSidePreviewOpen', setLayoutTransition);
				scope.$watch('layout.isEditorOpen', setEditorTransition);
				scope.$watch('layout.isMenuOpen', setMenuTransition);

			}
		};
	})
	.factory('layout', function() {
		return {
			pageMargin: 25,
			menuWidth: 320,
			isEditorOpen: true,
			toggleEditor: function(isOpen) {
				this.isEditorOpen = isOpen === undefined ? !this.isEditorOpen : isOpen;
			},
			toggleSidePreview: function(isOpen) {
				this.isSidePreviewOpen = isOpen === undefined ? !this.isSidePreviewOpen : isOpen;
			},
			toggleMenu: function(isOpen) {
				this.isMenuOpen = isOpen === undefined ? !this.isMenuOpen : isOpen;
			}
		};
	});
