angular.module('classeur.core.layout', [])
	.directive('clLayout', function(layout, settings, editor, panel) {
		var hideOffsetY = 2000;

		return {
			restrict: 'E',
			templateUrl: 'app/core/layout/layout.html',
			link: function(scope, element) {
				layout.init();

				scope.layout = layout;
				scope.settings = settings;
				scope.editor = editor;

				panel(element, '.toc.panel').width(layout.tocWidth + 50).right(-50);
				var backgroundPanel = panel(element, '.background.panel');
				var previewPanel = panel(element, '.preview.panel');
				var binderPanel = panel(element, '.binder.panel').top(-hideOffsetY);
				panel(element, '.edit.btn-panel').bottom(-hideOffsetY);
				var editorPanel = panel(element, '.editor.panel').top(hideOffsetY);
				var pagePanel = panel(element, '.page.panel').left(layout.pageMargin / 2);
				panel(element, '.menu.panel').width(layout.menuWidth).right(0);
				panel(element, '.editor .btn-grp.panel').width(layout.editorBtnGrpWidth).right(-layout.editorBtnGrpWidth);
				var cornerPanel = panel(element, '.corner.panel');
				panel(element, '.corner .shadow.panel').move().rotate(-45).end();

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
						var maxWidth = binderWidth / 2 + layout.editorBtnGrpWidth + leftMarginOverflow;
						if(maxWidth < layout.pageWidth) {
							layout.pageWidth = maxWidth;
						}
						marginRight = binderWidth / 2 - layout.editorBtnGrpWidth;
					}

					layout.backgroundX = layout.isTocOpen ? -layout.tocWidth : 0;
					layout.binderWidth = layout.pageWidth - layout.editorBtnGrpWidth;
					layout.binderX = binderWidth - (layout.pageWidth + layout.editorBtnGrpWidth) / 2 - marginRight;
					layout.binderX += layout.isTocOpen ? layout.tocWidth : 0;
					layout.previewWidth = layout.pageWidth - previewSizeAdjust + 2000;
					layout.previewX = layout.binderX;
					layout.previewX += layout.isSidePreviewOpen ? layout.pageWidth - previewSizeAdjust / 2 : 0;
					layout.editorX = layout.isMenuOpen ? 5 : 0;
					layout.editorY = layout.isEditorOpen ? 0 : hideOffsetY;
					layout.pageX = layout.isMenuOpen ? -(layout.menuWidth - 20) : 0;
					layout.pageY = layout.isMenuOpen ? -80 : 0;
					layout.pageRotate = layout.isMenuOpen ? -2 : 0;
				}

				function hidePreview() {
					if(layout.isEditorOpen && !layout.isSidePreviewOpen) {
						layout.isPreviewVisible = false;
						previewPanel.$elt.addClass('hidden');
					}

				}

				function showPreview() {
					if(!layout.isEditorOpen || layout.isSidePreviewOpen) {
						layout.isPreviewVisible = true;
						previewPanel.$elt.removeClass('hidden');
					}
				}

				function updateLayoutSize() {
					layout.fontSizePx = layout.fontSize + 'px';
					layout.fontSizeEm = (7 + settings.values.zoom) / 10 + 'em';
					binderPanel.width(layout.binderWidth).left(-layout.binderWidth / 2);
					previewPanel.width(layout.previewWidth).left(-layout.previewWidth / 2);
					pagePanel.width(layout.binderWidth - layout.pageMargin);
					hidePreview();
				}

				var debouncedUpdatedLayoutSize = window.cledit.Utils.debounce(function() {
					updateLayoutSize();
					scope.$apply();
				}, 90);

				var isInited;

				function animateLayout() {
					showPreview();
					updateLayout();
					var duration = isInited ? 180 : 0;
					backgroundPanel.move().x(layout.backgroundX).duration(duration).then(debouncedUpdatedLayoutSize).end();
					binderPanel.move().x(layout.binderX).duration(duration).then(debouncedUpdatedLayoutSize).end();
					previewPanel.move().x(layout.previewX).duration(duration).then(debouncedUpdatedLayoutSize).end();
				}

				animateLayout();
				updateLayoutSize();

				function animateEditor() {
					showPreview();
					updateLayout();
					editorPanel.move().to(layout.editorX, layout.editorY).duration(270).ease(layout.isEditorOpen ? 'out' : 'in').then(function() {
						hidePreview();
						layout.toggleSidePreview(false);
						layout.currentControl = undefined;
						scope.$apply();
					}).end();
				}

				function animateMenu() {
					updateLayout();
					pagePanel.move().x(layout.pageX).y(layout.pageY).rotate(layout.pageRotate).ease('ease-out-back').duration(180).end();
					editorPanel.move().to(layout.editorX, layout.editorY).duration(180).end();
				}

				function animateCorner() {
					if(!layout.isCornerOpen) {
						layout.isCornerButtonVisible = false;
					}
					var duration = isInited ? 180 : 0;
					cornerPanel.move().scale(layout.isCornerOpen ? 2.5 : 1).duration(duration).then(function() {
						if(layout.isCornerOpen) {
							layout.isCornerButtonVisible = true;
							scope.$apply();
						}
					}).end();
				}

				animateCorner();

				isInited = true;

				window.addEventListener('resize', window.cledit.Utils.debounce(animateLayout, 400));

				scope.$watch('settings.values.zoom', animateLayout);
				scope.$watch('layout.isSidePreviewOpen', animateLayout);
				scope.$watch('layout.isEditorOpen', animateEditor);
				scope.$watch('layout.isMenuOpen', animateMenu);
				scope.$watch('layout.isTocOpen', animateLayout);
				scope.$watch('layout.isCornerOpen', animateCorner);
				scope.$watch('layout.currentControl', function(currentControl) {
					layout.isMenuOpen = currentControl === 'menu';
				});
			}
		};
	})
	.factory('layout', function($rootScope, settings, files) {
		settings.setDefaultValue('zoom', 3);

		var layout = {
			pageMargin: 24,
			editorBtnGrpWidth: 40,
			menuWidth: 320,
			tocWidth: 250,
			statHeight: 30,
			init: function() {
				this.isEditorOpen = true;
				this.isSidePreviewOpen = false;
				this.currentControl = undefined;
				this.isTocOpen = false;
				this.isStatOpen = false;
				this.isCornerOpen = false;
			},
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
			toggleCorner: function(isOpen) {
				this.isCornerOpen = isOpen === undefined ? !this.isCornerOpen : isOpen;
			},
			close: function() {

				files.setCurrent();
			}
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
