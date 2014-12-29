angular.module('classeur.core.layout', [
	'famous.angular',
	'classeur.core.settings',
])
	.directive('clLayout', function($famous, layout, settings, editor) {
		return {
			restrict: 'E',
			templateUrl: 'app/core/layout/layout.html',
			link: function(scope) {
				var Transitionable = $famous['famous/transitions/Transitionable'];
				var EventHandler = $famous['famous/core/EventHandler'];

				scope.layout = layout;
				scope.settings = settings;
				scope.editor = editor;

				var previewSizeAdjust = 150;
				var binderWidth, marginRight;
				var leftMarginOverflow = 90;

				function updateLayout() {
					binderWidth = document.body.clientWidth;
					if(layout.isTocOpen) {
						binderWidth -= layout.tocWidth;
					}
					layout.fontSize = 18;
					var factor = 1 + (settings.values.zoom - 3) * 0.1;
					// Kind of responsive...
					layout.pageWidth = 990 * factor;
					if(binderWidth < 1120) {
						--layout.fontSize;
						layout.pageWidth = 910 * factor;
					}
					if(binderWidth < 1040) {
						layout.pageWidth = 830 * factor;
					}
					marginRight = (binderWidth - layout.pageWidth) / 2;
					marginRight = marginRight > 0 ? marginRight : 0;
					if(binderWidth + leftMarginOverflow < layout.pageWidth) {
						layout.pageWidth = binderWidth + leftMarginOverflow;
					}
					if(layout.pageWidth < 640) {
						--layout.fontSize;
					}
					if(layout.isSidePreviewOpen) {
						var maxWidth = binderWidth / 2 + layout.sideButtonWidth + leftMarginOverflow;
						if(maxWidth < layout.pageWidth) {
							layout.pageWidth = maxWidth;
						}
						marginRight = binderWidth/2 - layout.sideButtonWidth;
					}
				}

				function getBinderSize() {
					return [
						layout.pageWidth - layout.sideButtonWidth,
						undefined
					];
				}

				function getBinderOuterTranslate() {
					return [
						layout.isTocOpen ? -layout.tocWidth : 0,
						0,
						1
					];
				}

				function getBinderTranslate() {
					var result = [
						binderWidth - (layout.pageWidth + layout.sideButtonWidth) / 2 - marginRight,
						0
					];
					if(layout.isTocOpen) {
						result[0] += layout.tocWidth;
					}
					return result;
				}

				function getPreviewSize() {
					return [
						layout.pageWidth - previewSizeAdjust + 8000,
						undefined
					];
				}

				function getPreviewTranslate() {
					var result = getBinderTranslate();
					if(layout.isSidePreviewOpen) {
						result[0] += layout.pageWidth - previewSizeAdjust / 2;
					}
					return result;
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
						layout.isMenuOpen ? -80 : 0,
						1
					];
				}

				function getPageOuterTranslate() {
					return [
						layout.isMenuOpen ? 5 : 0,
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

				function getFoldingSize() {
					return [
						layout.isFoldingOpen ? 100 : 40,
						layout.isFoldingOpen ? 100 : 40
					];
				}

				function getFoldingShadowSize() {
					var result = getFoldingSize();
					result[0] = 200;
					result[1] = Math.sqrt(result[1] * result[1] * 2);
					return result;
				}

				function getStatTranslate() {
					return [
						layout.isStatOpen ? 20 : 30,
						layout.isStatOpen ? 80 : 300,
					];
				}

				updateLayout();
				var layoutTrans = {
					binderSize: new Transitionable(getBinderSize()),
					binderTranslate: new Transitionable(getBinderTranslate()),
					binderOuterTranslate: new Transitionable(getBinderOuterTranslate()),
					previewSize: new Transitionable(getPreviewSize()),
					previewTranslate: new Transitionable(getPreviewTranslate()),
					editorTranslate: new Transitionable(getEditorTranslate()),
					pageTranslate: new Transitionable(getPageTranslate()),
					pageOuterTranslate: new Transitionable(getPageOuterTranslate()),
					pageRotate: new Transitionable(getPageRotate()),
					foldingSize: new Transitionable(getFoldingSize()),
					foldingShadowSize: new Transitionable(getFoldingShadowSize()),
					statTranslate: new Transitionable(getStatTranslate()),
					statHandler: new EventHandler(),
					fontSizePx: layout.fontSize + 'px',
					fontSizeEm: (7 + settings.values.zoom)/10 + 'em'
				};
				scope.layoutTrans = layoutTrans;

				function setLayoutTransition() {
					updateLayout();
					layoutTrans.binderOuterTranslate.set(getBinderOuterTranslate(), {duration: 180, curve: 'easeOut'});
					layoutTrans.binderTranslate.set(getBinderTranslate(), {duration: 180, curve: 'easeOut'}, function() {
						layoutTrans.isReady = true;
						layoutTrans.fontSizePx = layout.fontSize + 'px';
						layoutTrans.fontSizeEm = (7 + settings.values.zoom)/10 + 'em';
						scope.$apply();
						layoutTrans.binderSize.set(getBinderSize(), {duration: 0}, function() {
							scope.$apply();
						});
					});
					var previewSize = getPreviewSize();
					layoutTrans.previewTranslate.set(getPreviewTranslate(), {duration: 180, curve: 'easeOut'}, function() {
						layoutTrans.previewSize.set(previewSize, {duration: 0});
					});
				}

				function setEditorTransition() {
					layoutTrans.editorTranslate.set(getEditorTranslate(), {
						duration: 270,
						curve: layout.isEditorOpen ? 'easeOut' : 'easeIn'
					}, function() {
						layout.toggleSidePreview(false);
						layout.currentControl = undefined;
						scope.$apply();
					});
				}

				function setMenuTransition() {
					layoutTrans.pageTranslate.set(getPageTranslate(), {duration: 180, curve: 'easeOutBounce'});
					layoutTrans.pageOuterTranslate.set(getPageOuterTranslate(), {duration: 180, curve: 'easeOutBounce'});
					layoutTrans.pageRotate.set(getPageRotate(), {duration: 180, curve: 'easeOutBounce'});
				}

				function setFoldingTransition() {
					if(!layout.isFoldingOpen) {
						layoutTrans.showFoldingButtons = false;
					}
					layoutTrans.foldingSize.set(getFoldingSize(), {duration: 180, curve: 'easeOut'});
					layoutTrans.foldingShadowSize.set(getFoldingShadowSize(), {duration: 180, curve: 'easeOut'}, function() {
						if(layout.isFoldingOpen) {
							layoutTrans.showFoldingButtons = true;
							scope.$apply();
						}
					});
				}

				function setStatTransition() {
					layoutTrans.statTranslate.set(getStatTranslate(), {duration: 180, curve: 'easeOutBounce'});
				}

				window.addEventListener('resize', window.cledit.Utils.debounce(setLayoutTransition, 400));

				scope.$watch('settings.values.zoom', setLayoutTransition);
				scope.$watch('layout.isSidePreviewOpen', setLayoutTransition);
				scope.$watch('layout.isEditorOpen', setEditorTransition);
				scope.$watch('layout.isMenuOpen', setMenuTransition);
				scope.$watch('layout.isTocOpen', setLayoutTransition);
				scope.$watch('layout.isStatOpen', setStatTransition);
				scope.$watch('layout.isFoldingOpen', setFoldingTransition);
				scope.$watch('layout.currentControl', function(currentControl) {
					layout.isMenuOpen = currentControl === 'menu';
				});
			}
		};
	})
	.factory('layout', function($rootScope, settings) {
		settings.setDefaultValue('zoom', 3);

		var layout = {
			pageMargin: 25,
			sideButtonWidth: 40,
			menuWidth: 320,
			tocWidth: 250,
			statHeight: 30,
			gutterWidth: 120,
			isEditorOpen: true,
			toggleEditor: function(isOpen) {
				this.isEditorOpen = isOpen === undefined ? !this.isEditorOpen : isOpen;
			},
			toggleSidePreview: function(isOpen) {
				this.isSidePreviewOpen = isOpen === undefined ? !this.isSidePreviewOpen : isOpen;
			},
			toggleMenu: function() {
				this.currentControl = this.currentControl === 'menu' ? undefined : 'menu';
			},
			toggleToc: function(isOpen) {
				this.isTocOpen = isOpen === undefined ? !this.isTocOpen : isOpen;
			},
			toggleStat: function(isOpen) {
				this.isStatOpen = isOpen === undefined ? !this.isStatOpen : isOpen;
			},
			toggleFolding: function(isOpen) {
				this.isFoldingOpen = isOpen === undefined ? !this.isFoldingOpen : isOpen;
			},
		};

		window.addEventListener('keydown', function(e) {
			if(e.which === 27) {
				// Esc key
				e.preventDefault();
				layout.currentControl = undefined;
				$rootScope.$apply();
			}
		});

		return layout;
	});
