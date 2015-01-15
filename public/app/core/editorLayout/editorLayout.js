angular.module('classeur.core.editorLayout', [])
	.directive('clEditorLayout', function(clEditorLayoutSvc, clSettingSvc, clEditorSvc, clPanel) {
		var hideOffsetY = 2000;

		return {
			restrict: 'E',
			templateUrl: 'app/core/editorLayout/editorLayout.html',
			link: function(scope, element) {
				clEditorLayoutSvc.init();

				clPanel(element, '.toc.panel').width(clEditorLayoutSvc.tocWidth + 50).right(-50);
				var backgroundPanel = clPanel(element, '.background.panel');
				var previewPanel = clPanel(element, '.preview.panel');
				var binderPanel = clPanel(element, '.binder.panel').top(-hideOffsetY);
				clPanel(element, '.edit.btn-panel').bottom(-hideOffsetY);
				var editorPanel = clPanel(element, '.editor.panel').top(hideOffsetY);
				var pagePanel = clPanel(element, '.page.panel').left(clEditorLayoutSvc.pageMargin / 2);
				clPanel(element, '.menu.panel').width(clEditorLayoutSvc.menuWidth).right(0);
				clPanel(element, '.editor .btn-grp.panel').width(clEditorLayoutSvc.editorBtnGrpWidth).right(-clEditorLayoutSvc.editorBtnGrpWidth);
				var cornerPanel = clPanel(element, '.corner.panel');
				clPanel(element, '.corner .shadow.panel').move().rotate(-45).end();

				var previewSizeAdjust = 150;
				var binderWidth, marginRight;
				var leftMarginOverflow = 90;

				function updateLayout() {
					binderWidth = document.body.clientWidth;
					if(clEditorLayoutSvc.isTocOpen) {
						binderWidth -= clEditorLayoutSvc.tocWidth;
					}
					clEditorLayoutSvc.fontSize = 18;
					var factor = 1 + (clSettingSvc.values.zoom - 3) * 0.1;
					// Kind of responsive...
					clEditorLayoutSvc.pageWidth = 990 * factor;
					if(binderWidth < 1120) {
						--clEditorLayoutSvc.fontSize;
						clEditorLayoutSvc.pageWidth = 910 * factor;
					}
					if(binderWidth < 1040) {
						clEditorLayoutSvc.pageWidth = 830 * factor;
					}
					marginRight = (binderWidth - clEditorLayoutSvc.pageWidth) / 2;
					marginRight = marginRight > 0 ? marginRight : 0;
					if(binderWidth + leftMarginOverflow < clEditorLayoutSvc.pageWidth) {
						clEditorLayoutSvc.pageWidth = binderWidth + leftMarginOverflow;
					}
					if(clEditorLayoutSvc.pageWidth < 640) {
						--clEditorLayoutSvc.fontSize;
					}
					if(clEditorLayoutSvc.isSidePreviewOpen) {
						var maxWidth = binderWidth / 2 + clEditorLayoutSvc.editorBtnGrpWidth + leftMarginOverflow;
						if(maxWidth < clEditorLayoutSvc.pageWidth) {
							clEditorLayoutSvc.pageWidth = maxWidth;
						}
						marginRight = binderWidth / 2 - clEditorLayoutSvc.editorBtnGrpWidth;
					}

					clEditorLayoutSvc.backgroundX = clEditorLayoutSvc.isTocOpen ? -clEditorLayoutSvc.tocWidth : 0;
					clEditorLayoutSvc.binderWidth = clEditorLayoutSvc.pageWidth - clEditorLayoutSvc.editorBtnGrpWidth;
					clEditorLayoutSvc.binderX = binderWidth - (clEditorLayoutSvc.pageWidth + clEditorLayoutSvc.editorBtnGrpWidth) / 2 - marginRight;
					clEditorLayoutSvc.binderX += clEditorLayoutSvc.isTocOpen ? clEditorLayoutSvc.tocWidth : 0;
					clEditorLayoutSvc.previewWidth = clEditorLayoutSvc.pageWidth - previewSizeAdjust + 2000;
					clEditorLayoutSvc.previewX = clEditorLayoutSvc.binderX;
					clEditorLayoutSvc.previewX += clEditorLayoutSvc.isSidePreviewOpen ? clEditorLayoutSvc.pageWidth - previewSizeAdjust / 2 : 0;
					clEditorLayoutSvc.editorX = clEditorLayoutSvc.isMenuOpen ? 5 : 0;
					clEditorLayoutSvc.editorY = clEditorLayoutSvc.isEditorOpen ? 0 : hideOffsetY;
					clEditorLayoutSvc.pageX = clEditorLayoutSvc.isMenuOpen ? -(clEditorLayoutSvc.menuWidth - 20) : 0;
					clEditorLayoutSvc.pageY = clEditorLayoutSvc.isMenuOpen ? -80 : 0;
					clEditorLayoutSvc.pageRotate = clEditorLayoutSvc.isMenuOpen ? -2 : 0;
				}

				function hidePreview() {
					if(clEditorLayoutSvc.isEditorOpen && !clEditorLayoutSvc.isSidePreviewOpen) {
						clEditorLayoutSvc.isPreviewVisible = false;
						previewPanel.$elt.addClass('hidden');
					}

				}

				function showPreview() {
					if(!clEditorLayoutSvc.isEditorOpen || clEditorLayoutSvc.isSidePreviewOpen) {
						clEditorLayoutSvc.isPreviewVisible = true;
						previewPanel.$elt.removeClass('hidden');
					}
				}

				function updateLayoutSize() {
					clEditorLayoutSvc.fontSizePx = clEditorLayoutSvc.fontSize + 'px';
					clEditorLayoutSvc.fontSizeEm = (7 + clSettingSvc.values.zoom) / 10 + 'em';
					binderPanel.width(clEditorLayoutSvc.binderWidth).left(-clEditorLayoutSvc.binderWidth / 2);
					previewPanel.width(clEditorLayoutSvc.previewWidth).left(-clEditorLayoutSvc.previewWidth / 2);
					pagePanel.width(clEditorLayoutSvc.binderWidth - clEditorLayoutSvc.pageMargin);
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
					backgroundPanel.move().x(clEditorLayoutSvc.backgroundX).duration(duration).then(debouncedUpdatedLayoutSize).end();
					binderPanel.move().x(clEditorLayoutSvc.binderX).duration(duration).then(debouncedUpdatedLayoutSize).end();
					previewPanel.move().x(clEditorLayoutSvc.previewX).duration(duration).then(debouncedUpdatedLayoutSize).end();
				}

				animateLayout();
				updateLayoutSize();

				function animateEditor() {
					showPreview();
					updateLayout();
					editorPanel.move().to(clEditorLayoutSvc.editorX, clEditorLayoutSvc.editorY).duration(270).ease(clEditorLayoutSvc.isEditorOpen ? 'out' : 'in').then(function() {
						hidePreview();
						clEditorLayoutSvc.toggleSidePreview(false);
						clEditorLayoutSvc.currentControl = undefined;
						scope.$apply();
					}).end();
				}

				function animateMenu() {
					updateLayout();
					pagePanel.move().x(clEditorLayoutSvc.pageX).y(clEditorLayoutSvc.pageY).rotate(clEditorLayoutSvc.pageRotate).ease('ease-out-back').duration(180).end();
					editorPanel.move().to(clEditorLayoutSvc.editorX, clEditorLayoutSvc.editorY).duration(180).end();
				}

				function animateCorner() {
					if(!clEditorLayoutSvc.isCornerOpen) {
						clEditorLayoutSvc.isCornerButtonVisible = false;
					}
					var duration = isInited ? 180 : 0;
					cornerPanel.move().scale(clEditorLayoutSvc.isCornerOpen ? 2.5 : 1).duration(duration).then(function() {
						if(clEditorLayoutSvc.isCornerOpen) {
							clEditorLayoutSvc.isCornerButtonVisible = true;
							scope.$apply();
						}
					}).end();
				}

				animateCorner();

				isInited = true;

				window.addEventListener('resize', window.cledit.Utils.debounce(animateLayout, 400));

				scope.$watch('settingSvc.values.zoom', animateLayout);
				scope.$watch('editorLayoutSvc.isSidePreviewOpen', animateLayout);
				scope.$watch('editorLayoutSvc.isEditorOpen', animateEditor);
				scope.$watch('editorLayoutSvc.isMenuOpen', animateMenu);
				scope.$watch('editorLayoutSvc.isTocOpen', animateLayout);
				scope.$watch('editorLayoutSvc.isCornerOpen', animateCorner);
				scope.$watch('editorLayoutSvc.currentControl', function(currentControl) {
					clEditorLayoutSvc.isMenuOpen = currentControl === 'menu';
				});
			}
		};
	})
	.factory('clEditorLayoutSvc', function($rootScope, clSettingSvc, clFileSvc) {
		clSettingSvc.setDefaultValue('zoom', 3);

		var clEditorLayoutSvc = {
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
			}
		};

		window.addEventListener('keydown', function(e) {
			if(e.which === 27) {
				// Esc key
				e.preventDefault();
				clEditorLayoutSvc.currentControl = undefined;
				$rootScope.$apply();
			}
		});

		return clEditorLayoutSvc;
	});
