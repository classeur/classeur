angular.module('classeur.core.editorLayout', [])
	.directive('clFileName',
		function(clEditorLayoutSvc) {
			return {
				restrict: 'E',
				templateUrl: 'core/editorLayout/fileName.html',
				link: link
			};

			function link(scope) {
				var fileDao = scope.currentFileDao;
				scope.name = function(name) {
					if (name) {
						fileDao.name = name;
					} else if (!fileDao.name) {
						fileDao.name = 'Untitled';
					}
					return fileDao.name;
				};
				scope.name();
				scope.keydown = function(e) {
					if (e.which == 27) {
						scope.nameForm.$rollbackViewValue();
						clEditorLayoutSvc.currentControl = undefined;
					} else if (e.which === 13) {
						clEditorLayoutSvc.currentControl = undefined;
					}
				};
			}
		})
	.directive('clEditorLayout',
		function($window, clEditorLayoutSvc, clSettingSvc, clLocalSettingSvc, clEditorSvc, clFilePropertiesDialog, clPanel) {
			var hideOffsetY = 2000;

			return {
				restrict: 'E',
				templateUrl: 'core/editorLayout/editorLayout.html',
				link: link
			};

			function link(scope, element) {
				clPanel(element, '.side-bar.panel').width(clEditorLayoutSvc.sideBarWidth);
				var backgroundPanel = clPanel(element, '.background.panel');
				var previewPanel = clPanel(element, '.preview.panel');
				var previewContainerElt = element[0].querySelector('.preview.container');
				var binderPanel = clPanel(element, '.binder.panel').top(-hideOffsetY);
				var editBtnPanel = clPanel(element, '.edit.btn-panel').bottom(-hideOffsetY - 20);
				var editorPanel = clPanel(element, '.editor.panel').top(hideOffsetY);
				var pagePanel = clPanel(element, '.page.panel').left(clEditorLayoutSvc.pageMargin / 2);
				clPanel(element, '.menu.scroller').width(clEditorLayoutSvc.menuWidth + 50).right(-50);
				clPanel(element, '.menu.content').width(clEditorLayoutSvc.menuWidth);
				clPanel(element, '.editor .btn-grp.panel').width(clEditorLayoutSvc.editorBtnGrpWidth).right(-clEditorLayoutSvc.editorBtnGrpWidth);
				var cornerPanel = clPanel(element, '.corner.panel');
				clPanel(element, '.corner .shadow.panel').move().rotate(-45).end();
				var headerPanel = clPanel(element, '.header.panel').top(hideOffsetY);
				var headerBtnGrpPanel = clPanel(headerPanel.$jqElt, '.btn-grp.panel');
				var closeButtonPanel = clPanel(headerPanel.$jqElt, '.close.panel');
				var scrollButtonPanel = clPanel(headerPanel.$jqElt, '.scroll.panel');

				var binderMinWidth = 280;
				var previewSizeAdjust = 160;
				var leftMarginOverflow = 90;
				var binderWidthFactor = (clSettingSvc.values.editorBinderWidthFactor + 10) / 15;
				var fontSizeFactor = (clSettingSvc.values.editorFontSizeFactor + 10) / 15;

				function updateLayout() {
					var bgWidth = document.body.clientWidth;
					if (clEditorLayoutSvc.isSideBarOpen) {
						bgWidth -= clEditorLayoutSvc.sideBarWidth;
					}
					clEditorLayoutSvc.fontSize = 18;
					var factor = 1 + (clLocalSettingSvc.values.editorZoom - 3) * 0.1;
					clEditorLayoutSvc.pageWidth = 990 * factor;
					if (bgWidth < 1120) {
						--clEditorLayoutSvc.fontSize;
						clEditorLayoutSvc.pageWidth = 910 * factor;
					}
					if (bgWidth < 1040) {
						clEditorLayoutSvc.pageWidth = 830 * factor;
					}
					if (bgWidth < binderMinWidth) {
						bgWidth = binderMinWidth;
					}
					clEditorLayoutSvc.pageWidth *= binderWidthFactor;
					var marginRight = (bgWidth - clEditorLayoutSvc.pageWidth) / 2;
					marginRight = marginRight > 0 ? marginRight : 0;
					if (bgWidth + leftMarginOverflow < clEditorLayoutSvc.pageWidth) {
						clEditorLayoutSvc.pageWidth = bgWidth + leftMarginOverflow;
					}
					if (clEditorLayoutSvc.pageWidth < 640) {
						--clEditorLayoutSvc.fontSize;
					}
					clEditorLayoutSvc.fontSize *= fontSizeFactor;
					if (clEditorLayoutSvc.isSidePreviewOpen) {
						if (bgWidth / 2 < binderMinWidth) {
							clEditorLayoutSvc.isSidePreviewOpen = false;
						} else {
							var maxWidth = bgWidth / 2 + clEditorLayoutSvc.editorBtnGrpWidth + leftMarginOverflow;

							if (maxWidth < clEditorLayoutSvc.pageWidth) {
								clEditorLayoutSvc.pageWidth = maxWidth;
							}
							marginRight = bgWidth / 2 - clEditorLayoutSvc.editorBtnGrpWidth;
						}
					}

					clEditorLayoutSvc.backgroundX = clEditorLayoutSvc.isSideBarOpen ? -clEditorLayoutSvc.sideBarWidth : 0;
					clEditorLayoutSvc.binderWidth = clEditorLayoutSvc.pageWidth - clEditorLayoutSvc.editorBtnGrpWidth;
					clEditorLayoutSvc.binderX = bgWidth - (clEditorLayoutSvc.pageWidth + clEditorLayoutSvc.editorBtnGrpWidth) / 2 - marginRight;
					clEditorLayoutSvc.binderX += clEditorLayoutSvc.isSideBarOpen ? clEditorLayoutSvc.sideBarWidth : 0;
					clEditorLayoutSvc.previewWidth = clEditorLayoutSvc.pageWidth - previewSizeAdjust + 2000;
					clEditorLayoutSvc.previewHeaderWidth = clEditorLayoutSvc.pageWidth - previewSizeAdjust + 190;
					clEditorLayoutSvc.previewX = clEditorLayoutSvc.binderX;
					clEditorLayoutSvc.previewX += clEditorLayoutSvc.isSidePreviewOpen ? clEditorLayoutSvc.pageWidth - previewSizeAdjust / 2 : 20;
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
						// Update width according to scrollbar visibility
						updateLayoutSize();
					}
				}

				var sectionDescList;

				function updateLayoutSize() {
					var previewScrollbarWidth = previewContainerElt.offsetWidth - previewContainerElt.clientWidth;
					var eltToScroll = clEditorSvc.editorElt.parentNode,
						dimensionKey = 'editorDimension';
					if (!clEditorLayoutSvc.isEditorOpen) {
						eltToScroll = clEditorSvc.previewElt.parentNode, dimensionKey = 'previewDimension';
					}
					var scrollTop = eltToScroll.scrollTop;
					var scrollSectionDesc, posInSection;
					sectionDescList === clEditorSvc.sectionDescList && sectionDescList.some(function(sectionDesc) {
						if (scrollTop < sectionDesc[dimensionKey].endOffset) {
							scrollSectionDesc = sectionDesc;
							posInSection = (scrollTop - sectionDesc[dimensionKey].startOffset) / (sectionDesc[dimensionKey].height || 1);
							return true;
						}
					});

					clEditorLayoutSvc.fontSizePx = clEditorLayoutSvc.fontSize + 'px';
					clEditorLayoutSvc.fontSizeEm = (7 + clLocalSettingSvc.values.editorZoom) / 10 + 'em';
					binderPanel.width(clEditorLayoutSvc.binderWidth).left(-clEditorLayoutSvc.binderWidth / 2);
					previewPanel.width(clEditorLayoutSvc.previewWidth).left(-clEditorLayoutSvc.previewWidth / 2);
					headerPanel.width(clEditorLayoutSvc.previewHeaderWidth - previewScrollbarWidth);
					pagePanel.width(clEditorLayoutSvc.binderWidth - clEditorLayoutSvc.pageMargin);
					hidePreview();

					if (scrollSectionDesc) {
						setTimeout(function() {
							clEditorSvc.measureSectionDimensions();
							scrollTop = scrollSectionDesc[dimensionKey].startOffset + scrollSectionDesc[dimensionKey].height * posInSection;
							eltToScroll.scrollTop = scrollTop;
						}, 10);
					}
				}

				var debouncedUpdatedLayoutSize = $window.cledit.Utils.debounce(function() {
					updateLayoutSize();
					scope.$apply();
				}, 180);

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
						editBtnPanel.move('slow').y(clEditorLayoutSvc.isEditorOpen ? 100 : 0).ease('ease-out-back').end();
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
					clEditorLayoutSvc.currentControl = 'editProperties';
					var fileDao = scope.currentFileDao;
					clFilePropertiesDialog(fileDao.contentDao.properties)
						.then(function(properties) {
							clEditorLayoutSvc.currentControl = undefined;
							if (fileDao === scope.currentFileDao) {
								fileDao.contentDao.properties = properties;
							}
						}, function() {
							clEditorLayoutSvc.currentControl = undefined;
						});
				};

				var tabs = ['map', 'discussions'];
				scope.$watch('editorLayoutSvc.sideBarTab', function(tab) {
					scope.selectedTabIndex = tabs.indexOf(tab);
				});
				scope.$watch('selectedTabIndex', function(index) {
					clEditorLayoutSvc.sideBarTab = tabs[index || 0];
				});

				var isInited;
				setTimeout(function() {
					isInited = true;
				}, 1);

				var debouncedAnimateLayout = window.cledit.Utils.debounce(animateLayout, 50);
				window.addEventListener('resize', debouncedAnimateLayout);
				scope.$on('$destroy', function() {
					window.removeEventListener('resize', debouncedAnimateLayout);
					clEditorLayoutSvc.clean();
				});

				scope.$watch('localSettingSvc.values.editorZoom', animateLayout);
				scope.$watch('localSettingSvc.values.editorColor', function(value) {
					scope.plasticClass = 'plastic-' + (value - 1);
				});
				scope.$watch('editorLayoutSvc.isSidePreviewOpen', animateLayout);
				scope.$watch('editorLayoutSvc.isEditorOpen', animateEditor);
				scope.$watch('editorLayoutSvc.isMenuOpen', animateMenu);
				scope.$watch('editorLayoutSvc.isSideBarOpen', animateLayout);
				scope.$watch('editorLayoutSvc.isCornerOpen', animateCorner);
				scope.$watch('editorLayoutSvc.currentControl', function(currentControl) {
					clEditorLayoutSvc.isMenuOpen = currentControl === 'menu';
				});
				scope.$watch('editorSvc.isPreviewTop', animatePreviewButtons);
				scope.$watch('editorSvc.lastSectionMeasured', function() {
					sectionDescList = clEditorSvc.sectionDescList;
				});
			}
		})
	.factory('clEditorLayoutSvc',
		function($rootScope) {
			var clEditorLayoutSvc = {
				pageMargin: 22,
				editorBtnGrpWidth: 40,
				menuWidth: 320,
				sideBarWidth: 260,
				statHeight: 30,
				init: function(hideEditor) {
					this.isEditorOpen = !hideEditor;
					this.isSidePreviewOpen = false;
					this.sideBarTab = 'toc';
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
				toggleSideBar: function(isOpen) {
					this.isSideBarOpen = isOpen === undefined ? !this.isSideBarOpen : isOpen;
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
