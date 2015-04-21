angular.module('classeur.core.editorLayout', [])
	.directive('clFileName', function(clEditorLayoutSvc) {
		return {
			restrict: 'E',
			templateUrl: 'core/editorLayout/fileName.html',
			link: function(scope) {
				var previousName;

				function setDefaultName() {
					scope.currentFileDao.name = scope.currentFileDao.name || 'Untitled';
					previousName = scope.currentFileDao.name;
				}
				setDefaultName();
				scope.setDefaultName = setDefaultName;
				scope.keydown = function(e) {
					if (e.keyCode == 27) {
						scope.currentFileDao.name = previousName;
						clEditorLayoutSvc.currentControl = undefined;
					}
					else if (e.which === 13) {
						clEditorLayoutSvc.currentControl = undefined;
					}
				};
			}
		};
	})
	.directive('clEditorLayout', function($window, clEditorLayoutSvc, clSettingSvc, clLocalSettingSvc, clEditorSvc, clFilePropertiesDialog, clPanel, clScrollBarWidth) {
		var hideOffsetY = 2000;

		return {
			restrict: 'E',
			templateUrl: 'core/editorLayout/editorLayout.html',
			link: function(scope, element) {

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
				var headerPanel = clPanel(element, '.header.panel').top(hideOffsetY);
				var headerBtnGrpPanel = clPanel(headerPanel.$jqElt, '.btn-grp.panel');
				var closeButtonPanel = clPanel(headerPanel.$jqElt, '.close.panel');
				var scrollButtonPanel = clPanel(headerPanel.$jqElt, '.scroll.panel');

				var previewSizeAdjust = 150;
				var binderWidth, marginRight;
				var leftMarginOverflow = 90;
				var binderWidthFactor = (clSettingSvc.values.editorBinderWidthFactor + 10) / 15;
				var fontSizeFactor = (clSettingSvc.values.editorFontSizeFactor + 10) / 15;

				function updateLayout() {
					binderWidth = document.body.clientWidth;
					if (clEditorLayoutSvc.isTocOpen) {
						binderWidth -= clEditorLayoutSvc.tocWidth;
					}
					clEditorLayoutSvc.fontSize = 18;
					var factor = 1 + (clLocalSettingSvc.values.editorZoom - 3) * 0.1;
					clEditorLayoutSvc.pageWidth = 990 * factor;
					if (binderWidth < 1120) {
						--clEditorLayoutSvc.fontSize;
						clEditorLayoutSvc.pageWidth = 910 * factor;
					}
					if (binderWidth < 1040) {
						clEditorLayoutSvc.pageWidth = 830 * factor;
					}
					clEditorLayoutSvc.pageWidth *= binderWidthFactor;
					marginRight = (binderWidth - clEditorLayoutSvc.pageWidth) / 2;
					marginRight = marginRight > 0 ? marginRight : 0;
					if (binderWidth + leftMarginOverflow < clEditorLayoutSvc.pageWidth) {
						clEditorLayoutSvc.pageWidth = binderWidth + leftMarginOverflow;
					}
					if (clEditorLayoutSvc.pageWidth < 640) {
						--clEditorLayoutSvc.fontSize;
					}
					clEditorLayoutSvc.fontSize *= fontSizeFactor;
					if (clEditorLayoutSvc.isSidePreviewOpen) {
						var maxWidth = binderWidth / 2 + clEditorLayoutSvc.editorBtnGrpWidth + leftMarginOverflow;
						if (maxWidth < clEditorLayoutSvc.pageWidth) {
							clEditorLayoutSvc.pageWidth = maxWidth;
						}
						marginRight = binderWidth / 2 - clEditorLayoutSvc.editorBtnGrpWidth;
					}

					clEditorLayoutSvc.backgroundX = clEditorLayoutSvc.isTocOpen ? -clEditorLayoutSvc.tocWidth : 0;
					clEditorLayoutSvc.binderWidth = clEditorLayoutSvc.pageWidth - clEditorLayoutSvc.editorBtnGrpWidth;
					clEditorLayoutSvc.binderX = binderWidth - (clEditorLayoutSvc.pageWidth + clEditorLayoutSvc.editorBtnGrpWidth) / 2 - marginRight;
					clEditorLayoutSvc.binderX += clEditorLayoutSvc.isTocOpen ? clEditorLayoutSvc.tocWidth : 0;
					clEditorLayoutSvc.previewWidth = clEditorLayoutSvc.pageWidth - previewSizeAdjust + 2000;
					clEditorLayoutSvc.previewHeaderWidth = clEditorLayoutSvc.pageWidth - previewSizeAdjust - clScrollBarWidth + 150;
					clEditorLayoutSvc.previewX = clEditorLayoutSvc.binderX;
					clEditorLayoutSvc.previewX += clEditorLayoutSvc.isSidePreviewOpen ? clEditorLayoutSvc.pageWidth - previewSizeAdjust / 2 : 0;
					clEditorLayoutSvc.editorX = clEditorLayoutSvc.isMenuOpen ? 5 : 0;
					clEditorLayoutSvc.editorY = clEditorLayoutSvc.isEditorOpen ? 0 : hideOffsetY;
					clEditorLayoutSvc.pageX = clEditorLayoutSvc.isMenuOpen ? -(clEditorLayoutSvc.menuWidth - 20) : 0;
					clEditorLayoutSvc.pageY = clEditorLayoutSvc.isMenuOpen ? -80 : 0;
					clEditorLayoutSvc.pageRotate = clEditorLayoutSvc.isMenuOpen ? -2 : 0;
					scope.showHelp = clSettingSvc.values.editorMdCheatSheetBtn && clEditorLayoutSvc.isEditorOpen && !clEditorLayoutSvc.isSidePreviewOpen && !scope.currentFileDao.isReadOnly;
				}

				function hidePreview() {
					if (clEditorLayoutSvc.isEditorOpen && !clEditorLayoutSvc.isSidePreviewOpen) {
						clEditorLayoutSvc.isPreviewVisible = false;
						previewPanel.$jqElt.addClass('hidden');
					}
				}

				function showPreview() {
					if (!clEditorLayoutSvc.isEditorOpen || clEditorLayoutSvc.isSidePreviewOpen) {
						clEditorLayoutSvc.isPreviewVisible = true;
						previewPanel.$jqElt.removeClass('hidden');
					}
				}

				function updateLayoutSize() {
					clEditorLayoutSvc.fontSizePx = clEditorLayoutSvc.fontSize + 'px';
					clEditorLayoutSvc.fontSizeEm = (7 + clLocalSettingSvc.values.editorZoom) / 10 + 'em';
					binderPanel.width(clEditorLayoutSvc.binderWidth).left(-clEditorLayoutSvc.binderWidth / 2);
					previewPanel.width(clEditorLayoutSvc.previewWidth).left(-clEditorLayoutSvc.previewWidth / 2);
					headerPanel.width(clEditorLayoutSvc.previewHeaderWidth);
					pagePanel.width(clEditorLayoutSvc.binderWidth - clEditorLayoutSvc.pageMargin);
					hidePreview();
				}

				var debouncedUpdatedLayoutSize = $window.cledit.Utils.debounce(function() {
					updateLayoutSize();
					scope.$apply();
				}, 90);

				function animateLayout() {
					showPreview();
					updateLayout();
					backgroundPanel.move(isInited && 'slow').x(clEditorLayoutSvc.backgroundX).then(debouncedUpdatedLayoutSize).end();
					binderPanel.move(isInited && 'slow').x(clEditorLayoutSvc.binderX).then(debouncedUpdatedLayoutSize).end();
					previewPanel.move(isInited && 'slow').x(clEditorLayoutSvc.previewX).then(debouncedUpdatedLayoutSize).end();
				}

				animateLayout();
				updateLayoutSize();

				function animateEditor() {
					showPreview();
					updateLayout();
					editorPanel.move(isInited && 'sslow').to(clEditorLayoutSvc.editorX, clEditorLayoutSvc.editorY).ease(clEditorLayoutSvc.isEditorOpen ? 'out' : 'in').then(function() {
						setTimeout(function() {
							hidePreview();
							clEditorLayoutSvc.toggleSidePreview(false);
							clEditorLayoutSvc.currentControl = undefined;
							isInited && scope.$apply();
						}, 90);
					}).end();
				}

				function animateMenu() {
					updateLayout();
					pagePanel.move('slow').x(clEditorLayoutSvc.pageX).y(clEditorLayoutSvc.pageY).rotate(clEditorLayoutSvc.pageRotate).ease('ease-out-back').end();
					editorPanel.move(isInited && 'slow').to(clEditorLayoutSvc.editorX, clEditorLayoutSvc.editorY).end();
				}

				function animateCorner() {
					if (!clEditorLayoutSvc.isCornerOpen) {
						clEditorLayoutSvc.isCornerButtonVisible = false;
					}
					cornerPanel.move(isInited && 'slow').scale(clEditorLayoutSvc.isCornerOpen ? 2.5 : 1).then(function() {
						if (clEditorLayoutSvc.isCornerOpen) {
							clEditorLayoutSvc.isCornerButtonVisible = true;
							isInited && scope.$apply();
						}
					}).end();
				}

				function animatePreviewButtons(isPreviewTop) {
					headerBtnGrpPanel.css().move(isInited && 'slow').rotate(isPreviewTop ? 0 : 90).end();
					closeButtonPanel.css('zIndex', isPreviewTop ? 0 : -1).move(isInited && 'slow').set('opacity', isPreviewTop ? 1 : 0).ease('in-out').end();
					scrollButtonPanel.css('zIndex', isPreviewTop ? -1 : 0).move(isInited && 'slow').set('opacity', isPreviewTop ? 0 : 1).ease('in-out').end();
				}

				scope.editFileProperties = function() {
					var fileDao = scope.currentFileDao;
					clFilePropertiesDialog(fileDao.contentDao.properties)
						.then(function(properties) {
							if (fileDao === scope.currentFileDao) {
								fileDao.contentDao.properties = properties;
							}
						});
				};

				var isInited;
				setTimeout(function() {
					isInited = true;
				}, 1);

				var debouncedAnimateLayout = window.cledit.Utils.debounce(animateLayout, 400);
				window.addEventListener('resize', debouncedAnimateLayout);
				scope.$on('$destroy', function() {
					window.removeEventListener('resize', debouncedAnimateLayout);
					clEditorLayoutSvc.clean();
				});

				scope.$watch('localSettingSvc.values.editorZoom', animateLayout);
				scope.$watch('localSettingSvc.values.editorColor', function(value) {
					scope.plasticClass = 'plastic-' + (value + 97) % 100;
				});
				scope.$watch('editorLayoutSvc.isSidePreviewOpen', animateLayout);
				scope.$watch('editorLayoutSvc.isEditorOpen', animateEditor);
				scope.$watch('editorLayoutSvc.isMenuOpen', animateMenu);
				scope.$watch('editorLayoutSvc.isTocOpen', animateLayout);
				scope.$watch('editorLayoutSvc.isCornerOpen', animateCorner);
				scope.$watch('editorLayoutSvc.currentControl', function(currentControl) {
					clEditorLayoutSvc.isMenuOpen = currentControl === 'menu';
				});
				scope.$watch('editorSvc.isPreviewTop', animatePreviewButtons);
			}
		};
	})
	.factory('clEditorLayoutSvc', function($rootScope) {
		var clEditorLayoutSvc = {
			pageMargin: 24,
			editorBtnGrpWidth: 40,
			menuWidth: 320,
			tocWidth: 250,
			statHeight: 30,
			init: function(hideEditor) {
				this.isEditorOpen = !hideEditor;
				this.isSidePreviewOpen = false;
				this.isMenuOpen = false;
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
			clean: function() {
				this.currentControl = undefined;
			}
		};

		window.addEventListener('keydown', function(e) {
			if (e.which === 27) {
				// Esc key
				e.preventDefault();
				clEditorLayoutSvc.currentControl = undefined;
				$rootScope.$apply();
			}
		});

		return clEditorLayoutSvc;
	});
